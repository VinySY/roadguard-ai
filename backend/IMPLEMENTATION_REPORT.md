# Video Detection IoU Deduplication — Implementation Report

**Date:** 2026-09-26  
**Status:** ✅ Complete and Tested  

---

## Executive Summary

Successfully implemented IoU (Intersection over Union) based deduplication for video pothole detection. The system now distinguishes between **raw frame-level detections** and **unique potholes** across video frames, preventing the same pothole from being counted multiple times.

**Key Result:** 6 raw detections across 3 frames → 2 unique potholes (67% deduplication)

---

## Files Changed

### 1. Backend Files Modified

| File | Changes |
|------|---------|
| `backend/server/routes/videoDetection.ts` | ✓ Fixed variable ordering bug (line 367-373) |
| | ✓ Added `uniquePotholeCount` to response analytics |
| | ✓ Pass `unique_pothole_count` to database persistence |
| `backend/server/db/schema.sql` | ✓ Already contained `unique_pothole_count` column (additive) |
| `backend/server/db/persistence.ts` | ✓ Already supports `unique_pothole_count` parameter |

### 2. Database Schema

**Applied Migration:**
```sql
ALTER TABLE inspections 
ADD COLUMN unique_pothole_count INT UNSIGNED DEFAULT NULL 
AFTER detection_count;
```

**Schema now contains:**
- `detection_count` — Raw frame-level detections (all frames combined)
- `unique_pothole_count` — Deduplicated unique potholes (NEW)

---

## How IoU Deduplication Works

### Algorithm

1. **Process frames sequentially** in extraction order
2. **For each detection in frame N:**
   - Compare bounding boxes against detections in frame N-1
   - Calculate Intersection over Union (IoU)
   - If IoU ≥ threshold (default 0.70), assign same pothole ID
   - Otherwise, create new unique pothole ID
3. **Count unique pothole IDs** across all frames

### IoU Calculation

```
IoU = Intersection Area / Union Area

Where:
- Intersection = overlapping area of two boxes
- Union = combined area of both boxes
- Result ∈ [0, 1]: 1 = perfect match, 0 = no overlap
```

### Example

Given 3-frame video with the same 2 potholes in each frame:

```
Frame 0: [Pothole_A, Pothole_B]
Frame 1: [Pothole_A, Pothole_B]  (same objects, slightly shifted)
Frame 2: [Pothole_A, Pothole_B]  (same objects, slightly shifted)

Raw detections: 6
Unique potholes (after IoU >= 0.70): 2
```

---

## Implementation Details

### 1. IoU Utility Function (server/utils/iou.ts)

```typescript
calculateIoU(box1: BoundingBox, box2: BoundingBox): number
```

- Converts center-based coords (x, y, width, height) to corners
- Computes intersection and union areas
- Returns IoU value [0-1]

### 2. Deduplication Function (server/utils/iou.ts)

```typescript
deduplicateDetectionsAcrossFrames(
  frameResults: FrameDetectionResult[],
  iouThreshold: number = 0.70
): DeduplicationResult
```

**Returns:**
- `trackedDetections[]` — All detections with unique pothole IDs
- `uniquePotholeCount` — Count of unique pothole IDs
- `potholeIdMap` — ID mapping (for debugging)

### 3. Video Detection Endpoint (server/routes/videoDetection.ts)

**Processing Pipeline:**
1. Upload & validate video
2. Extract metadata (resolution, FPS, codec, duration)
3. Extract frames at specified FPS (default: 1 fps)
4. **[NEW] Deduplicate detections across frames using IoU**
5. Aggregate analytics (max confidence, avg damage %)
6. Persist to database with both counts
7. Cleanup temporary files

**Response includes:**
```json
{
  "analytics": {
    "totalDetections": 6,           // Raw frame-level
    "uniquePotholeCount": 2,        // After IoU dedup
    "framesWithDetections": 3,
    "maxConfidence": 0.838,
    "avgDamagePercentage": 22.59,
    "overallRiskLevel": "CRITICAL"
  }
}
```

---

## Test Results

### Test 1: Image Detection (Preservation)

✅ **PASSED**
- Endpoint: `POST /api/detect`
- Detection: 2 potholes found
- Damage: 23.07%
- Risk: CRITICAL
- **Database:** Persisted (Inspection ID: 11)

### Test 2: Video Detection (IoU Deduplication)

✅ **PASSED**
- Video: pothole_test.mp4 (3 seconds, same image looped)
- Frames extracted: 3 (at 1 fps)
- Raw detections: 6 (2 per frame)
- **Unique potholes: 2** ← IoU deduplication working
- Deduplication rate: **67% eliminated** (6 → 2)
- **Database:** Persisted (Inspection ID: 10)
  - `detection_count`: 6
  - `unique_pothole_count`: 2

### Test 3: Integration Test Suite

✅ **11/11 PASSED**
- Health check
- DB health check
- Samples listing
- Sample image serving
- Image detection (multipart)
- Image detection (JSON body)
- Inspections listing
- Issues listing
- Issues validation
- Issues creation
- Issues status update

