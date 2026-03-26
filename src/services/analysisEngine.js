/**
 * AuraSol GES Analysis Engine - Professional & Verified
 */

const DEG = Math.PI / 180;

// API Keys from .env
const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;
const NASA_KEY = process.env.REACT_APP_NASA_API_KEY;

// ── Geometry Helpers ──────────────────────────────────────────────────────────

export function geodesicAreaM2(latlngs) {
  const R = 6371000;
  let area = 0;
  for (let i = 0; i < latlngs.length; i++) {
    const j = (i + 1) % latlngs.length;
    const lat1 = latlngs[i].lat * DEG;
    const lat2 = latlngs[j].lat * DEG;
    const dLon = (latlngs[j].lng - latlngs[i].lng) * DEG;
    area += dLon * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  return Math.abs(area * R * R / 2);
}

export function perimeterM(latlngs) {
  let total = 0;
  for (let i = 0; i < latlngs.length; i++) {
    const a = latlngs[i], b = latlngs[(i + 1) % latlngs.length];
    const R = 6371000;
    const dLat = (b.lat - a.lat) * DEG;
    const dLon = (b.lng - a.lng) * DEG;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLon / 2) ** 2;
    total += 2 * R * Math.asin(Math.sqrt(h));
  }
  return total;
}

function pointInPolygon(lat, lng, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].lat, yi = poly[i].lng;
    const xj = poly[j].lat, yj = poly[j].lng;
    if ((yi > lng) !== (yj > lng) && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

// ── Grid Builder ──────────────────────────────────────────────────────────────

function buildGrid(latlngs, N) {
  const lats = latlngs.map(p => p.lat);
  const lngs = latlngs.map(p => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const latStep = (maxLat - minLat) / Math.max(N - 1, 1);
  const lngStep = (maxLng - minLng) / Math.max(N - 1, 1);

  const grid = [];
  const allCoords = [];
  for (let i = 0; i < N; i++) {
    grid[i] = [];
    for (let j = 0; j < N; j++) {
      const lat = minLat + i * latStep;
      const lng = minLng + j * lngStep;
      grid[i][j] = { lat, lng, inside: pointInPolygon(lat, lng, latlngs) };
      allCoords.push({ lat, lng });
    }
  }
  return { grid, allCoords, latStep, lngStep };
}

// ── API Entegrasyonları (Gerçek Veri) ─────────────────────────────────────────

export async function fetchElevationMapbox(lat, lng) {
  const url = `https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/tilequery/${lng},${lat}.json?layers=contour&radius=500&limit=50&access_token=${MAPBOX_TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Mapbox Elevation Hatası');
  const data = await res.json();
  const elevations = data.features?.map(f => f.properties.ele).filter(e => e !== undefined);
  return (elevations && elevations.length > 0) ? elevations[0] : 0;
}

export async function fetchNASAData(lat, lng) {
  const today = new Date();
  const lastYear = new Date();
  lastYear.setFullYear(today.getFullYear() - 1);
  const formatDate = (d) => d.toISOString().split('T')[0].replace(/-/g, '');

  const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude=${lng}&latitude=${lat}&start=${formatDate(lastYear)}&end=${formatDate(today)}&format=JSON&api_key=${NASA_KEY}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('NASA API Hatası');
  const data = await res.json();
  const values = Object.values(data.properties.parameter.ALLSKY_SFC_SW_DWN);
  const validValues = values.filter(v => v > 0);
  const avgDaily = validValues.length > 0 ? validValues.reduce((s, v) => s + v, 0) / validValues.length : 4.6;
  return Math.round(avgDaily * 365);
}

async function fetchElevations(coords) {
  return Promise.all(coords.map(c => fetchElevationMapbox(c.lat, c.lng)));
}

// ── Topoğrafik Analiz (Matematiksel) ──────────────────────────────────────────

function hillshade(slopeDeg, aspectDeg, sunElevDeg, sunAzimDeg) {
  const sr = slopeDeg * DEG, ar = aspectDeg * DEG;
  const zr = (90 - sunElevDeg) * DEG, azr = sunAzimDeg * DEG;
  return 255 * Math.max(0, Math.cos(zr) * Math.cos(sr) + Math.sin(zr) * Math.sin(sr) * Math.cos(azr - ar));
}

export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * DEG;
  const dLng = (lng2 - lng1) * DEG;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

export async function fetchNearestSubstationKm(centerLat, centerLng, radiusM = 15000) {
  const query = `[out:json][timeout:25];(node["power"="substation"](around:${radiusM},${centerLat},${centerLng});way["power"="substation"](around:${radiusM},${centerLat},${centerLng});relation["power"="substation"](around:${radiusM},${centerLat},${centerLng}););out center;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query)
  });
  if (!res.ok) throw new Error('Overpass API Hatası');
  const data = await res.json();
  const elements = data.elements ?? [];
  if (elements.length === 0) return null;

  let minKm = Infinity;
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) continue;
    const d = haversineKm(centerLat, centerLng, lat, lng);
    if (d < minKm) minKm = d;
  }
  return minKm === Infinity ? null : +minKm.toFixed(2);
}

