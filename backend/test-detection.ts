import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'http://localhost:3001';

async function runTests() {
  console.log('====================================================');
  console.log('       RoadGuard AI — Full Phase 3 Integration Tests');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  // 1. Health check test
  console.log('[Test 1] GET /api/health');
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    const data = await res.json();
    console.log(`  Status: ${res.status}`);
    console.log(`  API Key: ${data.apiKeyConfigured ? '✓' : '✗'}`);
    console.log(`  Model Reachable: ${data.modelReachable ? '✓' : '✗'}`);
    console.log(`  DB Status: ${data.database?.connected ? 'connected' : 'disconnected'}`);
    if (res.status === 200 && data.status === 'ok') passed++;
    else failed++;
  } catch (err: any) {
    console.error('  Failed:', err.message);
    failed++;
  }

  // 2. DB Health check test
  console.log('\n[Test 2] GET /api/db/health');
  try {
    const res = await fetch(`${BASE_URL}/api/db/health`);
    const data = await res.json();
    console.log(`  Status: ${res.status}`);
    console.log(`  DB Status: ${data.status} (${data.database})`);
    if (res.status === 200 && (data.status === 'connected' || data.status === 'disconnected')) passed++;
    else failed++;
  } catch (err: any) {
    console.error('  Failed:', err.message);
    failed++;
  }

  // 3. Samples listing
  console.log('\n[Test 3] GET /api/samples');
  let sampleFilename = '';
  try {
    const res = await fetch(`${BASE_URL}/api/samples`);
    const data = await res.json();
    console.log(`  Status: ${res.status}`);
    console.log(`  Samples found: ${data.samples?.length || 0}`);
    if (data.samples?.length > 0) {
      sampleFilename = data.samples[0].filename;
      console.log(`  Sample #1: ${sampleFilename}`);
    }
    if (res.status === 200 && Array.isArray(data.samples)) passed++;
    else failed++;
  } catch (err: any) {
    console.error('  Failed:', err.message);
    failed++;
  }

  // 4. Sample image static file serve
  console.log('\n[Test 4] GET /api/samples/:filename');
  try {
    if (sampleFilename) {
      const res = await fetch(`${BASE_URL}/api/samples/${sampleFilename}`);
      console.log(`  Status: ${res.status} (Content-Type: ${res.headers.get('content-type')})`);
      if (res.status === 200) passed++;
      else failed++;
    } else {
      console.log('  Skipped: no sample available');
    }
  } catch (err: any) {
    console.error('  Failed:', err.message);
    failed++;
  }

  // 5. Image Detection on Real Dataset Image (FormData)
  console.log('\n[Test 5] POST /api/detect (Multipart file upload)');
  const sampleImgPath = path.join(__dirname, 'test/images/101_jpg.rf.4cf8c0e3bc616a30cd2a39be2bfbf8f2.jpg');
  try {
    if (fs.existsSync(sampleImgPath)) {
      const imgBuffer = fs.readFileSync(sampleImgPath);
      const formData = new FormData();
      const blob = new Blob([imgBuffer], { type: 'image/jpeg' });
      formData.append('image', blob, '101_jpg.jpg');

      const res = await fetch(`${BASE_URL}/api/detect?confidence=20`, {
        method: 'POST',
        body: formData,
      });

      console.log(`  Status: ${res.status}`);
      const data = await res.json();
      console.log('  Success:', data.success);
      console.log('  Predictions:', data.predictions?.length);
      console.log('  Analytics:', data.analytics);
      if (data.predictions?.[0]) {
        console.log('  Prediction #1:', {
          class: data.predictions[0].class,
          confidence: Number(data.predictions[0].confidence.toFixed(4)),
          severity: data.predictions[0].severity,
          polygonVertices: data.predictions[0].points?.length,
        });
      }
      console.log('  Persistence:', data.persistence);
      if (res.status === 200 && data.success === true) passed++;
      else failed++;
    } else {
      console.log('  Sample image not found at', sampleImgPath);
      failed++;
    }
  } catch (err: any) {
    console.error('  Failed:', err.message);
    failed++;
  }

  // 6. Image Detection via sampleFilename body
  console.log('\n[Test 6] POST /api/detect (sampleFilename in JSON body)');
  try {
    if (sampleFilename) {
      const res = await fetch(`${BASE_URL}/api/detect?confidence=20`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleFilename }),
      });

      console.log(`  Status: ${res.status}`);
      const data = await res.json();
      console.log('  Success:', data.success);
      console.log('  Predictions:', data.predictions?.length);
      if (res.status === 200 && data.success === true) passed++;
      else failed++;
    }
  } catch (err: any) {
    console.error('  Failed:', err.message);
    failed++;
  }

  // 7. GET /api/inspections
  console.log('\n[Test 7] GET /api/inspections');
  try {
    const res = await fetch(`${BASE_URL}/api/inspections?limit=10&offset=0`);
    console.log(`  Status: ${res.status}`);
    const data = await res.json();
    console.log(`  Response:`, data);
    if (res.status === 200 || res.status === 503) passed++;
    else failed++;
  } catch (err: any) {
    console.error('  Failed:', err.message);
    failed++;
  }

  // 8. GET /api/issues
  console.log('\n[Test 8] GET /api/issues');
  try {
    const res = await fetch(`${BASE_URL}/api/issues?status=Reported`);
    console.log(`  Status: ${res.status}`);
    const data = await res.json();
    console.log(`  Response:`, data);
    if (res.status === 200 || res.status === 503) passed++;
    else failed++;
  } catch (err: any) {
    console.error('  Failed:', err.message);
    failed++;
  }

  // 9. POST /api/issues (Input validation test with invalid payload)
  console.log('\n[Test 9] POST /api/issues (Validation: invalid payload)');
  try {
    const res = await fetch(`${BASE_URL}/api/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'InvalidCategory',
        description: '',
        severity: 'extreme', // invalid severity
        latitude: 999, // out of range
        longitude: -999, // out of range
      }),
    });
    console.log(`  Status: ${res.status} (expected 400 Bad Request)`);
    const data = await res.json();
    console.log(`  Validation errors caught:`, data.details?.length || 0);
    if (res.status === 400 && data.error === 'Validation failed') passed++;
    else failed++;
  } catch (err: any) {
    console.error('  Failed:', err.message);
    failed++;
  }

  // 10. POST /api/issues (Valid payload structure check)
  console.log('\n[Test 10] POST /api/issues (Valid payload structure)');
  try {
    const res = await fetch(`${BASE_URL}/api/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'Pothole',
        description: 'Large pothole near main intersection causing traffic slowdowns',
        severity: 'high',
        latitude: 19.0760,
        longitude: 72.8777,
        status: 'Reported',
      }),
    });
    console.log(`  Status: ${res.status} (201 if DB connected, 503 if DB disconnected)`);
    if (res.status === 201 || res.status === 503) passed++;
    else failed++;
  } catch (err: any) {
    console.error('  Failed:', err.message);
    failed++;
  }

  // 11. PATCH /api/issues/:id/status (Validation check)
  console.log('\n[Test 11] PATCH /api/issues/1/status (Invalid status validation)');
  try {
    const res = await fetch(`${BASE_URL}/api/issues/1/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'InvalidStatus' }),
    });
    console.log(`  Status: ${res.status} (expected 400 Bad Request)`);
    if (res.status === 400) passed++;
    else failed++;
  } catch (err: any) {
    console.error('  Failed:', err.message);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('====================================================\n');
}

runTests();