### Test 4: Temporary File Cleanup

✅ **VERIFIED**
- `uploads/videos/`: 0 files
- `uploads/frames/`: 0 files
- All temporary directories cleaned after processing

### Test 5: TypeScript Build

✅ **PASSED**
```
npm run build
→ tsc --noEmit
→ Success (0 errors)
```

---

## Database Verification

**Inspection Record #10 (Video):**
```
id: 10
image_filename: pothole_test.mp4
detection_count: 6              (Raw detections)
unique_pothole_count: 2         (NEW: Deduplicated)
overall_risk: CRITICAL
damage_percentage: 22.59
created_at: 2026-09-26T07:59:37.000Z
```

**Detection Records (6 raw detections linked to inspection #10):**
```
Detection 1: confidence=0.8339, severity=high, pos=(220.5, 515.5)
Detection 2: confidence=0.2694, severity=critical, pos=(315, 518)
Detection 3: confidence=0.8378, severity=high, pos=(220.5, 515.5)
Detection 4: confidence=0.2672, severity=critical, pos=(315, 518)
Detection 5: confidence=0.8356, severity=high, pos=(220.5, 515.5)
Detection 6: confidence=0.2679, severity=critical, pos=(315, 518)
```

*Note: Detections 1, 3, 5 match (same pothole, different frames)*  
*Detections 2, 4, 6 match (same pothole, different frames)*  
*Result: 2 unique potholes*

---

## Configuration

### Query Parameters

| Parameter | Default | Range | Purpose |
|-----------|---------|-------|---------|
| `fps` | 1 | 0.1-5 | Frames per second to extract |
| `confidence` | 20 | 1-100 | Roboflow detection confidence % |
| `overlap` | 30 | 1-100 | Roboflow NMS overlap % |
| `iou` | 0.70 | 0.0-1.0 | IoU threshold for deduplication |

### Example Requests

```bash
# Default deduplication (IoU >= 0.70)
curl -F "video=@video.mp4" \
  http://localhost:3001/api/detect/video

# Stricter deduplication (require 80% overlap)
curl -F "video=@video.mp4" \
  http://localhost:3001/api/detect/video?iou=0.80

# More frames, higher threshold
curl -F "video=@video.mp4" \
  http://localhost:3001/api/detect/video?fps=2&iou=0.75
```

---

## Data Preservation

### Raw Frame Detections Preserved

All 6 raw detections are stored in the database:
```sql
SELECT * FROM detections WHERE inspection_id = 10;
```

- Each frame's detections are recorded individually
- Useful for frame-by-frame analysis, debugging, and analytics

### Unique Pothole Count Stored

```sql
SELECT detection_count, unique_pothole_count FROM inspections WHERE id = 10;
→ detection_count: 6, unique_pothole_count: 2
```

- Enables reports: "6 detections representing 2 unique potholes"
- Supports future per-pothole tracking

### Image Detection Unmodified

- `/api/detect` endpoint works identically
- Single-image detections have `unique_pothole_count = NULL`
- No schema conflicts, additive change

---

## Performance Characteristics

| Metric | Value |
|--------|-------|
| Frame extraction (3s video @ 1fps) | ~1-2s |
| Roboflow detection per frame | ~2-3s each (3 frames) |
| IoU deduplication (6 detections) | <10ms |
| **Total processing time** | **~10-15 seconds** |
| **Temporary files cleaned** | Yes |
| **Memory overhead** | Minimal (frame-by-frame processing) |

---

## Deployment Notes

### No Breaking Changes

- Existing image detection endpoint unchanged
- Existing database schema extended additively
- Old inspection records have `unique_pothole_count = NULL` (safe)
- New inspections have both counts populated

### Migration Applied

- ✅ Added `unique_pothole_count` column to inspections table
- ✅ TypeScript builds without errors
- ✅ All tests passing
- ✅ Ready for production

---

## Verification Checklist

- [x] TypeScript builds without errors
- [x] Image detection (`/api/detect`) works unchanged
- [x] Video detection (`/api/detect/video`) extracts frames correctly
- [x] IoU deduplication reduces duplicate detections (6 → 2, 67% reduction)
- [x] Database persists both `detection_count` and `unique_pothole_count`
- [x] Raw frame-level detections available in `detections` table
- [x] Temporary files cleaned after processing
- [x] All integration tests pass (11/11)
- [x] Response includes `uniquePotholeCount` in analytics
- [x] Backward compatible (no breaking changes)

---

## Summary

The video detection IoU deduplication implementation is **complete, tested, and production-ready**.

**Key Achievements:**

✅ Prevents same pothole being counted multiple times across frames  
✅ Maintains raw frame-level detection data for analysis  
✅ Stores unique pothole count for reporting  
✅ Additive database schema change (no data loss)  
✅ Image detection pipeline unchanged  
✅ All integration tests passing  
✅ Temporary files cleaned properly  

The system now correctly reports:
- **Raw detections:** Frame-level count (useful for debugging)
- **Unique potholes:** Deduplicated count (useful for reporting road condition)
