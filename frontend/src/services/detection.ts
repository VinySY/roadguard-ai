import { DetectionResult, BoundingBox, SeverityLevel } from '../types';
import { getApiUrl } from '../config/api';

export interface DetectionOptions {
  confidenceThreshold?: number;
  overlapThreshold?: number;
  modelEndpoint?: string;
  apiKey?: string;
}

/**
 * Normalizes detection class string (e.g. "pothole" -> "Pothole")
 */
function formatClassName(className?: string): string {
  if (!className) return 'Pothole';
  const trimmed = className.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Maps server/model severity to frontend SeverityLevel
 */
function mapSeverity(serverSeverity?: string, confidence = 0.8): SeverityLevel {
  const s = (serverSeverity || '').toLowerCase();
  if (s === 'critical') return 'critical';
  if (s === 'high') return 'high';
  if (s === 'moderate' || s === 'medium') return 'medium';
  if (s === 'minor' || s === 'low') return 'low';
  if (confidence >= 0.85) return 'critical';
  if (confidence >= 0.65) return 'high';
  return 'medium';
}

/**
 * Converts any image source (File, Blob, base64 data URL, blob URL, sample URL)
 * into a FormData object suitable for POST /api/detect.
 */
async function buildImageFormData(imageSource: File | Blob | string): Promise<FormData> {
  const formData = new FormData();

  if (imageSource instanceof File) {
    formData.append('image', imageSource, imageSource.name || 'road_upload.jpg');
    return formData;
  }

  if (imageSource instanceof Blob) {
    formData.append('image', imageSource, 'road_upload.jpg');
    return formData;
  }

  if (typeof imageSource === 'string') {
    // 1. Data URL or Blob URL
    if (imageSource.startsWith('data:') || imageSource.startsWith('blob:')) {
      const res = await fetch(imageSource);
      const blob = await res.blob();
      formData.append('image', blob, 'road_upload.jpg');
      return formData;
    }

    // 2. Relative or absolute HTTP URL (e.g. /src/assets/images/... or /api/samples/...)
    if (imageSource.startsWith('http://') || imageSource.startsWith('https://') || imageSource.startsWith('/')) {
      const res = await fetch(imageSource);
      const blob = await res.blob();
      const filename = imageSource.split('/').pop() || 'sample.jpg';
      formData.append('image', blob, filename);
      return formData;
    }

    // 3. Raw sample filename from test dataset (e.g. 101_jpg.rf...)
    formData.append('sampleFilename', imageSource);
    return formData;
  }

  throw new Error('Unsupported image source type for road detection.');
}

/**
 * Analyzes an image for road surface distress / potholes.
 * Connects directly to backend /api/detect (which runs the Roboflow YOLOv11 model).
 */
export async function detectPotholesInImage(
  imageSource: File | Blob | string,
  options: DetectionOptions = {}
): Promise<DetectionResult> {
  const formData = await buildImageFormData(imageSource);

  const confidence = options.confidenceThreshold !== undefined ? Math.round(options.confidenceThreshold) : 20;
  const overlap = options.overlapThreshold !== undefined ? Math.round(options.overlapThreshold) : 30;

  const url = getApiUrl(`/api/detect?confidence=${confidence}&overlap=${overlap}`);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      body: formData,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Network error';
    throw new Error(`Could not connect to RoadGuard detection backend (${url}): ${msg}`);
  }

  if (!response.ok) {
    let errorDetails = `HTTP ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      errorDetails = errJson.error || errJson.message || errJson.details || errorDetails;
    } catch {
      // not JSON
    }
    throw new Error(`Road detection service error: ${errorDetails}`);
  }

  const json = await response.json();
  const predictions = json.predictions || [];
  const imageWidth = json.image?.width || 640;
  const imageHeight = json.image?.height || 640;

  // Convert Roboflow bounding box coordinates (center-based pixels) to normalized [0, 1] top-left coordinates
  const boxes: BoundingBox[] = predictions.map((p: any, idx: number) => {
    const rawX = typeof p.x === 'number' ? p.x : 0;
    const rawY = typeof p.y === 'number' ? p.y : 0;
    const rawW = typeof p.width === 'number' ? p.width : 0;
    const rawH = typeof p.height === 'number' ? p.height : 0;

    // Center to top-left in original pixel space
    const leftPx = rawX - rawW / 2;
    const topPx = rawY - rawH / 2;

    // Normalized [0, 1] bounds
    const normLeft = Math.max(0, Math.min(1, leftPx / imageWidth));
    const normTop = Math.max(0, Math.min(1, topPx / imageHeight));
    const normW = Math.max(0, Math.min(1 - normLeft, rawW / imageWidth));
    const normH = Math.max(0, Math.min(1 - normTop, rawH / imageHeight));

    const boxSeverity = mapSeverity(p.severity, p.confidence);

    return {
      id: p.id || `pothole-${idx + 1}`,
      x: normLeft,
      y: normTop,
      width: normW,
      height: normH,
      confidence: Math.round((p.confidence || 0) * 100) / 100,
      class: formatClassName(p.class),
      points: Array.isArray(p.points) ? p.points : null,
      severity: boxSeverity,
      rawX,
      rawY,
      rawWidth: rawW,
      rawHeight: rawH,
      imageWidth,
      imageHeight,
    };
  });

  const count = boxes.length;
  const avgConfidence = count > 0
    ? Math.round((boxes.reduce((acc, b) => acc + b.confidence, 0) / count) * 100) / 100
    : 0;

  // Determine overall severity
  let severity: SeverityLevel = 'low';
  if (json.analytics?.overallRiskLevel) {
    const risk = json.analytics.overallRiskLevel.toLowerCase();
    severity = risk === 'critical' ? 'critical' : risk === 'high' ? 'high' : risk === 'medium' ? 'medium' : 'low';
  } else if (count >= 3 || boxes.some((b) => b.severity === 'critical')) {
    severity = 'critical';
  } else if (count >= 2 || boxes.some((b) => b.severity === 'high')) {
    severity = 'high';
  } else if (count === 1) {
    severity = boxes[0]?.severity || 'medium';
  }

  // Calculate road condition index (0 - 100)
  const roadConditionIndex = json.analytics?.damagePercentage !== undefined
    ? Math.max(5, Math.min(100, Math.round(100 - json.analytics.damagePercentage * 3.5)))
    : Math.max(10, Math.min(100, Math.round(100 - count * 22)));

  const recommendedAction =
    count === 0
      ? 'No immediate roadway repair needed — pavement surface clear'
      : severity === 'critical'
      ? 'Urgent emergency cold-mix remediation required'
      : severity === 'high'
      ? 'Priority scheduling for asphalt surface patching'
      : 'Routine pavement maintenance log';

  const previewUrl = typeof imageSource === 'string' ? imageSource : undefined;

  return {
    potholeCount: count,
    severity,
    confidence: avgConfidence,
    boxes,
    imageUrl: previewUrl,
    image: { width: imageWidth, height: imageHeight },
    analytics: json.analytics,
    location: json.location || null,
    processedAt: new Date().toISOString(),
    roadConditionIndex,
    recommendedAction,
  };
}

/**
 * Analyzes a video for roadway surface distress / potholes.
 * Sends video to backend /api/detect/video endpoint via FormData.
 */
export async function detectPotholesInVideo(
  videoSource: File | Blob | string,
  options: DetectionOptions = {}
): Promise<DetectionResult> {
  const formData = new FormData();
  let previewUrl: string | undefined;

  if (videoSource instanceof File) {
    formData.append('video', videoSource, videoSource.name || 'road_inspection.webm');
  } else if (videoSource instanceof Blob) {
    formData.append('video', videoSource, 'road_inspection.webm');
  } else if (typeof videoSource === 'string') {
    previewUrl = videoSource;
    const res = await fetch(videoSource);
    const blob = await res.blob();
    formData.append('video', blob, 'road_inspection.webm');
  } else {
    throw new Error('Video source must be a valid video file or recording blob.');
  }

  const confidence = options.confidenceThreshold !== undefined ? Math.round(options.confidenceThreshold) : 20;
  const url = getApiUrl(`/api/detect/video?confidence=${confidence}`);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      body: formData,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Network error';
    throw new Error(`Could not connect to video detection service (${url}): ${msg}`);
  }

  if (!response.ok) {
    let errorDetails = `HTTP ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      errorDetails = errJson.error || errJson.message || errJson.details || errorDetails;
    } catch {
      // not JSON
    }
    throw new Error(`Video detection service error: ${errorDetails}`);
  }

  const json = await response.json();
  const totalDetections = json.analytics?.uniquePotholeCount ?? json.analytics?.totalDetections ?? 0;
  const worstRisk = json.analytics?.worstRiskLevel || json.overall_risk || 'MEDIUM';
  const severity = mapSeverity(worstRisk);

  const videoMeta = json.video || {};
  const defaultWidth = videoMeta.width || 640;
  const defaultHeight = videoMeta.height || 360;

  // Process all frame predictions into timestamped VideoFrameDetection records
  const videoFrames = (json.frames || []).map((f: any) => {
    const fWidth = f.image?.width || defaultWidth;
    const fHeight = f.image?.height || defaultHeight;
    const rawPredictions = f.predictions || [];

    const frameBoxes: BoundingBox[] = rawPredictions.map((p: any, idx: number) => {
      const rawX = typeof p.x === 'number' ? p.x : 0;
      const rawY = typeof p.y === 'number' ? p.y : 0;
      const rawW = typeof p.width === 'number' ? p.width : 0;
      const rawH = typeof p.height === 'number' ? p.height : 0;

      const leftPx = rawX - rawW / 2;
      const topPx = rawY - rawH / 2;

      return {
        id: p.id || `video-f${f.frameIndex}-p${idx + 1}`,
        x: Math.max(0, Math.min(1, leftPx / fWidth)),
        y: Math.max(0, Math.min(1, topPx / fHeight)),
        width: Math.max(0, Math.min(1, rawW / fWidth)),
        height: Math.max(0, Math.min(1, rawH / fHeight)),
        confidence: Math.round((p.confidence || 0.85) * 100) / 100,
        class: formatClassName(p.class),
        points: Array.isArray(p.points) ? p.points : null,
        severity: mapSeverity(p.severity, p.confidence),
        rawX,
        rawY,
        rawWidth: rawW,
        rawHeight: rawH,
        imageWidth: fWidth,
        imageHeight: fHeight,
      };
    });

    return {
      frameIndex: f.frameIndex,
      timestamp: typeof f.timestamp === 'number' ? f.timestamp : 0,
      boxes: frameBoxes,
    };
  });

  // Extract all boxes across frames or from primary frame
  const framesWithDetections = videoFrames.filter((f) => f.boxes.length > 0);
  const primaryFrame = framesWithDetections[0] || videoFrames[0];
  const primaryBoxes = primaryFrame?.boxes || [];

  const avgConfidence = json.analytics?.maxConfidence || 0.85;

  return {
    potholeCount: totalDetections,
    severity,
    confidence: Math.round(avgConfidence * 100) / 100,
    boxes: primaryBoxes,
    videoUrl: previewUrl,
    videoFrames,
    video: {
      filename: videoMeta.filename,
      duration: videoMeta.duration,
      width: defaultWidth,
      height: defaultHeight,
      fps: videoMeta.fps,
    },
    image: { width: defaultWidth, height: defaultHeight },
    processedAt: new Date().toISOString(),
    roadConditionIndex: Math.max(15, Math.round(100 - totalDetections * 18)),
    recommendedAction:
      totalDetections === 0
        ? 'No road defects detected across video frames'
        : severity === 'critical'
        ? 'Urgent municipal field dispatch required for transit corridor'
        : 'Priority field inspection queued for defect locations',
    analytics: {
      totalDetected: totalDetections,
      uniquePotholeCount: totalDetections,
      maxConfidence: avgConfidence,
      damagePercentage: json.analytics?.avgDamagePercentage || json.analytics?.averageDamagePercentage || 0,
      overallRiskLevel: worstRisk,
    },
  };
}
