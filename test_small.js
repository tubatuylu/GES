import { runGESAnalysis } from './src/services/analysisEngine.js';

async function testSmall() {
  // Small polygon on Kaçkar north face
  const poly = [
    { lat: 40.835, lng: 41.160 },
    { lat: 40.840, lng: 41.160 },
    { lat: 40.840, lng: 41.165 },
    { lat: 40.835, lng: 41.165 },
  ];
  try {
    const res = await runGESAnalysis(poly);
    console.log(JSON.stringify({
      points: res.points,
      suitablePct: res.suitableRatioPct,
      northPct: res.northPct,
      steepPct: res.steepPct
    }, null, 2));
  } catch(e) { console.error(e); }
}

testSmall();
