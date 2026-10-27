# Video Detection Implementation Summary
**Date:** 2026-09-26  
**Status:** ✅ Complete and Working  

> **Update (2026-10-26):** counting was reworked to deduplicate synonym/overlapping
> predictions within each frame and to track potholes across frames with motion
> compensation. The old adjacent-frame IoU-only logic described below has been
> replaced. See `DETECTION_COUNTING_FIX.md` at the repository root for the current
> behaviour, settings, and verified results.

## Overview
Successfully implemented video pothole detection for RoadGuard AI, building on the existing Roboflow-based image detection infrastructure. The system uses manually installed FFmpeg 9.0.2 (confirmed working on Windows) to extract frames from videos and processes them through the same Roboflow instance segmentation model.

## Implementation Details

### 1. Files Created/Modified

**New Files:**
- `backend/server/routes/videoDetection.ts` - Complete video detection endpoint

**Modified Files:**
- `backend/server/index.ts` - Added video routes import
- `backend/package.json` - Already contained `fluent-ffmpeg` dependency (no changes needed)

**Files NOT Modified (Preserved Existing Functionality):**
- `backend/server/routes/dbRoutes.ts` - Existing inspection persistence unchanged
- `backend/server/db/persistence.ts` - Existing saveInspection/saveDetections reused
- `backend/server/db/pool.ts` - Database connection unchanged
- `backend/server/db/schema.sql` - Existing schema supports video inspections
- All existing image detection code - `/api/detect` remains fully functional

### 2. Database Structure
**No Schema Changes Required**

The existing schema already supports video inspections:
- **inspections table**: Stores both image and video inspections with `image_path: null` for videos (too large to persist)
- **detections table**: Stores all detections from video frames, linked to the parent inspection
- All video results are stored alongside image detections, no separate tables needed

### 3. New Endpoint
**POST `/api/detect/video`**

**Parameters:**
- `video` (required): Video file upload (MP4, WebM, MOV, AVI, MKV)
- `fps` (optional): Frames per second to extract (default: 1, range: 0.1-5)
- `confidence` (optional): Detection confidence threshold (default: 20)
- `overlap` (optional): Bounding box overlap threshold (default: 30)

**Response Structure:**
```json
{
  "success": true,
  "type": "video",
  "video": {
    "filename": "...",
    "duration": 3.0,
    "width": 1280,
    "height": 720,
    "fps": 25,
    "codec": "h264"
  },
  "processing": {
    "extractionFps": 1,
    "totalFrames": 3,
    "processedFrames": 3,
    "failedFrames": 0
  },
  "analytics": {
    "totalDetections": 18,
    "framesWithDetections": 3,
    "maxConfidence": 0.891,
    "avgDamagePercentage": 6.29,
    "overallRiskLevel": "CRITICAL"
  },
  "frames": [...],
  "persistence": {"saved": true, "inspectionId": 7}
}
```

### 4. Video Processing Pipeline

1. **Upload Validation**
   - Max file size: 50MB
   - Supported formats: MP4, WebM, MOV, AVI, MKV
   - MIME type and extension validation

2. **Metadata Extraction**
   - Uses `ffprobe` (via fluent-ffmpeg) to get:
     - Duration, resolution, FPS, codec
   - Calculates optimal frame extraction parameters

3. **Frame Extraction**
   - Uses system FFmpeg (installed manually)
   - Extracts frames at specified FPS (default: 1 frame/sec)
   - Limits to 60 frames by default (configurable via `maxFrames` or
     `MAX_VIDEO_FRAMES`, hard maximum 300)
   - Saves frames to temporary directory with session ID

4. **Frame Detection**
   - Each extracted frame sent to Roboflow `/outline` endpoint
   - Same model, confidence, and overlap as image detection
   - Sequential processing to respect rate limits
   - Frame-level analytics (damage %, confidence, risk level)

5. **Aggregation & Persistence**
   - Aggregates results across all frames
   - Calculates video-level statistics:
     - Total detections across all frames
     - Frames containing potholes
     - Maximum confidence
     - Average damage percentage
     - Overall risk level (worst-case across frames)
   - Persists single inspection record (video details)
   - Persists all detections from all frames

6. **Cleanup**
   - Temporary video file deleted after processing
   - Extracted frames directory deleted
   - Session-specific directories cleaned up

### 5. FFmpeg Integration
- **Method**: Uses system-installed FFmpeg (via `fluent-ffmpeg`)
- **Confirmed Working**: `ffmpeg version 9.0.2-full_build-www.gyan.dev`
- **No Dependencies**: Uses system PATH instead of `ffmpeg-static`
- **Frame Extraction**: `fps=${fps}` filter with quality JPEG output

### 6. Testing Results

