
const MAPBOX_TOKEN = 'pk.eyJ1IjoidHViaWtlc2siLCJhIjoiY21uNzRrc212MGJjczJwc2R0ZHZxbzNsdiJ9.jQtPPkm-NVdOccME7TNyPw';

async function testNASA() {
  console.log('Testing NASA POWER API...');
  const lat = 41.0082;
  const lng = 28.9784;
  const today = new Date();
  const lastYear = new Date();
  lastYear.setFullYear(today.getFullYear() - 1);
  const formatDate = (d) => d.toISOString().split('T')[0].replace(/-/g, '');
  const start = formatDate(lastYear);
  const end = formatDate(today);

  const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude=${lng}&latitude=${lat}&start=${start}&end=${end}&format=JSON`;
  
  try {
    const res = await fetch(url);
    console.log('NASA Status:', res.status);
    const data = await res.json();
    console.log('NASA Data Sample (first 5 values):', Object.values(data.properties.parameter.ALLSKY_SFC_SW_DWN).slice(0, 5));
  } catch (e) {
    console.error('NASA Test Failed:', e.message);
  }
}

async function testMapbox() {
  console.log('\nTesting Mapbox Elevation API...');
  const lat = 41.0082;
  const lng = 28.9784;
  const url = `https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/tilequery/${lng},${lat}.json?layers=contour&radius=500&limit=50&access_token=${MAPBOX_TOKEN}`;
  
  try {
    const res = await fetch(url);
    console.log('Mapbox Status:', res.status);
    if (!res.ok) {
      const text = await res.text();
      console.log('Mapbox Error Body:', text);
    }
    const data = await res.json();
    console.log('Mapbox Feature Sample:', JSON.stringify(data.features?.[0], null, 2));
    console.log('Mapbox Elevation (ele):', data.features?.[0]?.properties?.ele);
  } catch (e) {
    console.error('Mapbox Test Failed:', e.message);
  }
}

async function testOverpass() {
  console.log('\nTesting Overpass POST API...');
  const lat = 41.0082;
  const lng = 28.9784;
  const query = `[out:json][timeout:25];(node["power"="substation"](around:15000,${lat},${lng}););out center;`;
  
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: 'data=' + encodeURIComponent(query)
    });
    console.log('Overpass Status:', res.status);
    const data = await res.json();
    console.log('Substations found:', data.elements.length);
  } catch (e) {
    console.error('Overpass Test Failed:', e.message);
  }
}

async function runTests() {
  await testNASA();
  await testMapbox();
  await testOverpass();
}

runTests();
