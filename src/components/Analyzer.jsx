import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, useMap, LayersControl } from 'react-leaflet';
import { ArrowLeft } from 'lucide-react';
import L from 'leaflet';

// CSS Imports
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import '../index.css';

// Project Components & Services
import Sidebar from './Sidebar';
import Dashboard from './Dashboard';
import { runGESAnalysis, fetchNearestSubstationKm } from '../services/analysisEngine';

// Leaflet Icon Fix & html2canvas Compatibility
window.L_DISABLE_3D = true; // Crucial for html2canvas to capture Leaflet tiles correctly
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Tile URLs per analysis layer ──────────────────────────────────────────────
const TILES = {
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: '&copy; Esri World Imagery' },
  standard: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '&copy; OpenStreetMap' },
  dem: { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attr: '&copy; OpenTopoMap' },
  slope: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}', attr: '&copy; Esri Hillshade' },
  aspect: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}', attr: '&copy; Esri Shaded Relief' },
};

const MASK_COLOR = {
  north: '#ef4444',   // red
  steep: '#f97316',   // orange
  shadow: '#6b7280',  // grey
  null: '#22c55e',    // green = suitable
};

// ── Sub-components ────────────────────────────────────────────────────────────

const DynamicTile = ({ layer }) => {
  if (layer === 'standard') return null;
  const t = TILES[layer];
  if (!t) return null;
  return <TileLayer key={layer} url={t.url} attribution={t.attr} maxZoom={17} crossOrigin="anonymous" />;
};

const DrawControl = ({ onPolygonDrawn }) => {
  const map = useMap();
  const drawnRef = useRef(null);

  useEffect(() => {
    let isCancelled = false;
    let drawCtrl;

    const init = async () => {
      window.L = L;
      await import('leaflet-draw');
      if (isCancelled) return;

      const drawnItems = new L.FeatureGroup();
      drawnRef.current = drawnItems;
      map.addLayer(drawnItems);

      drawCtrl = new L.Control.Draw({
        position: 'topleft',
        draw: {
          polyline: false, rectangle: false, circle: false,
          circlemarker: false, marker: false,
          polygon: {
            showArea: true, showLength: true, metric: true,
            shapeOptions: { color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 2 },
          },
        },
        edit: { featureGroup: drawnItems, remove: true },
      });

      map.whenReady(() => {
        if (!isCancelled) map.addControl(drawCtrl);
      });

      map.on(L.Draw.Event.CREATED, (e) => {
        drawnItems.clearLayers();
        drawnItems.addLayer(e.layer);
        if (e.layerType === 'polygon') onPolygonDrawn(e.layer.getLatLngs()[0]);
      });
      map.on(L.Draw.Event.DELETED, () => onPolygonDrawn(null));
    };

    init();

    return () => {
      isCancelled = true;
      if (drawCtrl) map.removeControl(drawCtrl);
      if (drawnRef.current) { map.removeLayer(drawnRef.current); drawnRef.current = null; }
      map.off(L.Draw.Event.CREATED);
      map.off(L.Draw.Event.DELETED);
    };
  }, [map, onPolygonDrawn]);

  return null;
};

const AnalysisOverlay = ({ points }) => {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    if (!points?.length) return;

    const group = L.layerGroup();
    points.forEach(p => {
      const color = MASK_COLOR[p.mask] ?? MASK_COLOR[null];
      const label = p.mask === 'north' ? '🔴 Kuzey Bakı'
        : p.mask === 'steep' ? '🟠 Çok Dik'
          : p.mask === 'shadow' ? '⚫ Gölge'
            : '🟢 Uygun';
      L.circleMarker([p.lat, p.lng], {
        radius: 7, color, fillColor: color, fillOpacity: 0.75, weight: 1,
      })
        .bindPopup(
          `<b>${label}</b><br/>Eğim: ${p.slopeDeg}° &nbsp; Bakı: ${p.aspectDeg}°<br/>Yükseklik: ${p.elevation} m`
        )
        .addTo(group);
    });
    group.addTo(map);
    layerRef.current = group;

    return () => { if (layerRef.current) map.removeLayer(layerRef.current); };
  }, [points, map]);

  return null;
};

// Drawn polygon overlay (user-drawn blue dashed)
const PolygonOverlay = ({ polygon }) => {
  const map = useMap();
  const layerRef = useRef(null);
  useEffect(() => {
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    if (!polygon || polygon.length === 0) return;
    const polyLayer = L.polygon(polygon, {
      color: '#3b82f6',
      weight: 4,
      fillColor: '#3b82f6',
      fillOpacity: 0.2,
      dashArray: '6, 6',
    }).addTo(map);
    layerRef.current = polyLayer;
    return () => { map.removeLayer(polyLayer); };
  }, [polygon, map]);
  return null;
};