**✅ TypeScript Build:**
```
npm run build - Success (no errors)
```

**✅ Endpoint Tests:**
1. **No Video**: Returns proper error - `"No video file provided"`
2. **Invalid Format**: Returns proper error - `"Invalid file type"`
3. **Valid Video**: Complete processing successful

**✅ Test Video Analysis (historical, 2026-09-26):**
- **Video**: 3-second MP4 (115KB) created from test image
- **FPS**: 1 (extracted 3 frames)
- **Detections**: 18 total (6 per frame)
- **Confidence**: 0.891 max
- **Damage**: 6.29% average
- **Risk**: CRITICAL (multiple large potholes)

> These numbers predate the counting rework. The current endpoint reports
> unique potholes after per-frame dedup and cross-frame tracking; see
> `DETECTION_COUNTING_FIX.md` for current verified results. The hosted model's
> predictions also vary between calls, so re-run rather than assuming 18/6.

**✅ Database Persistence:**
- **Inspection ID**: 7 (video)
- **Image Path**: `null` (videos not persisted due to size)
- **Detection Count**: 18 (historical raw frame detections; new rows store raw
  in `detection_count` and unique in `unique_pothole_count`)
- **Overall Risk**: CRITICAL
- **Damage Percentage**: 6.29

**✅ Cleanup Verification:**
```
backend/uploads/videos/ - empty
backend/uploads/frames/ - empty
```

**✅ Existing Functionality Preservation:**
- `/api/detect` - Still working (tested with sample image)
- `/api/health` - Shows all services connected
- `/api/inspections` - Shows both image and video records

### 7. Performance Considerations

**Frame Sampling:**
- Default: 1 frame/second
- Configurable: 0.1-5 fps via `fps` parameter
- Cap: 60 frames by default (query `maxFrames`, env `MAX_VIDEO_FRAMES`, max 300)

**Processing Time:**
- 3-second video: ~10-15 seconds total
- Scales linearly with frames extracted
- Roboflow API rate limiting respected

**Memory Usage:**
- Temporary files cleaned after processing
- Frame-by-frame processing (no large memory buffers)

### 8. Limitations & Future Improvements

**Current Limitations:**
1. **Model coverage**: the hosted model does not detect every visible pothole.
2. **Briefly visible potholes**: tracks seen in fewer than 2 sampled frames are
   reported as tentative and excluded from the final count.
3. **Max Frames**: 60 by default; longer clips are truncated and this is reported.
4. **Video Storage**: successful videos are retained for report playback; failed uploads are cleaned up. Consider a retention policy for disk usage.
5. **Format Support**: Limited to 5 common video formats

**Implemented since the original summary:**
1. **Object Tracking**: one-to-one motion-compensated tracker in `potholeTracker.ts`
2. **Deduplication**: mask-aware within-frame suppression plus cross-frame IDs

**Potential Improvements:**
1. **Progressive Sampling**: adaptive FPS based on detection density
2. **Video Preview**: generate an annotated video with bounding boxes
3. **Streaming Support**: process video streams in real-time

### 9. API Keys & Security

**No Sensitive Information Exposed:**
- Roboflow API key from environment variables only
- No API keys in response payloads
- No secrets in source code or logs

**File Security:**
- Uploaded videos stored temporarily in isolated directory
- Path traversal prevention in filename sanitization
- All temporary files cleaned up after processing

### 10. Deployment Requirements

**System Dependencies:**
1. **FFmpeg**: Must be installed and in PATH
   - Windows: Manually installed (confirmed working)
   - Test: `ffmpeg -version` returns version info
2. **Node.js**: v16+ with TypeScript support
3. **MySQL**: Existing roadguard database

**Environment Variables:**
- `ROBOFLOW_API_KEY`: Required for Roboflow API
- `ROBOFLOW_MODEL_ID`: Deployed model ID (`<workspace>/<model-slug>`); defaults to the RF-DETR segmentation model
- `ROBOFLOW_PROJECT`: Project ID (used for metadata/health reporting)
- `ROBOFLOW_VERSION`: Project version (metadata fallback only)
- Database connection variables unchanged

## Conclusion

The video detection implementation is **complete, tested, and working** with the following achievements:

✅ **New Endpoint**: `POST /api/detect/video` fully functional  
✅ **FFmpeg Integration**: Using manually installed FFmpeg 9.0.2  
✅ **Same Roboflow Model**: Reuses existing detection logic  
✅ **Database Persistence**: Stores video inspections alongside images  
✅ **Temporary File Cleanup**: No residual files left after processing  
✅ **Existing Functionality**: All image detection endpoints preserved  
✅ **Error Handling**: Comprehensive validation and error responses  
✅ **TypeScript Compatibility**: Builds without errors  

The system is ready for frontend integration and production use.