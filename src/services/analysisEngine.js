/**
 * AuraSol GES Analysis Engine - Professional & Verified
 */

const DEG = Math.PI / 180;

// API Keys from .env (Vite requires VITE_ prefix and import.meta.env)
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const NASA_KEY = import.meta.env.VITE_NASA_API_KEY;

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
  const lastYear = today.getFullYear() - 1;

  const url = `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude=${lng}&latitude=${lat}&format=JSON&start=${lastYear}&end=${lastYear}&api_key=${NASA_KEY}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('NASA API Hatası');
  const data = await res.json();
  
  const rawData = data.properties.parameter.ALLSKY_SFC_SW_DWN;
  const monthlySolar = [];

  for (let i = 1; i <= 12; i++) {
    const key = `${lastYear}${i.toString().padStart(2, '0')}`;
    const value = rawData[key] > 0 ? rawData[key] : 4.6; // fallback if -999 representing missing data
    monthlySolar.push({
      month: i,
      monthName: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'][i-1],
      kWhM2Day: value,
      kWhM2Month: Math.round(value * 30.4)
    });
  }
  
  // Key "13" in NASA POWER monthly point data represents the annual average
  const annualAvgDaily = rawData[`${lastYear}13`] > 0 ? rawData[`${lastYear}13`] : 4.6;
  const annualTotal = Math.round(annualAvgDaily * 365);

  return { annualTotal, monthlySolar };
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

export async function fetchEsriLandCover(lat, lng) {
  try {
    const geom = JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } });
    const url = `https://ic.imagery1.arcgis.com/arcgis/rest/services/Sentinel2_10m_LandCover/ImageServer/identify?geometryType=esriGeometryPoint&geometry=${encodeURIComponent(geom)}&f=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.value ? parseInt(data.value, 10) : null;
  } catch (e) {
    console.error("Land Cover API Hatası:", e);
    return null;
  }
}

// Full land cover lookup covering both Esri 1-10 AND ESA/LCCS 10-100 class codes
const LC_TYPES = {
  // Esri Sentinel-2 10m classes (1-10)
  1: { label: 'Su Alanı', penalty: 0, level: 'blocked' },
  2: { label: 'Orman', penalty: 0, level: 'blocked' },
  3: { label: 'Çayır/Mera', penalty: 1, level: 'ideal' },
  4: { label: 'Sulak Alan', penalty: 0, level: 'blocked' },
  5: { label: 'Tarım Alanı (Cropland)', penalty: 1, level: 'warning' },
  6: { label: 'Çalılık/Maki', penalty: 1, level: 'ideal' },
  7: { label: 'Yerleşim/Kentsel', penalty: 1, level: 'info' },
  8: { label: 'Çıplak Toprak', penalty: 1, level: 'ideal' },
  9: { label: 'Kar/Buz', penalty: 0, level: 'blocked' },
  10: { label: 'Bulut / Veri Yok', penalty: 1, level: 'info' },
  11: { label: 'Yağmurla Beslenen Tarım (Tarla)', penalty: 1, level: 'warning', costImpactPct: 5 },
  // ESA WorldCover / LCCS / GlobeCover classes (10-100 range)
  14: { label: 'Ağaçlık Tarım Alanı', penalty: 1, level: 'warning', costImpactPct: 5 },
  20: { label: 'Sulama Tarımı / Pirinllik', penalty: 1, level: 'warning', costImpactPct: 5 },
  30: { label: 'Mera / Otlak', penalty: 1, level: 'info' },
  40: { label: 'Bodur Bitki / Çalılık', penalty: 1, level: 'ideal' },
  50: { label: 'Kentsel / Yapılı Alan', penalty: 1, level: 'info' },
  60: { label: 'Seyrek Bitki Ortası', penalty: 1, level: 'ideal' },
  70: { label: 'Kar / Buz', penalty: 0, level: 'blocked' },
  80: { label: 'Seyrek Bitki / Çıplak Toprak', penalty: 1, level: 'ideal' },
  90: { label: 'Sulak Alan / Bataaklık', penalty: 0, level: 'blocked' },
  100: { label: 'Yosun / Liken Alanı', penalty: 1, level: 'info' },
};

