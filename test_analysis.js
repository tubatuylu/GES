import fs from 'fs';
import { runGESAnalysis } from './src/services/analysisEngine.js';

async function test() {
  // Mock a polygon over Kaçkar Mountains (Rize)
  // Approx bounds: 40.8N, 41.1E to 40.9N, 41.2E
  const kackarPoly = [
    { lat: 40.81, lng: 41.11 },
    { lat: 40.89, lng: 41.11 },
    { lat: 40.89, lng: 41.21 },
    { lat: 40.81, lng: 41.21 },
  ];
  
  try {
    const res = await runGESAnalysis(kackarPoly);
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