// TKGM parcel overlay (orange solid border, distinct from user drawings)
const ParcelOverlay = ({ polygon }) => {
  const map = useMap();
  const layerRef = useRef(null);
  useEffect(() => {
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    if (!polygon || polygon.length === 0) return;
    const poly = L.polygon(polygon, {
      color: '#f59e0b',
      weight: 3,
      fillColor: '#f59e0b',
      fillOpacity: 0.12,
    });
    poly.addTo(map);
    // Auto-zoom to parcel
    try { map.fitBounds(poly.getBounds(), { padding: [40, 40], animate: true }); } catch (_) {}
    poly.bindPopup(`<b>&#x1F4D0; TKGM Parseli</b><br/>Kadastro siniri MEGSIS'ten alindi.`).openPopup();
    layerRef.current = poly;
    return () => { map.removeLayer(poly); };
  }, [polygon, map]);
  return null;
};

const ChangeView = ({ center, bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [20, 20], animate: false });
    else if (center) map.setView(center, 14, { animate: false });
  }, [center, bounds, map]);
  return null;
};

export default function Analyzer({ onBack }) {
  const [activeLayer, setActiveLayer] = useState('standard');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const [nearestSubstationKm, setNearestSubstationKm] = useState(null);
  const [isFetchingSubstation, setIsFetchingSubstation] = useState(false);

  // States for hidden map sync
  const [mapCenter, setMapCenter] = useState([39, 35]);
  const [mapBounds, setMapBounds] = useState(null);
  const [drawnPolygon, setDrawnPolygon] = useState(null);
  // TKGM parcel polygon (shown with distinct orange style)
  const [parcelPolygon, setParcelPolygon] = useState(null);

  const layers = { dem: activeLayer === 'dem', slope: activeLayer === 'slope', aspect: activeLayer === 'aspect' };

  const handleLayerToggle = (id) =>
    setActiveLayer(prev => (prev === id ? 'standard' : id));

  const handlePolygonDrawn = useCallback(async (latlngs) => {
    setDrawnPolygon(latlngs);
    if (!latlngs) {
      setAnalysisResult(null);
      setNearestSubstationKm(null);
      setMapBounds(null);
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    setNearestSubstationKm(null);
    setIsFetchingSubstation(true);

    const centerLat = latlngs.reduce((s, p) => s + p.lat, 0) / latlngs.length;
    const centerLng = latlngs.reduce((s, p) => s + p.lng, 0) / latlngs.length;
    setMapCenter([centerLat, centerLng]);

    // Calculate 10km Buffer Bounds for "Uzaktan Görünüm"
    const latBuffer = 10 / 111.32; 
    const lngBuffer = 10 / (111.32 * Math.cos(centerLat * Math.PI / 180));
    setMapBounds([
      [centerLat - latBuffer, centerLng - lngBuffer],
      [centerLat + latBuffer, centerLng + lngBuffer]
    ]);

    try {
      // Run GES analysis and Overpass query in parallel
      const [gesResult, substationResult] = await Promise.allSettled([
        runGESAnalysis(latlngs),
        fetchNearestSubstationKm(centerLat, centerLng, 15000),
      ]);

      if (gesResult.status === 'fulfilled') {
        setAnalysisResult(gesResult.value);
      } else {
        setAnalysisError(gesResult.reason?.message || 'Analiz hatası oluştu.');
      }

      if (substationResult.status === 'fulfilled') {
        setNearestSubstationKm(substationResult.value);
      } else {
        setNearestSubstationKm(null);
      }
    } catch (err) {
      setAnalysisError("Sistemde beklenmedik bir hata oluştu.");
    } finally {
      setIsAnalyzing(false);
      setIsFetchingSubstation(false);
    }
  }, []);

  const handleParcelSelected = useCallback((parcelData) => {
    if (!parcelData || !parcelData.geometry) return;

    // Megsis v3 returns { geometry: { type: 'Polygon', coordinates: [[[lng, lat], ...]] } }
    const rawCoords = parcelData.geometry.type === 'MultiPolygon'
      ? parcelData.geometry.coordinates[0][0]   // take first ring of first polygon
      : parcelData.geometry.coordinates[0];      // first ring of single polygon

    const latlngs = rawCoords.map(c => ({ lat: c[1], lng: c[0] }));

    // Show the TKGM parcel in orange, clear any previously drawn polygon
    setParcelPolygon(latlngs);
    setDrawnPolygon(null);

    // Run the GES analysis on the parcel boundary
    handlePolygonDrawn(latlngs);
  }, [handlePolygonDrawn]);

  return (
    <div className="flex flex-col md:flex-row w-full h-[100dvh] overflow-hidden bg-slate-950 text-slate-200 antialiased">
      <Sidebar 
        layers={layers} 
        toggleLayer={handleLayerToggle} 
        onParcelSelected={handleParcelSelected} 
      />

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        <button
          onClick={onBack}
          className="absolute top-4 right-4 md:right-auto md:left-4 z-[1000] flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-slate-900/80 backdrop-blur-md text-white border border-slate-700/50 rounded-lg shadow-lg hover:bg-slate-800 transition-all font-medium text-sm md:text-base opacity-90 hover:opacity-100"
        >
          <ArrowLeft size={18} />
          <span>Geri Dön</span>
        </button>

        <div className="flex-1 h-full relative" id="aura-map-container">
          {isAnalyzing && (
            <div className="absolute inset-0 z-[2000] bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center">
              <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(245,158,11,0.5)]"></div>
              <p className="text-white font-bold tracking-wider animate-pulse">CBS Verileri Çözümleniyor...</p>
              <p className="text-amber-400 text-xs mt-1">Satellite & Terrain Sync</p>
            </div>
          )}
          <MapContainer center={[39, 35]} zoom={6} scrollWheelZoom style={{ width: '100%', height: '100%' }}>
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="Uydu Görünümü">
                <TileLayer url={TILES.satellite.url} attribution={TILES.satellite.attr} maxZoom={19} />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Sokak Görünümü">
                <TileLayer url={TILES.standard.url} attribution={TILES.standard.attr} maxZoom={19} />
              </LayersControl.BaseLayer>
            </LayersControl>
            <ChangeView center={mapCenter} bounds={mapBounds ? L.latLngBounds(mapBounds) : null} />
            <DynamicTile layer={activeLayer} />
            <DrawControl onPolygonDrawn={(latlngs) => { handlePolygonDrawn(latlngs); }} />
            <AnalysisOverlay points={analysisResult?.points} />
            <PolygonOverlay polygon={drawnPolygon} />
            <ParcelOverlay polygon={parcelPolygon} />
          </MapContainer>

          {/* HIDDEN TRIPLE MAP EXPORT CONTAINER FOR PRO PDF */}
          <div 
            id="pro-export-maps-row" 
            style={{ 
              position: 'absolute', top: 0, left: 0, 
              width: '1600px', height: '400px', 
              display: 'flex', gap: '2px',
              pointerEvents: 'none', zIndex: -100, backgroundColor: '#f8fafc',
              visibility: 'visible', opacity: 1, overflow: 'hidden'
            }}
          >
            {['dem', 'slope', 'aspect', 'satellite'].map((l) => {
              const boundsObj = mapBounds ? L.latLngBounds(mapBounds) : null;
              return (
                <div key={l} className="flex-1 h-full bg-slate-100 flex flex-col border border-slate-300">
                  <div className="bg-slate-800 text-white text-center text-[10px] py-1 font-bold uppercase tracking-wider">
                    {l === 'dem' ? 'Arazi Topografyası' : l === 'slope' ? 'Eğim Analizi' : l === 'aspect' ? 'Bakı Analizi' : 'Uydu Görünümü'}
                  </div>
                  <div className="flex-1 w-full relative">
                    <MapContainer 
                      center={mapCenter} 
                      zoom={12}
                      zoomControl={false} dragging={false} scrollWheelZoom={false} 
                      preferCanvas={false}
                      whenReady={(e) => {
                        setTimeout(() => {
                          e.target.invalidateSize();
                        }, 600);
                      }}
                      style={{ width: '100%', height: '100%' }}
                    >
                      <ChangeView center={mapCenter} bounds={boundsObj} />
                      <DynamicTile layer={l} />
                      <AnalysisOverlay points={analysisResult?.points} />
                      <PolygonOverlay polygon={drawnPolygon} />
                    </MapContainer>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        <Dashboard
          analysisResult={analysisResult}
          isAnalyzing={isAnalyzing}
          analysisError={analysisError}
          nearestSubstationKm={nearestSubstationKm}
          isFetchingSubstation={isFetchingSubstation}
        />
      </main>
    </div>
  );
}