import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../index.css';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import Sidebar from './Sidebar';
import Dashboard from './Dashboard';
import { runGESAnalysis, geodesicAreaM2, perimeterM, fetchNearestSubstationKm } from '../services/analysisEngine';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Tile URLs per analysis layer ──────────────────────────────────────────────
const TILES = {
  standard: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '&copy; OpenStreetMap' },
  dem: { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attr: '&copy; OpenTopoMap' },
  slope: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}', attr: '&copy; Esri Hillshade' },
  aspect: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}', attr: '&copy; Esri Shaded Relief' },
};

const MASK_COLOR = {
  north: '#ef4444',   // red
  steep: '#f97316',   // orange
  shadow: '#6b7280',   // grey
  null: '#22c55e',   // green = suitable
};

// ── Sub-components ────────────────────────────────────────────────────────────

const DynamicTile = ({ layer }) => {
  const t = TILES[layer] || TILES.standard;
  return <TileLayer key={layer} url={t.url} attribution={t.attr} maxZoom={17} />;
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
      if (isCancelled) return;          // bail if effect was cleaned up

      const drawnItems = new L.FeatureGroup();
      drawnRef.current = drawnItems;
      map.addLayer(drawnItems);

      drawCtrl = new L.Control.Draw({
        position: 'topleft',
        draw: {
          polyline: false, rectangle: false, circle: false,
          circlemarker: false, marker: false,
          polygon: {
            showArea: true, showLength: true, metric: true, feet: false,
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
  }, [map]);

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

import { ArrowLeft } from 'lucide-react';

export default function Analyzer({ onBack }) {
  const [activeLayer, setActiveLayer] = useState('standard');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const [nearestSubstationKm, setNearestSubstationKm] = useState(null);
  const [isFetchingSubstation, setIsFetchingSubstation] = useState(false);

  const layers = { dem: activeLayer === 'dem', slope: activeLayer === 'slope', aspect: activeLayer === 'aspect' };

  const handleLayerToggle = (id) =>
    setActiveLayer(prev => (prev === id ? 'standard' : id));

  const handlePolygonDrawn = useCallback(async (latlngs) => {
    if (!latlngs) {
      setAnalysisResult(null);
      setNearestSubstationKm(null);
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    setNearestSubstationKm(null);
    setIsFetchingSubstation(true);

    // Centroid for Overpass query
    const centerLat = latlngs.reduce((s, p) => s + p.lat, 0) / latlngs.length;
    const centerLng = latlngs.reduce((s, p) => s + p.lng, 0) / latlngs.length;

    // Run GES analysis and Overpass query in parallel
    const [gesResult, substationResult] = await Promise.allSettled([
      runGESAnalysis(latlngs),
<<<<<<< HEAD
      fetchNearestSubstationKm(centerLat, centerLng, 10000),
=======
      fetchNearestSubstationKm(centerLat, centerLng, 15000),
>>>>>>> c674b8d (Professional GIS Analysis Engine Integration)
    ]);

    if (gesResult.status === 'fulfilled') {
      setAnalysisResult(gesResult.value);
    } else {
      console.error(gesResult.reason);
      setAnalysisError(gesResult.reason?.message || 'Analiz hatası oluştu.');
    }

    if (substationResult.status === 'fulfilled') {
      setNearestSubstationKm(substationResult.value);
    } else {
      console.warn('Overpass sorgusu başarısız:', substationResult.reason);
      setNearestSubstationKm(null);
    }

    setIsAnalyzing(false);
    setIsFetchingSubstation(false);
  }, []);

  return (
    <div className="flex flex-col md:flex-row w-full h-[100dvh] overflow-hidden bg-slate-950 text-slate-200 antialiased">
      <Sidebar layers={layers} toggleLayer={handleLayerToggle} />

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        <button 
          onClick={onBack}
          className="absolute top-4 right-4 md:right-auto md:left-4 z-[1000] flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-slate-900/80 backdrop-blur-md text-white border border-slate-700/50 rounded-lg shadow-lg hover:bg-slate-800 transition-all font-medium text-sm md:text-base opacity-90 hover:opacity-100"
        >
          <ArrowLeft size={18} />
          <span>Geri Dön</span>
        </button>

        <div className="flex-1 h-full">
          <MapContainer center={[41.1, 41.1]} zoom={9} scrollWheelZoom style={{ width: '100%', height: '100%' }}>
            <DynamicTile layer={activeLayer} />
            <DrawControl onPolygonDrawn={handlePolygonDrawn} />
            <AnalysisOverlay points={analysisResult?.points} />
          </MapContainer>
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