// ── Ana Analiz Motoru ─────────────────────────────────────────────────────────

export async function runGESAnalysis(latlngs) {
  const area = geodesicAreaM2(latlngs);
  const perimeter = perimeterM(latlngs);
  const avgLat = latlngs.reduce((s, p) => s + p.lat, 0) / latlngs.length;
  const avgLng = latlngs.reduce((s, p) => s + p.lng, 0) / latlngs.length;

  if (area > 5000000) throw new Error('Seçilen alan çok büyük (Maks 5km²).');

  const N = area < 50000 ? 7 : area < 200000 ? 8 : area < 1000000 ? 9 : 10;
  const { grid, allCoords, latStep, lngStep } = buildGrid(latlngs, N);

  const elevations = await fetchElevations(allCoords);
  const E = Array.from({ length: N }, (_, i) =>
    Array.from({ length: N }, (_, j) => elevations[i * N + j] ?? 0)
  );

  const mPerLat = 111320;
  const mPerLng = 111320 * Math.cos(avgLat * DEG);
  const dy = latStep * mPerLat;
  const dx = lngStep * mPerLng;

  const NASA_SOLAR = await fetchNASAData(avgLat, avgLng);
  const points = [];

  for (let i = 1; i < N - 1; i++) {
    for (let j = 1; j < N - 1; j++) {
      if (!grid[i][j].inside) continue;

      const eN = E[i + 1][j], eS = E[i - 1][j], eE = E[i][j + 1], eW = E[i][j - 1];
      const dzdy = (eN - eS) / (2 * dy);
      const dzdx = (eE - eW) / (2 * dx);

      const slopeDeg = Math.atan(Math.sqrt(dzdx ** 2 + dzdy ** 2)) / DEG;
      let aspectDeg = (90 - Math.atan2(-dzdy, -dzdx) / DEG + 360) % 360;

      const hsWinter = hillshade(slopeDeg, aspectDeg, 25.5, 180);
      const hsAnnual = hillshade(slopeDeg, aspectDeg, 47, 180);

      const isNorth = aspectDeg < 45 || aspectDeg > 315;
      const isSteep = slopeDeg > 15;
      const mask = isNorth ? 'north' : isSteep ? 'steep' : (hsWinter < 55 ? 'shadow' : null);

      const optimalTilt = 90 - 47;
      const incidencePenalty = Math.cos((Math.abs(slopeDeg - optimalTilt)) * DEG);
      const corrRadiation = mask ? 0 : Math.max(0, NASA_SOLAR * incidencePenalty * (hsAnnual / 255));

      points.push({
        lat: grid[i][j].lat,
        lng: grid[i][j].lng,
        elevation: E[i][j],
        slopeDeg: +slopeDeg.toFixed(1),
        aspectDeg: +aspectDeg.toFixed(0),
        hsWinter: +hsWinter.toFixed(0),
        mask,
        suitable: !mask,
        corrRadiation: +corrRadiation.toFixed(0),
      });
    }
  }

  const suitable = points.filter(p => p.suitable);
  const suitableRatio = suitable.length / points.length;
  const suitableAreaM2 = area * suitableRatio;

  return {
    totalAreaM2: Math.round(area),
    totalAreaHa: (area / 10000).toFixed(2),
    perimeterM: Math.round(perimeter),
    avgElevationM: Math.round(points.reduce((s, p) => s + p.elevation, 0) / points.length),
    suitableAreaM2: Math.round(suitableAreaM2),
    suitableAreaHa: (suitableAreaM2 / 10000).toFixed(2),
    suitableRatioPct: +(suitableRatio * 100).toFixed(1),
    avgSlopeDeg: +(points.reduce((s, p) => s + p.slopeDeg, 0) / points.length).toFixed(1),
    avgSolarKWhM2: NASA_SOLAR,
    capacityMW: +(suitableAreaM2 / 10000).toFixed(2),
    points,
  };
}