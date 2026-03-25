/**
 * GES Analysis Engine
 * 1. Fetches real SRTM elevation from Open-Meteo API
 * 2. Calculates slope/aspect with Horn's algorithm
 * 3. Applies masks: north-facing (0-45° & 315-360°), slope > 15°, terrain shadow
 * 4. Returns per-point results + aggregate stats
 */

const DEG = Math.PI / 180;

// ── Geometry helpers ──────────────────────────────────────────────────────────

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

// ── Grid builder ──────────────────────────────────────────────────────────────

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

// ── Elevation API ─────────────────────────────────────────────────────────────

async function fetchElevations(coords) {
  const lats = coords.map(c => Number(c.lat.toFixed(6)));
  const lngs = coords.map(c => Number(c.lng.toFixed(6)));
  
  const res = await fetch('https://api.open-meteo.com/v1/elevation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      latitude: lats,
      longitude: lngs
    })
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error('Elevation API error: ' + res.status + ' - ' + text);
  }
  const data = await res.json();
  return data.elevation ?? [];
}

// ── Terrain analytics ─────────────────────────────────────────────────────────

/**
 * Horn's slope/aspect from 3x3 kernel (standard north-up GIS convention).
 * kernel[0] = NORTH row, kernel[2] = SOUTH row, j increases eastward.
 */
function hornsMethod(kern, dx, dy) {
  const [[a, b, c], [d, , f], [g, h, ii]] = kern;
  const dzdx = ((c + 2 * f + ii) - (a + 2 * d + g)) / (8 * dx);
  const dzdy = ((g + 2 * h + ii) - (a + 2 * b + c)) / (8 * dy);

  const slopeDeg = Math.atan(Math.sqrt(dzdx ** 2 + dzdy ** 2)) / DEG;

  let aspectDeg = 0;
  if (Math.abs(dzdx) > 1e-6 || Math.abs(dzdy) > 1e-6) {
    // atan2 in standard math (CCW from east), convert to compass (CW from N)
    aspectDeg = (90 - Math.atan2(-dzdy, -dzdx) / DEG + 360) % 360;
  }
  return { slopeDeg, aspectDeg };
}

function hillshade(slopeDeg, aspectDeg, sunElevDeg, sunAzimDeg) {
  const sr = slopeDeg * DEG, ar = aspectDeg * DEG;
  const zr = (90 - sunElevDeg) * DEG, azr = sunAzimDeg * DEG;
  return 255 * Math.max(0, Math.cos(zr) * Math.cos(sr) + Math.sin(zr) * Math.sin(sr) * Math.cos(azr - ar));
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runGESAnalysis(latlngs) {
  const area = geodesicAreaM2(latlngs);
  const perimeter = perimeterM(latlngs);
  const avgLat = latlngs.reduce((s, p) => s + p.lat, 0) / latlngs.length;

  if (area > 5000000) {
    throw new Error('Seçilen alan çok büyük. Lütfen daha detaylı analiz için daha küçük bir alan çizin (Maksimum 500 hektar / 5 km²).');
  }

  // Max 10x10 grid to strictly comply with Open-Meteo 100 points limit
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

  const SUN_ELEV_ANNUAL = 47;
  const SUN_ELEV_WINTER = 25.5;
  const SUN_AZIM = 180;

  const points = [];

  for (let i = 1; i < N - 1; i++) {
    for (let j = 1; j < N - 1; j++) {
      if (!grid[i][j].inside) continue;

      const kern = [
        [E[i+1][j-1], E[i+1][j], E[i+1][j+1]],
        [E[i  ][j-1], E[i  ][j], E[i  ][j+1]],
        [E[i-1][j-1], E[i-1][j], E[i-1][j+1]],
      ];

      const { slopeDeg, aspectDeg } = hornsMethod(kern, dx, dy);

      const hsWinter = hillshade(slopeDeg, aspectDeg, SUN_ELEV_WINTER, SUN_AZIM);
      const hsAnnual = hillshade(slopeDeg, aspectDeg, SUN_ELEV_ANNUAL, SUN_AZIM);

      const isNorth   = aspectDeg < 45 || aspectDeg > 315;
      const isSteep   = slopeDeg > 15;
      const isShadow  = hsWinter < 55;

      const mask = isNorth ? 'north' : isSteep ? 'steep' : isShadow ? 'shadow' : null;

      const optimalTilt = 90 - SUN_ELEV_ANNUAL;
      const incidencePenalty = Math.cos((Math.abs(slopeDeg - optimalTilt)) * DEG);
      const corrRadiation = mask ? 0 : Math.max(0, 1700 * incidencePenalty * (hsAnnual / 255));

      points.push({
        lat: grid[i][j].lat,
        lng: grid[i][j].lng,
        elevation: E[i][j],
        slopeDeg:  +slopeDeg.toFixed(1),
        aspectDeg: +aspectDeg.toFixed(0),
        hsWinter:  +hsWinter.toFixed(0),
        mask,
        suitable:  !mask,
        corrRadiation: +corrRadiation.toFixed(0),
      });
    }
  }

  if (points.length === 0) throw new Error('Alan analiz için çok küçük.');

  const total     = points.length;
  const suitable  = points.filter(p => p.suitable);
  const northPts  = points.filter(p => p.mask === 'north');
  const steepPts  = points.filter(p => p.mask === 'steep');
  const shadowPts = points.filter(p => p.mask === 'shadow');

  const suitableRatio   = suitable.length / total;
  const suitableAreaM2  = area * suitableRatio;
  const avgElevation    = points.reduce((s, p) => s + p.elevation, 0) / total;
  const avgSlope        = points.reduce((s, p) => s + p.slopeDeg,  0) / total;
  const avgAspectSuit   = suitable.length
    ? suitable.reduce((s, p) => s + p.aspectDeg, 0) / suitable.length : null;
  const avgRadiation    = suitable.length
    ? suitable.reduce((s, p) => s + p.corrRadiation, 0) / suitable.length : 0;

  return {
    totalAreaM2:   Math.round(area),
    totalAreaHa:   (area / 10000).toFixed(2),
    perimeterM:    Math.round(perimeter),
    pointCount:    latlngs.length,
    avgElevationM: Math.round(avgElevation),
    suitableAreaM2:  Math.round(suitableAreaM2),
    suitableAreaHa:  (suitableAreaM2 / 10000).toFixed(2),
    suitableRatioPct: +(suitableRatio * 100).toFixed(1),
    northPct:  +((northPts.length  / total) * 100).toFixed(1),
    steepPct:  +((steepPts.length  / total) * 100).toFixed(1),
    shadowPct: +((shadowPts.length / total) * 100).toFixed(1),
    avgSlopeDeg:   +avgSlope.toFixed(1),
    avgAspectDeg:  avgAspectSuit ? Math.round(avgAspectSuit) : null,
    avgSolarKWhM2: Math.round(avgRadiation),
    capacityMW:    +(suitableAreaM2 / 10000).toFixed(2), 
    points,
  };
}
