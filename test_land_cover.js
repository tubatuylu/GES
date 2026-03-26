import https from 'https';
import fs from 'fs';

function testEsriLandCover() {
  console.log('Testing Esri Land Cover API...');
  const lat = 41.0082;
  const lng = 28.9784;

  const geom = JSON.stringify({ "x": lng, "y": lat, "spatialReference": { "wkid": 4326 } });
  const url = `https://ic.imagery1.arcgis.com/arcgis/rest/services/Sentinel2_10m_LandCover/ImageServer/identify?geometryType=esriGeometryPoint&geometry=${encodeURIComponent(geom)}&f=json`;

  https.get(url, (res) => {
    console.log('Status:', res.statusCode);
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      fs.writeFileSync('out.json', data, 'utf-8');
      console.log('Saved to out.json');
    });
  }).on('error', (e) => {
    console.error('Error:', e.message);
  });
}

testEsriLandCover();
