import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTests() {
  console.log('=== RoadGuard AI Integration Tests ===\n');

  // 1. Health check test
  console.log('[Test 1] Testing /api/health...');
  try {
    const healthRes = await fetch('http://localhost:3001/api/health');
    const healthData = await healthRes.json();
    console.log('Health Status:', healthRes.status, JSON.stringify(healthData, null, 2));
  } catch (err: any) {
    console.error('Health check failed:', err.message);
  }

  // 2. Sample listing test
  console.log('\n[Test 2] Testing /api/samples...');
  try {
    const sampleRes = await fetch('http://localhost:3001/api/samples');
    const sampleData = await sampleRes.json();
    console.log('Samples count:', sampleData.samples?.length);
  } catch (err: any) {
    console.error('Sample listing failed:', err.message);
  }

  // 3. Image Detection on Real Dataset Image
  console.log('\n[Test 3] Testing /api/detect with a real road image...');
  const sampleImgPath = path.join(__dirname, 'test/images/101_jpg.rf.4cf8c0e3bc616a30cd2a39be2bfbf8f2.jpg');
  if (fs.existsSync(sampleImgPath)) {
    const imgBuffer = fs.readFileSync(sampleImgPath);
    const formData = new FormData();
    const blob = new Blob([imgBuffer], { type: 'image/jpeg' });
    formData.append('image', blob, '101_jpg.jpg');

    const detectRes = await fetch('http://localhost:3001/api/detect?confidence=20', {
      method: 'POST',
      body: formData
    });

    console.log('Detection Status:', detectRes.status);
    const detectData = await detectRes.json();
    console.log('Detection Summary:', {
      success: detectData.success,
      predictionsFound: detectData.predictions?.length,
      analytics: detectData.analytics,
      firstPrediction: detectData.predictions?.[0] ? {
        class: detectData.predictions[0].class,
        confidence: detectData.predictions[0].confidence,
        severity: detectData.predictions[0].severity,
        polygonVertices: detectData.predictions[0].points?.length
      } : null
    });
  } else {
    console.log('Sample image not found at', sampleImgPath);
  }

  console.log('\n=== Tests Finished ===');
}

runTests();
