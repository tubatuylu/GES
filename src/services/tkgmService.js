/**
 * TKGM Megsis (v3) API Service
 * Turkish Land Registry and Cadastre Parcel Inquiry
 *
 * Fetch Strategy (3-tier, most reliable first):
 *   1. Local Vite dev proxy  → /tkgm-api/...  (no CORS, works in `npm run dev`)
 *   2. corsproxy.io          → public proxy
 *   3. allorigins.win        → last resort
 */

const TKGM_BASE = 'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3/api';

// ─── Tier 1: Direct (might work if CORS is disabled or in some environments) ─
async function fetchDirect(endpoint) {
  const res = await fetch(`${TKGM_BASE}${endpoint}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Tier 2: Local Vite proxy (rewrites /tkgm-api → TKGM base) ────────────
async function fetchLocal(endpoint) {
  const res = await fetch(`/tkgm-api${endpoint}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Tier 3: corsproxy.io ─────────────────────────────────────────────────
async function fetchCorsproxy(endpoint) {
  const target = encodeURIComponent(`${TKGM_BASE}${endpoint}`);
  const res = await fetch(`https://corsproxy.io/?${target}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Tier 4: Codetabs Proxy ───────────────────────────────────────────────
async function fetchCodetabs(endpoint) {
  const target = encodeURIComponent(`${TKGM_BASE}${endpoint}`);
  const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${target}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Tier 5: allorigins.win (Last resort) ──────────────────────────────────
async function fetchAllOrigins(endpoint) {
  const target = encodeURIComponent(`${TKGM_BASE}${endpoint}`);
  const res = await fetch(`https://api.allorigins.win/get?url=${target}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const wrapper = await res.json();
  if (!wrapper.contents) throw new Error('Empty response from allorigins');
  return JSON.parse(wrapper.contents);
}

// ─── Smart fetch with sequential fallback ─────────────────────────────────
async function tkgmFetch(endpoint) {
  const strategies = [
    { name: 'local-proxy', fn: () => fetchLocal(endpoint) },
    { name: 'direct',      fn: () => fetchDirect(endpoint) },
    { name: 'corsproxy',   fn: () => fetchCorsproxy(endpoint) },
    { name: 'codetabs',    fn: () => fetchCodetabs(endpoint) },
    { name: 'allorigins',  fn: () => fetchAllOrigins(endpoint) },
  ];

  let errors = [];
  for (const { name, fn } of strategies) {
    try {
      console.log(`[TKGM] Trying strategy: ${name} for ${endpoint}`);
      const data = await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 25000)
        ),
      ]);
      console.log(`[TKGM] ${name} success!`);
      return data;
    } catch (err) {
      console.warn(`[TKGM] ${name} failed:`, err.message);
      errors.push(`${name}: ${err.message}`);
      // Small pause before next strategy
      await new Promise(r => setTimeout(r, 400));
    }
  }
  throw new Error(`TKGM API'ye hiçbir yöntemle erişilemedi. Hatalar: ${errors.join(' | ')}`);
}

// ─── Public API ─────────────────────────────────────────────────────────────
export const tkgmService = {
  /** Returns [{ id, ad }] for all 81 provinces */
  async getCities() {
    const data = await tkgmFetch('/idariYapi/ilListe');
    const features = data.features || data || [];
    return features.map(f => ({
      id: f.properties?.id ?? f.id,
      ad: f.properties?.text ?? f.ad ?? f.properties?.ad,
    })).filter(f => f.id && f.ad);
  },

  /** Returns [{ id, ad }] for districts of a given city */
  async getDistricts(cityId) {
    const data = await tkgmFetch(`/idariYapi/ilceListe/${cityId}`);
    const features = data.features || data || [];
    return features.map(f => ({
      id: f.properties?.id ?? f.id,
      ad: f.properties?.text ?? f.ad ?? f.properties?.ad,
    })).filter(f => f.id && f.ad);
  },

  /** Returns [{ id, ad }] for neighborhoods of a given district */
  async getNeighborhoods(districtId) {
    const data = await tkgmFetch(`/idariYapi/mahalleListe/${districtId}`);
    const features = data.features || data || [];
    return features.map(f => ({
      id: f.properties?.id ?? f.id,
      ad: f.properties?.text ?? f.ad ?? f.properties?.ad,
    })).filter(f => f.id && f.ad);
  },

  /**
   * Fetches the GeoJSON Feature for a land parcel.
   * @returns Full GeoJSON Feature with geometry and properties
   */
  async getParcelGeometry(mahalleId, ada, parsel) {
    let data;
    try {
      // Parcel endpoint can hang on non-existent parcels → give it 25s
      data = await Promise.race([
        tkgmFetch(`/parsel/${mahalleId}/${ada}/${parsel}`),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('PARCEL_NOT_FOUND')), 25000)
        ),
      ]);
    } catch (err) {
      if (err.message === 'PARCEL_NOT_FOUND' || err.message === 'timeout') {
        throw new Error(`Ada ${ada}, Parsel ${parsel} bulunamadı. Ada/parsel numaralarını kontrol edin.`);
      }
      throw err;
    }

    // Megsis v3 may return a FeatureCollection or a single Feature
    let feature = data;
    if (data?.type === 'FeatureCollection') {
      feature = data.features?.[0];
    }

    if (!feature || !feature.geometry) {
      throw new Error(`Ada ${ada}, Parsel ${parsel} bulunamadı veya geometri verisi yok.`);
    }

    return feature;
  },
};
