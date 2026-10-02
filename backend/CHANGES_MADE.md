# Video Detection IoU Deduplication — Changes Made

## Summary

Fixed the video detection feature to prevent counting the same pothole multiple times across consecutive sampled frames. Implemented IoU-based deduplication to track unique potholes while preserving raw frame-level detections.

---

## File Changes

### 1. `backend/server/routes/videoDetection.ts`

**Problem Fixed:**
- Line 373 referenced `totalDetections` before it was declared (TypeScript compile error TS2448/TS2454)
- Response siloed raw detection count only — no unique pothole count
- `unique_pothole_count` was never persisted for videos

**Changes Made:**

#### Change 1: Reorder variable declarations (aggregate before deduplicate)
```diff
- // 5. Deduplicate detections across frames using IoU
- const iouThreshold = req.query.iou ? parseFloat(req.query.iou as string) : 0.70;
- const deduplicationResult = deduplicateDetectionsAcrossFrames(frameResults, iouThreshold);
- const uniquePotholeCount = deduplicationResult.uniquePotholeCount;
-
- console.log(`[RoadGuard Video] Deduplication: ${totalDetections} raw detections → ${uniquePotholeCount} unique potholes...`);
-
- // 6. Aggregate results across all frames
- const allPredictions = frameResults.flatMap(f => f.predictions);
- const framesWithDetections = frameResults.filter(f => f.predictions.length > 0);
- const totalDetections = allPredictions.length;

+ // 5. Aggregate results across all frames
+ const allPredictions = frameResults.flatMap(f => f.predictions);
+ const framesWithDetections = frameResults.filter(f => f.predictions.length > 0);
+ const totalDetections = allPredictions.length;
+
+ // 6. Deduplicate detections across frames using IoU
+ const iouThreshold = req.query.iou ? parseFloat(req.query.iou as string) : 0.70;
+ const deduplicationResult = deduplicateDetectionsAcrossFrames(frameResults, iouThreshold);
+ const uniquePotholeCount = deduplicationResult.uniquePotholeCount;
+
+ console.log(`[RoadGuard Video] Deduplication: ${totalDetections} raw detections → ${uniquePotholeCount} unique potholes (IoU threshold: ${iouThreshold})`);
```

**Reason:** `totalDetections` must be computed before it is referenced in the deduplication log line. This was the compile error.

---

#### Change 2: Persist `unique_pothole_count` for video inspections
```diff
  inspectionId = await saveInspection({
    image_filename: req.file.originalname,
    image_path: null,
    image_width: videoMeta.width,
    image_height: videoMeta.height,
    detection_count: totalDetections,
+   unique_pothole_count: uniquePotholeCount,
    overall_risk: worstRisk,
    damage_percentage: avgDamage,
    confidence_threshold: confidence,
  });
```

**Reason:** Store the deduplicated pothole count in the database so it survives alongside the raw count.

---

#### Change 3: Add `uniquePotholeCount` to response analytics
```diff
  analytics: {
    totalDetections,
+   uniquePotholeCount,
    framesWithDetections: framesWithDetections.length,
    maxConfidence: parseFloat(maxConfAll.toFixed(3)),
    avgDamagePercentage: avgDamage,
    overallRiskLevel: worstRisk,
  },
```

**Reason:** Expose the deduplicated count to API consumers. Old clients ignore the new field (additive).

---

### 2. Database Schema Migration (applied to live DB)

```sql
ALTER TABLE inspections
ADD COLUMN unique_pothole_count INT UNSIGNED DEFAULT NULL
AFTER detection_count;
```

- The column was already declared in `server/db/schema.sql` (for fresh installs), but existing databases had not been migrated.
- **Additive and safe:** existing rows get `NULL`, no data is altered.

---

## IoU Deduplication Logic

Implemented in `backend/server/utils/iou.ts` (already present; wired up by the route changes).

### Algorithm (greedy consecutive-frame matching)

1. Iterate frames in extraction order.
2. For each detection in frame N, compare its box to every detection in frame N−1:
   - Compute `IoU = intersectionArea / unionArea`.
   - If `IoU >= 0.70` → treat as the same pothole (reuse that pothole's ID).
   - If no match → create a new unique pothole ID.
3. `uniquePotholeCount` = number of distinct IDs assigned.

### Example (matches the test video result)

```
Frame 0: [A at (100,100)]  → pothole_1
Frame 1: [A' at (105,105)] → IoU(A',A)=0.85 ≥ 0.70 → pothole_1
Frame 2: [A'' at (110,110)]→ IoU(A'',A')=0.82 ≥ 0.70 → pothole_1

Raw detections: 3
Unique potholes: 1
```

---

## Test Results

| Test | Result |
|------|--------|
| TypeScript build (`npm run build`) | ✅ 0 errors |
| `/api/detect` (image via multipart) | ✅ 2 potholes, persisted (inspection #11) |
| `/api/detect/video` (3s pothole loop, 3 frames) | ✅ 6 raw → 2 unique |
| MySQL persistence | ✅ `detection_count=6`, `unique_pothole_count=2` + all 6 raw detections linked |
| Temporary file cleanup | ✅ `uploads/videos/` and `uploads/frames/` empty |
| Existing integration suite (`test-detection.ts`) | ✅ 11/11 passed |

### Numbers (test video `backend/test/videos/pothole_test.mp4`)

- **Raw detection count:** 6 (2 potholes × 3 frames)
- **Unique pothole count:** 6 → **2** after IoU ≥ 0.70 deduplication (67% duplicate elimination)

---

## Files in this change

- Modified: `backend/server/routes/videoDetection.ts`
- Migration applied: `inspections.unique_pothole_count`
- No change to `/api/detect`, Roboflow config, `index.ts`, `dbRoutes.ts`, or `persistence.ts` (they already supported the column).
- No frontend changes (as instructed).