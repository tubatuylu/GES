import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents, LayersControl } from 'react-leaflet';
import { ArrowLeft, Upload, CheckCircle, X, ShieldAlert } from 'lucide-react';
import exifr from 'exifr';
import L from 'leaflet';

// CSS Imports
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import '../index.css';

// Project Components & Services
import Sidebar from './Sidebar';
import Dashboard from './Dashboard';
import { runGESAnalysis, fetchNearestSubstationKm, fetchGridLines, haversineKm } from '../services/analysisEngine';

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
        drawnItems.addLayer(e.layer);
        if (e.layerType === 'polygon') onPolygonDrawn(e.layer.getLatLngs()[0]);
      });
      // Removing DELETED handler hook mapped to nullification to support multiple layers
      map.on(L.Draw.Event.DELETED, () => {
         // handle deletion externally or ignore
      });
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

// ── Grid Lines Overlay ────────────────────────────────────────────────────────
const GridLinesOverlay = ({ lines }) => {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    if (!lines || lines.length === 0) return;

    const group = L.layerGroup();
    lines.forEach(line => {
      let color = '#3b82f6';
      let weight = 2;
      let dashArray = null;

      if (line.voltage === '154000' || line.voltage === '154') {
        color = '#ea580c'; // turuncu
        weight = 4;
      } else if (line.voltage === '33000' || line.voltage === '33') {
        color = '#9333ea'; // mor
        weight = 3;
      } else if (line.voltage) {
        color = '#facc15'; // yellow
      }

      L.polyline(line.latlngs, { color, weight, dashArray })
        .bindPopup(`<b>Enerji Hattı</b><br/>Voltaj: ${line.voltage ? line.voltage + 'V' : 'Bilinmiyor'}`)
        .addTo(group);
    });
    group.addTo(map);
    layerRef.current = group;

    return () => { if (layerRef.current) map.removeLayer(layerRef.current); };
  }, [lines, map]);

  return null;
}

// Drawn polygon overlay (user-drawn blue dashed)
const MultiPolygonOverlay = ({ polygons }) => {
  const map = useMap();
  const layerRef = useRef(null);
  useEffect(() => {
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    if (!polygons || polygons.length === 0) return;
    const group = L.layerGroup();
    polygons.forEach((poly, idx) => {
      L.polygon(poly, {
        color: idx === 0 ? '#3b82f6' : '#8b5cf6', // first blue, next purple
        weight: 3,
        fillColor: '#3b82f6',
        fillOpacity: 0.2,
      }).addTo(group);
    });
    group.addTo(map);
    layerRef.current = group;
    return () => { map.removeLayer(group); };
  }, [polygons, map]);
  return null;
};



