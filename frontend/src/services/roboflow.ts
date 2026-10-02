import { DetectionResult, SampleImage, ServerHealth } from '../types/detection';
import { getApiUrl } from '../config/api';

export interface DetectOptions {
  confidence?: number;
  overlap?: number;
}

export async function detectPotholes(
  source: { file?: File; sampleFilename?: string },
  options: DetectOptions = {}
): Promise<DetectionResult> {
  const formData = new FormData();
  
  if (source.file) {
    formData.append('image', source.file);
  } else if (source.sampleFilename) {
    formData.append('sampleFilename', source.sampleFilename);
  } else {
    throw new Error('No valid road image provided for detection.');
  }

  const queryParams = new URLSearchParams();
  if (options.confidence !== undefined) {
    // Normalizing confidence: if passed as e.g. 25, can send both or 0.25
    queryParams.set('confidence', options.confidence.toString());
  }
  if (options.overlap !== undefined) {
    queryParams.set('overlap', options.overlap.toString());
  }

  const queryString = queryParams.toString();
  const url = getApiUrl(`/api/detect${queryString ? `?${queryString}` : ''}`);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      body: formData,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Network error';
    throw new Error(`Failed to reach backend service at ${url}. Please ensure the RoadGuard backend is running: ${errorMsg}`);
  }

  if (!response.ok) {
    let errorDetails = `HTTP ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      errorDetails = errJson.error || errJson.message || errJson.details || errorDetails;
    } catch {
      // not json
    }
    throw new Error(errorDetails);
  }

  const data: DetectionResult = await response.json();
  data.timestamp = Date.now();
  data.sourceName = source.file ? source.file.name : source.sampleFilename || 'Road-Capture';
  return data;
}

export async function checkServerHealth(): Promise<ServerHealth> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    const response = await fetch(getApiUrl('/api/health'), { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`Health check returned ${response.status}`);
    }
    return await response.json();
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export async function fetchSampleImages(): Promise<SampleImage[]> {
  try {
    const response = await fetch(getApiUrl('/api/samples'));
    if (!response.ok) return [];
    const data = await response.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.samples)) return data.samples;
    return [];
  } catch {
    return [];
  }
}