const MEVZUAT_NOTLARI = {
  blocked: { banner: 'bg-red-500/10 border-red-500/30 text-red-300', icon: '❌', prefix: 'YASAK', text: 'YEDİNCİ SINIF ARAZİ / KORUMA ALANI. GES kurulumu mevzuat gereği yapılamaz.' },
  warning: { banner: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300', icon: '⚠️', prefix: 'UYARI', text: 'Tarım arazisi tespiti. Tarım dışı kullanım izni alınması gerekmektedir.' },
  info:    { banner: 'bg-blue-500/10 border-blue-500/30 text-blue-300', icon: 'ℹ️', prefix: 'BİLGİ', text: 'Mera / yerleşim arazisi tespiti. Vasıf değişikliği süreci gerekebilir.' },
  ideal:   { banner: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300', icon: '✅', prefix: 'İDEAL', text: 'Düşuk verimli arazi tespiti. İzin süreçleri için avantajlı.' },
};

function getLandCoverStatus(val) {
  if (val === null || val === undefined) return { type: 'Bilinmiyor', label: 'Bilinmiyor', penalty: 1, level: 'info', costImpactPct: 0, rawVal: null };
  const v = Number(val);
  const entry = LC_TYPES[v];
  if (!entry) return { type: `Sınıf ${v}`, label: `Sınıf ${v}`, penalty: 1, level: 'info', costImpactPct: 0, rawVal: v };
  return { type: entry.label, label: entry.label, penalty: entry.penalty, level: entry.level, costImpactPct: entry.costImpactPct || 0, rawVal: v };
}

function getMevzuatNotu(level) {
  return MEVZUAT_NOTLARI[level] || null;
}

function inferSoilConsistency(slope, lcVal) {
  if (lcVal === null || lcVal === undefined) return 'Bilinmiyor';
  const v = Number(lcVal);
  const hardTypes = [6, 7, 8, 40, 50, 60, 80];
  const softTypes = [3, 5, 11, 14, 20, 30];
  if (slope > 10 && hardTypes.includes(v)) return 'Kayalık/Sert Zemin';
  if (slope < 10 && softTypes.includes(v)) return 'Gevşek/Yumuşak Toprak';
  return 'Orta Derece/Karma Zemin';
}

// ── Ana Analiz Motoru ─────────────────────────────────────────────────────────

export async function runGESAnalysis(latlngs) {
  const area = geodesicAreaM2(latlngs);
  const perimeter = perimeterM(latlngs);
  const avgLat = latlngs.reduce((s, p) => s + p.lat, 0) / latlngs.length;
  const avgLng = latlngs.reduce((s, p) => s + p.lng, 0) / latlngs.length;

  if (area > 20000000) throw new Error('Seçilen alan çok büyük (Maks 20km²).');

  const N = area < 50000 ? 7 : area < 200000 ? 8 : area < 1000000 ? 9 : 11;
  const { grid, allCoords, latStep, lngStep } = buildGrid(latlngs, N);

  const [elevations, nasaData, landCoverVal] = await Promise.all([
    fetchElevations(allCoords),
    fetchNASAData(avgLat, avgLng),
    fetchEsriLandCover(avgLat, avgLng)
  ]);
  
  const NASA_SOLAR = nasaData.annualTotal;
  const monthlySolar = nasaData.monthlySolar;

  const E = Array.from({ length: N }, (_, i) =>
    Array.from({ length: N }, (_, j) => elevations[i * N + j] ?? 0)
  );

  const mPerLat = 111320;
  const mPerLng = 111320 * Math.cos(avgLat * DEG);
  const dy = latStep * mPerLat;
  const dx = lngStep * mPerLng;

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

  const avgSlope = +(points.reduce((s, p) => s + p.slopeDeg, 0) / points.length).toFixed(1);
  const landCover = getLandCoverStatus(landCoverVal);
  const soilConsistency = inferSoilConsistency(avgSlope, landCoverVal);
  const mevzuatNotu = getMevzuatNotu(landCover.level);

  return {
    totalAreaM2: Math.round(area),
    totalAreaHa: (area / 10000).toFixed(2),
    perimeterM: Math.round(perimeter),
    avgElevationM: Math.round(points.reduce((s, p) => s + p.elevation, 0) / points.length),
    suitableAreaM2: Math.round(suitableAreaM2),
    suitableAreaHa: (suitableAreaM2 / 10000).toFixed(2),
    suitableRatioPct: +(suitableRatio * 100).toFixed(1),
    northPct: +(points.filter(p => p.mask === 'north').length / points.length * 100).toFixed(1),
    steepPct: +(points.filter(p => p.mask === 'steep').length / points.length * 100).toFixed(1),
    shadowPct: +(points.filter(p => p.mask === 'shadow').length / points.length * 100).toFixed(1),
    pointCount: points.length,
    avgAspectDeg: points.filter(p => p.suitable).length ? Math.round(points.filter(p => p.suitable).reduce((s, p) => s + p.aspectDeg, 0) / points.filter(p => p.suitable).length) : null,
    avgSlopeDeg: avgSlope,
    avgSolarKWhM2: NASA_SOLAR,
    monthlySolar,
    capacityMW: +(suitableAreaM2 / 10000).toFixed(2),
    landCover,
    soilConsistency,
    mevzuatNotu,
    points,
  };
}