// ── Substation Overlay (API + Manual) ─────────────────────────────────────────
const SubstationOverlay = ({ isManualMode, onManualSelect, manualPoint, apiSubstation, centerPoint }) => {
  const map = useMap();
  
  useEffect(() => {
    if (isManualMode) {
      map._container.style.cursor = 'crosshair';
    } else {
      map._container.style.cursor = '';
    }
  }, [isManualMode, map]);

  useMapEvents({
    click(e) {
      if (isManualMode) onManualSelect(e.latlng);
    }
  });

  const layerRef = useRef(null);
  useEffect(() => {
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }

    const group = L.layerGroup();
    let hasContent = false;

    // API-found substation marker (yellow/amber)
    if (apiSubstation && apiSubstation.lat && apiSubstation.lng && !manualPoint) {
      const apiIcon = L.divIcon({
        className: 'bg-transparent',
        html: `<div style="background:#f59e0b; width:18px; height:18px; border-radius:50%; border:3px solid white; box-shadow:0 0 8px rgba(245,158,11,0.7); display:flex; align-items:center; justify-content:center;">
                 <span style="font-size:10px;">⚡</span>
               </div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });
      L.marker([apiSubstation.lat, apiSubstation.lng], { icon: apiIcon })
        .bindPopup(`<b>🔌 ${apiSubstation.name || 'Trafo Merkezi'}</b><br/>Mesafe: ${apiSubstation.km} km`)
        .addTo(group);
      
      if (centerPoint) {
        L.polyline([centerPoint, [apiSubstation.lat, apiSubstation.lng]], { 
          color: '#f59e0b', weight: 2, dashArray: '6, 4', opacity: 0.8 
        }).addTo(group);
      }
      hasContent = true;
    }

    // Manual substation marker (red)
    if (manualPoint && centerPoint) {
      const manualIcon = L.divIcon({
        className: 'bg-transparent',
        html: `<div style="background:#ef4444; width:16px; height:16px; border-radius:50%; border:2px solid white; box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      L.marker(manualPoint, { icon: manualIcon })
        .bindPopup('<b>📍 Manuel Trafo</b>')
        .addTo(group);
      L.polyline([centerPoint, manualPoint], { color: '#ef4444', weight: 3, dashArray: '5, 5' }).addTo(group);
      hasContent = true;
    }

    if (hasContent) {
      group.addTo(map);
      layerRef.current = group;
    }

    return () => { if (layerRef.current) map.removeLayer(layerRef.current); }
  }, [apiSubstation, manualPoint, centerPoint, map]);

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

// ── Drone Image Overlay Component (with Drag/Scale Alignment) ─────────────────
const DroneImageOverlay = ({ imageUrl, initialBounds, opacity, alignMode }) => {
  const map = useMap();
  const overlayRef = useRef(null);
  const handleGroupRef = useRef(null);
  const dragStateRef = useRef(null);
  // Live mutable corners: [SW, NW, NE, SE] as [lat, lng] arrays
  const cornersRef = useRef(null);

  // Build corner array from LatLngBounds
  const boundsToCorners = (b) => {
    if (!b) return null;
    const sw = b[0], ne = b[1];
    return [
      [sw[0], sw[1]], // SW
      [ne[0], sw[1]], // NW
      [ne[0], ne[1]], // NE
      [sw[0], ne[1]], // SE
    ];
  };

  // Recompute LatLngBounds from current corners
  const cornersToBounds = (corners) => {
    const lats = corners.map(c => c[0]);
    const lngs = corners.map(c => c[1]);
    return [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]];
  };

  // Create/recreate the overlay + auto-zoom to bounds
  useEffect(() => {
    if (overlayRef.current) { map.removeLayer(overlayRef.current); overlayRef.current = null; }
    if (handleGroupRef.current) { map.removeLayer(handleGroupRef.current); handleGroupRef.current = null; }
    if (!imageUrl || !initialBounds) return;

    cornersRef.current = boundsToCorners(initialBounds);

    const overlay = L.imageOverlay(imageUrl, initialBounds, { opacity, interactive: true });
    overlay.addTo(map);
    overlayRef.current = overlay;

    // Auto-zoom to ortofoto bounds immediately after adding to map
    try {
      map.fitBounds(L.latLngBounds(initialBounds), { padding: [40, 40], animate: true, maxZoom: 18 });
    } catch (_) {}

    return () => {
      if (overlayRef.current) { map.removeLayer(overlayRef.current); overlayRef.current = null; }
      if (handleGroupRef.current) { map.removeLayer(handleGroupRef.current); handleGroupRef.current = null; }
    };
  }, [imageUrl, map]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync opacity
  useEffect(() => {
    if (overlayRef.current) overlayRef.current.setOpacity(opacity);
  }, [opacity]);

  // Toggle alignment handles
  useEffect(() => {
    if (handleGroupRef.current) { map.removeLayer(handleGroupRef.current); handleGroupRef.current = null; }
    if (!alignMode || !overlayRef.current || !cornersRef.current) return;

    const group = L.featureGroup();
    const CORNER_LABELS = ['↙', '↖', '↗', '↘'];

    cornersRef.current.forEach((corner, idx) => {
      const handleIcon = L.divIcon({
        className: 'drone-handle',
        html: `<div class="drone-corner-handle">${CORNER_LABELS[idx]}</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const marker = L.marker(corner, { draggable: true, icon: handleIcon, zIndexOffset: 1000 });

      marker.on('drag', (e) => {
        const { lat, lng } = e.target.getLatLng();
        cornersRef.current[idx] = [lat, lng];

        // Corners: [SW(0), NW(1), NE(2), SE(3)]
        // When dragging one corner, update adjacent corners to maintain rectangle:
        // SW shares lat with SE, lng with NW
        // NW shares lat with NE, lng with SW
        // NE shares lat with NW, lng with SE
        // SE shares lat with SW, lng with NE
        const SHARED = {
          0: { latPeer: 3, lngPeer: 1 }, // SW: lat→SE, lng→NW
          1: { latPeer: 2, lngPeer: 0 }, // NW: lat→NE, lng→SW
          2: { latPeer: 1, lngPeer: 3 }, // NE: lat→NW, lng→SE
          3: { latPeer: 0, lngPeer: 2 }, // SE: lat→SW, lng→NE
        };
        const { latPeer, lngPeer } = SHARED[idx];
        cornersRef.current[latPeer] = [lat, cornersRef.current[latPeer][1]];
        cornersRef.current[lngPeer] = [cornersRef.current[lngPeer][0], lng];

        const newBounds = cornersToBounds(cornersRef.current);
        if (overlayRef.current) overlayRef.current.setBounds(newBounds);

        // Update all handle markers to current positions
        group.eachLayer((m) => {
          const mIdx = m._cornerIdx;
          if (mIdx !== undefined && mIdx !== idx) {
            m.setLatLng(cornersRef.current[mIdx]);
          }
        });
      });

      marker._cornerIdx = idx;
      marker.addTo(group);
    });

    // Drag entire overlay by clicking on the image
    const imgEl = overlayRef.current?._image;
    if (imgEl) {
      imgEl.style.cursor = 'move';

      const onMouseDown = (e) => {
        e.stopPropagation();
        map.dragging.disable();
        const startLatLng = map.mouseEventToLatLng(e);
        dragStateRef.current = { startLatLng, startCorners: cornersRef.current.map(c => [...c]) };

        const onMouseMove = (ev) => {
          if (!dragStateRef.current) return;
          const currentLatLng = map.mouseEventToLatLng(ev);
          const dLat = currentLatLng.lat - dragStateRef.current.startLatLng.lat;
          const dLng = currentLatLng.lng - dragStateRef.current.startLatLng.lng;
          cornersRef.current = dragStateRef.current.startCorners.map(c => [c[0] + dLat, c[1] + dLng]);
          const newBounds = cornersToBounds(cornersRef.current);
          if (overlayRef.current) overlayRef.current.setBounds(newBounds);
          group.eachLayer((m) => {
            const mIdx = m._cornerIdx;
            if (mIdx !== undefined) m.setLatLng(cornersRef.current[mIdx]);
          });
        };

        const onMouseUp = () => {
          dragStateRef.current = null;
          map.dragging.enable();
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      };

      imgEl.addEventListener('mousedown', onMouseDown);
    }

    group.addTo(map);
    handleGroupRef.current = group;
  }, [alignMode, map]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
};


// ── FitDroneBounds: zooms map to drone image bounds on trigger ────────────────
const FitDroneBounds = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (!bounds) return;
    try {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], animate: true, maxZoom: 18 });
    } catch (_) {}
  }, [bounds, map]);
  return null;
};

// ── MapCenterRef: tracks live map center in a REF (no state = no re-render loop) ────────
const MapCenterRef = ({ centerRef }) => {
  useMapEvents({
    moveend: (e) => { const c = e.target.getCenter(); centerRef.current = [c.lat, c.lng]; },
    zoomend: (e) => { const c = e.target.getCenter(); centerRef.current = [c.lat, c.lng]; },
  });
  return null;
};

export default function Analyzer({ onBack }) {
  const [activeLayer, setActiveLayer] = useState('standard');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const [gridLinesData, setGridLinesData] = useState(null);
  const [nearestSubstationKm, setNearestSubstationKm] = useState(null);
  const [isFetchingSubstation, setIsFetchingSubstation] = useState(false);

  // States for hidden map sync
  const [mapCenter, setMapCenter] = useState([39, 35]);
  const [mapBounds, setMapBounds] = useState(null);
  
  // Project Polygons (Multiple Parcels / Drawn polygons)
  const [projectPolygons, setProjectPolygons] = useState([]);

  // Manual substation state
  const [isManualSubstationMode, setIsManualSubstationMode] = useState(false);
  const [manualSubstationPoint, setManualSubstationPoint] = useState(null);
  const [substationWarning, setSubstationWarning] = useState(null);

  // Drone Ortofoto states
  const [droneImageUrl, setDroneImageUrl] = useState(null);
  const [droneBounds, setDroneBounds] = useState(null);   // computed once at upload time
  const [droneOpacity, setDroneOpacity] = useState(0.7);
  const [isFieldVerified, setIsFieldVerified] = useState(false);
  const [droneAlignMode, setDroneAlignMode] = useState(false);
  const [droneZoomTrigger, setDroneZoomTrigger] = useState(0);
  const droneInputRef = useRef(null);
  const gisInputRef = useRef(null);
  // Live map center tracked via ref (no state → no re-render → no flicker loop)
  const liveMapCenterRef = useRef([39, 35]);

  const handleDroneUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let displayUrl = null;
    let bounds = null;
    const isTiff = file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff') || file.type === 'image/tiff';

    console.log('[Ortofoto] Dosya:', file.name, file.type, (file.size / 1024 / 1024).toFixed(2) + 'MB', 'isTiff:', isTiff);

    // ─── GeoTIFF handling ───
    if (isTiff) {
      try {
        const GeoTIFF = await import('geotiff');
        const arrayBuffer = await file.arrayBuffer();
        const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
        const image = await tiff.getImage();

        // Read bounding box [minX, minY, maxX, maxY]
        const bbox = image.getBoundingBox();
        const width = image.getWidth();
        const height = image.getHeight();
        console.log('[Ortofoto] GeoTIFF bbox:', bbox, 'size:', width, 'x', height);

        if (bbox && bbox.length === 4) {
          let [minX, minY, maxX, maxY] = bbox;

          // Check if coordinates are in a projected CRS (values > 180 = not lat/lng degrees)
          if (Math.abs(minX) > 180 || Math.abs(maxX) > 180 || Math.abs(minY) > 90 || Math.abs(maxY) > 90) {
            const geoKeys = image.getGeoKeys();
            console.log('[Ortofoto] GeoKeys:', geoKeys);
            const epsg = geoKeys?.ProjectedCSTypeGeoKey || geoKeys?.GeographicTypeGeoKey;
            console.log('[Ortofoto] EPSG:', epsg);

            // Helper: Web Mercator (EPSG:3857) → WGS84
            const mercatorToWgs84 = (x, y) => {
              const lon = (x / 20037508.34) * 180;
              const lat = (Math.atan(Math.sinh((y / 20037508.34) * Math.PI)) * 180) / Math.PI;
              return [lat, lon];
            };

            // Helper: UTM → WGS84
            const utmToWgs84 = (easting, northing, z) => {
              const a = 6378137.0;
              const f = 1 / 298.257223563;
              const k0 = 0.9996;
              const e = Math.sqrt(2 * f - f * f);
              const e2 = e * e / (1 - e * e);
              const n = (a - a * (1 - f)) / (a + a * (1 - f));
              const A = a / (1 + n) * (1 + n * n / 4 + n * n * n * n / 64);
              const x = easting - 500000;
              const y = northing;
              const mu = y / (A * k0);
              const e1 = (1 - Math.sqrt(1 - e * e)) / (1 + Math.sqrt(1 - e * e));
              const phi1 = mu + (3 * e1 / 2 - 27 * e1 * e1 * e1 / 32) * Math.sin(2 * mu)
                + (21 * e1 * e1 / 16 - 55 * e1 * e1 * e1 * e1 / 32) * Math.sin(4 * mu)
                + (151 * e1 * e1 * e1 / 96) * Math.sin(6 * mu);
              const sinPhi = Math.sin(phi1);
              const cosPhi = Math.cos(phi1);
              const tanPhi = sinPhi / cosPhi;
              const N1 = a / Math.sqrt(1 - e * e * sinPhi * sinPhi);
              const T1 = tanPhi * tanPhi;
              const C1 = e2 * cosPhi * cosPhi;
              const R1 = a * (1 - e * e) / Math.pow(1 - e * e * sinPhi * sinPhi, 1.5);
              const D = x / (N1 * k0);
              const lat = phi1 - (N1 * tanPhi / R1) *
                (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * e2) * D * D * D * D / 24
                  + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * e2 - 3 * C1 * C1) * D * D * D * D * D * D / 720);
              const lon = (D - (1 + 2 * T1 + C1) * D * D * D / 6
                + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * e2 + 24 * T1 * T1) * D * D * D * D * D / 120) / cosPhi;
              return [lat * 180 / Math.PI, lon * 180 / Math.PI + (z * 6 - 183)];
            };

            let sw, ne;

            if (epsg === 3857 || epsg === 3785 || epsg === 900913) {
              // Web Mercator (Google Maps, OSM projection)
              sw = mercatorToWgs84(minX, minY);
              ne = mercatorToWgs84(maxX, maxY);
              console.log('[Ortofoto] ✅ Web Mercator (EPSG:3857) → WGS84:', sw, ne);
            } else {
              // Assume UTM
              let zone = 36;
              if (epsg && epsg >= 32600 && epsg <= 32660) zone = epsg - 32600;
              sw = utmToWgs84(minX, minY, zone);
              ne = utmToWgs84(maxX, maxY, zone);
              console.log('[Ortofoto] ✅ UTM → WGS84:', sw, ne, 'Zone:', zone);
            }

            bounds = [sw, ne];
          } else {
            // Already in geographic coordinates (degrees)
            bounds = [[minY, minX], [maxY, maxX]];
            console.log('[Ortofoto] ✅ WGS84 bounds:', bounds);
          }
        }

        // Render TIFF to canvas for display (browsers can't show .tif in <img>)
        // Read at reduced resolution for performance
        const maxDim = 2048;
        const scale = Math.min(1, maxDim / Math.max(width, height));
        const rWidth = Math.round(width * scale);
        const rHeight = Math.round(height * scale);

        console.log('[Ortofoto] Canvas render başlıyor:', rWidth, 'x', rHeight);
        const rasters = await image.readRasters({
          width: rWidth,
          height: rHeight,
          interleave: false,
        });

        const canvas = document.createElement('canvas');
        canvas.width = rWidth;
        canvas.height = rHeight;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(rWidth, rHeight);

        const numBands = rasters.length;
        for (let i = 0; i < rWidth * rHeight; i++) {
          if (numBands >= 3) {
            imgData.data[i * 4] = rasters[0][i];     // R
            imgData.data[i * 4 + 1] = rasters[1][i]; // G
            imgData.data[i * 4 + 2] = rasters[2][i]; // B
            imgData.data[i * 4 + 3] = numBands >= 4 ? rasters[3][i] : 255; // A
          } else {
            // Grayscale
            const v = rasters[0][i];
            imgData.data[i * 4] = v;
            imgData.data[i * 4 + 1] = v;
            imgData.data[i * 4 + 2] = v;
            imgData.data[i * 4 + 3] = 255;
          }
        }
        ctx.putImageData(imgData, 0, 0);

        displayUrl = await new Promise(resolve => canvas.toBlob(blob => resolve(URL.createObjectURL(blob)), 'image/png'));
        console.log('[Ortofoto] ✅ Canvas render tamamlandı');

      } catch (err) {
        console.error('[Ortofoto] GeoTIFF okuma hatası:', err);
      }
    }

    // ─── Regular image (JPEG/PNG) with EXIF GPS ───
    if (!isTiff || !bounds) {
      if (!bounds) {
        try {
          const gps = await exifr.gps(file);
          if (gps && gps.latitude != null && gps.longitude != null) {
            const ext = 0.004;
            bounds = [[gps.latitude - ext, gps.longitude - ext], [gps.latitude + ext, gps.longitude + ext]];
            console.log('[Ortofoto] ✅ EXIF GPS:', gps.latitude, gps.longitude);
          }
        } catch (_) {}
      }
      if (!displayUrl) displayUrl = URL.createObjectURL(file);
    }

    // Fallback bounds: polygon or map center
    if (!bounds) {
      if (projectPolygons && projectPolygons.length > 0) {
        const allLats = projectPolygons.flatMap(poly => poly.map(p => p.lat));
        const allLngs = projectPolygons.flatMap(poly => poly.map(p => p.lng));
        bounds = [[Math.min(...allLats), Math.min(...allLngs)], [Math.max(...allLats), Math.max(...allLngs)]];
        console.log('[Ortofoto] ⚠️ Polygon sınırına yerleştiriliyor');
      } else {
        const [clat, clng] = liveMapCenterRef.current;
        const ext = 0.003;
        bounds = [[clat - ext, clng - ext], [clat + ext, clng + ext]];
        console.warn('[Ortofoto] ⚠️ Harita merkezine yerleştiriliyor');
      }
    }

    console.log('[Ortofoto] 📍 Sonuç bounds:', bounds);

    setDroneBounds(bounds);
    setDroneImageUrl(displayUrl);
    setIsFieldVerified(false);
    setDroneAlignMode(false);
    setDroneZoomTrigger(prev => prev + 1);
    if (droneInputRef.current) droneInputRef.current.value = '';
  };

  const clearDrone = () => {
    if (droneImageUrl) URL.revokeObjectURL(droneImageUrl);
    setDroneImageUrl(null);
    setDroneBounds(null);
    setDroneZoomTrigger(0);
    setIsFieldVerified(false);
    setDroneAlignMode(false);
    if (droneInputRef.current) droneInputRef.current.value = '';
  };


  const layers = { dem: activeLayer === 'dem', slope: activeLayer === 'slope', aspect: activeLayer === 'aspect' };

  const handleLayerToggle = (id) =>
    setActiveLayer(prev => (prev === id ? 'standard' : id));

  const handleRunAnalysis = useCallback(async (polygons) => {
    console.log('[handleRunAnalysis] called with', polygons?.length, 'polygons');
    if (!polygons || polygons.length === 0) {
      setAnalysisResult(null);
      setNearestSubstationKm(null);
      setGridLinesData(null);
      setMapBounds(null);
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    setNearestSubstationKm(null);
    setGridLinesData(null);
    setIsFetchingSubstation(true);
    setIsManualSubstationMode(false);
    setManualSubstationPoint(null);
    setSubstationWarning(null);

    const allLats = polygons.flatMap(poly => poly.map(p => p.lat));
    const allLngs = polygons.flatMap(poly => poly.map(p => p.lng));
    const centerLat = (Math.min(...allLats) + Math.max(...allLats)) / 2;
    const centerLng = (Math.min(...allLngs) + Math.max(...allLngs)) / 2;
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
      const [gesResult, substationResult, gridLinesResult] = await Promise.allSettled([
        runGESAnalysis(polygons),
        fetchNearestSubstationKm(centerLat, centerLng, 15000, (msg) => {
          setSubstationWarning(msg);
          setTimeout(() => setSubstationWarning(null), 6000);
        }),
        fetchGridLines(centerLat, centerLng, 15000)
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

      if (gridLinesResult.status === 'fulfilled') {
        setGridLinesData(gridLinesResult.value);
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

    setProjectPolygons(prev => {
      const newPolys = [...prev, latlngs];
      handleRunAnalysis(newPolys);
      return newPolys;
    });
  }, [handleRunAnalysis]);

  const handleGISUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    console.log('[GIS Upload] Dosya:', file.name, file.size, 'bytes');
    const text = await file.text();
    let newPolys = [];
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.kml')) {
      console.log('[GIS Upload] KML parse başlıyor...');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "text/xml");
      const coordsNodes = xmlDoc.getElementsByTagName("coordinates");
      console.log('[GIS Upload] coordinates tag sayısı:', coordsNodes.length);
      for (let i = 0; i < coordsNodes.length; i++) {
        const coordsText = coordsNodes[i].textContent.trim();
        const coordsArray = coordsText.split(/[\s\n\r]+/).filter(s => s.length > 0);
        const poly = [];
        for (const pair of coordsArray) {
           const parts = pair.split(',').map(Number);
           const lng = parts[0], lat = parts[1];
           if (!isNaN(lat) && !isNaN(lng)) poly.push({ lat, lng });
        }
        console.log('[GIS Upload] KML polygon', i, '→', poly.length, 'nokta');
        if (poly.length >= 3) newPolys.push(poly);
      }
    } else {
      // geojson
      console.log('[GIS Upload] GeoJSON parse başlıyor...');
      try {
        const json = JSON.parse(text);
        const features = json.type === 'FeatureCollection' ? json.features : (json.type === 'Feature' ? [json] : [{ geometry: json }]);
        for (const f of features) {
          const geom = f.geometry;
          if (!geom) continue;
          if (geom.type === 'Polygon') {
             newPolys.push(geom.coordinates[0].map(([lng, lat]) => ({ lat, lng })));
          } else if (geom.type === 'MultiPolygon') {
             for (const poly of geom.coordinates) {
               newPolys.push(poly[0].map(([lng, lat]) => ({ lat, lng })));
             }
          }
        }
        console.log('[GIS Upload] GeoJSON →', newPolys.length, 'polygon bulundu');
      } catch (err) { console.error('[GIS Upload] GeoJSON parse error:', err); }
    }
    
    console.log('[GIS Upload] Toplam yeni polygon:', newPolys.length);
    if (newPolys.length > 0) {
      const updatedPolys = [...projectPolygons, ...newPolys];
      setProjectPolygons(updatedPolys);
      handleRunAnalysis(updatedPolys);
    } else {
      console.warn('[GIS Upload] Hiç polygon bulunamadı! Dosya formatını kontrol edin.');
    }
    if (gisInputRef.current) gisInputRef.current.value = '';
  };

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

        {projectPolygons.length > 0 && (
          <button
            onClick={() => { setProjectPolygons([]); handleRunAnalysis([]); }}
            className="absolute top-4 right-20 md:right-4 z-[1000] flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 bg-red-600/90 backdrop-blur-md text-white rounded-lg shadow-lg hover:bg-red-500 transition-all font-bold text-xs"
          >
            <X size={14} /> Tüm Alanları Temizle
          </button>
        )}

        {/* Floating Notifications */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000] flex flex-col gap-2 pointer-events-none">
          {substationWarning && (
            <div className="bg-yellow-500/90 text-black px-4 py-2 rounded-lg shadow-[0_0_15px_rgba(234,179,8,0.5)] font-bold text-sm animate-in fade-in slide-in-from-top-4 pointer-events-auto flex items-center gap-2">
               <ShieldAlert size={16}/> {substationWarning}
            </div>
          )}
          {isManualSubstationMode && (
            <div className="bg-blue-600/90 text-white px-4 py-2 rounded-lg shadow-[0_0_15px_rgba(37,99,235,0.5)] font-bold text-sm animate-in fade-in slide-in-from-top-4 pointer-events-auto flex items-center gap-2">
               Trafo konumunu harita üzerinde tıklayarak işaretleyin. 
               <button onClick={() => setIsManualSubstationMode(false)} className="ml-2 bg-black/20 hover:bg-black/40 px-2 py-0.5 rounded text-xs transition-colors">İptal</button>
            </div>
          )}
        </div>

        {/* Drone Upload & Opacity Controls */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2">
          <input type="file" accept="image/*,.tif,.tiff" ref={droneInputRef} className="hidden" onChange={handleDroneUpload} />
          <button
            onClick={() => droneInputRef.current?.click()}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg shadow-lg transition-all ${droneImageUrl
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/30'
                : 'bg-slate-900/80 backdrop-blur-md text-white border border-slate-700/50 hover:bg-slate-800'
              }`}
          >
            <Upload size={14} /> {droneImageUrl ? 'Ortofoto Yüklendi' : 'Drone Ortofoto Yükle'}
          </button>
          {droneImageUrl && (
            <>
              <button
                onClick={() => setDroneAlignMode(prev => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg shadow-lg transition-all ${
                  droneAlignMode
                    ? 'bg-amber-500 text-black shadow-amber-500/30 hover:bg-amber-400'
                    : 'bg-slate-900/80 backdrop-blur-md text-white border border-slate-700/50 hover:bg-slate-800'
                }`}
              >
                {droneAlignMode ? '🔓 Kilitle' : '📐 Hizala'}
              </button>
              <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-lg px-2.5 py-1.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Opaklık</span>
                <input
                  type="range" min="0" max="100" value={Math.round(droneOpacity * 100)}
                  onChange={(e) => setDroneOpacity(Number(e.target.value) / 100)}
                  className="w-20 h-1 accent-amber-500 cursor-pointer"
                />
                <span className="text-[10px] text-amber-400 font-mono w-8">{Math.round(droneOpacity * 100)}%</span>
              </div>
              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/80 backdrop-blur-md text-white text-[11px] uppercase tracking-wider font-bold rounded-lg border border-slate-700/50 cursor-pointer hover:bg-slate-800 transition-all">
                <input type="checkbox" checked={isFieldVerified} onChange={(e) => setIsFieldVerified(e.target.checked)} className="accent-emerald-500 w-3.5 h-3.5"/>
                Saha Görsel Teyidi
              </label>
              {/* Remove ortofoto button */}
              <button
                onClick={clearDrone}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-red-600/80 hover:bg-red-500 text-white text-xs font-bold rounded-lg shadow-lg transition-all hover:scale-105"
                title="Ortofoyu kaldır"
              >
                <X size={13} /> Kaldır
              </button>
            </>
          )}
          <input type="file" accept=".kml,.geojson,.json,.KML,.GeoJSON" ref={gisInputRef} className="hidden" onChange={handleGISUpload} />
          <button
            onClick={() => gisInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/90 backdrop-blur-md hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-lg transition-all"
          >
            <Upload size={14} /> GIS (.kml, .geojson)
          </button>
        </div>

        <div className="flex-1 h-full relative" id="aura-map-container">
          {isAnalyzing && (
            <div className="absolute inset-0 z-[2000] bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center">
              <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(245,158,11,0.5)]"></div>
              <p className="text-white font-bold tracking-wider animate-pulse">CBS Verileri Çözümleniyor...</p>
              <p className="text-amber-400 text-xs mt-1">Satellite & Terrain Sync</p>
            </div>
          )}
          <MapContainer center={[39, 35]} zoom={6} scrollWheelZoom style={{ width: '100%', height: '100%' }}>
            <LayersControl position="bottomleft">
              <LayersControl.BaseLayer checked name="Uydu Görünümü">
                <TileLayer url={TILES.satellite.url} attribution={TILES.satellite.attr} maxZoom={19} />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Sokak Görünümü">
                <TileLayer url={TILES.standard.url} attribution={TILES.standard.attr} maxZoom={19} />
              </LayersControl.BaseLayer>
            </LayersControl>
            <ChangeView center={mapCenter} bounds={mapBounds ? L.latLngBounds(mapBounds) : null} />
            <DynamicTile layer={activeLayer} />
            <DrawControl onPolygonDrawn={(latlngs) => { 
                if (latlngs) {
                   setProjectPolygons(prev => {
                     const upd = [...prev, latlngs];
                     handleRunAnalysis(upd);
                     return upd;
                   });
                }
            }} />
            <AnalysisOverlay points={analysisResult?.points} />
            <GridLinesOverlay lines={gridLinesData?.lines} />
            <MultiPolygonOverlay polygons={projectPolygons} />
            <MapCenterRef centerRef={liveMapCenterRef} />
            <SubstationOverlay 
              isManualMode={isManualSubstationMode} 
              onManualSelect={(latlng) => {
                setIsManualSubstationMode(false);
                setManualSubstationPoint(latlng);
                const d = haversineKm(mapCenter[0], mapCenter[1], latlng.lat, latlng.lng);
                setNearestSubstationKm({ km: +d.toFixed(2), lat: latlng.lat, lng: latlng.lng, name: 'Manuel Trafo' });
              }} 
              manualPoint={manualSubstationPoint}
              apiSubstation={nearestSubstationKm}
              centerPoint={mapCenter} 
            />
            {droneImageUrl && droneBounds && (
              <>
                <DroneImageOverlay imageUrl={droneImageUrl} initialBounds={droneBounds} opacity={droneOpacity} alignMode={droneAlignMode} />
                <FitDroneBounds bounds={droneZoomTrigger > 0 ? droneBounds : null} key={droneZoomTrigger} />
              </>
            )}
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
                      <MultiPolygonOverlay polygons={projectPolygons} />
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
            isFieldVerified={isFieldVerified}
            droneActive={!!droneImageUrl}
            gridLinesData={gridLinesData}
            onManualSubstationClick={() => {
              setIsManualSubstationMode(true);
              setSubstationWarning(null);
            }}
          />
      </main>
    </div>
  );
}