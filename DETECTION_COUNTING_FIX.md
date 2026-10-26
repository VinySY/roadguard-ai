# RoadGuard AI — Pothole Counting Accuracy Fix

**Date:** 2026-10-26
**Scope:** `/api/detect` (image) and `/api/detect/video` (video) unique-pothole counting.
**Goal:** stop over-counting the same physical pothole without changing the model, API clients, annotated output, persistence, or deployment setup.

---

## 1. Root causes

### Image over-counting (3 visible potholes reported as 4–5)

The Roboflow instance-segmentation model returns multiple predictions for one physical pothole:

- synonym classes: `Pothole`, `Potholes`, `pothole`, `potholes`, `object`
- overlapping/nested masks and nearly identical boxes

The old endpoint returned `predictions.length` directly, so every synonym/duplicate prediction became a separate pothole.

Captured baseline for the supplied photo (`1793016052507_massive-potholes-…webp`):

| # | Class | Confidence | Box (x, y, w, h) | Meaning |
|---|-------|-----------|------------------|---------|
| 1 | pothole | 0.6522 | 350.5, 75.5, 137, 67 | top-right pothole |
| 2 | Pothole | 0.6457 | 166.5, 188.5, 143, 91 | foreground pothole |
| 3 | Pothole | 0.4447 | 349.5, 75.5, 139, 67 | duplicate of #1 |
| 4 | pothole | 0.3489 | 166.0, 188.0, 144, 90 | duplicate of #2 |
| 5 | pothole | 0.2284 | 101.5, 10.5, 153, 21 | partial pothole at the top edge |

Duplicate box IoU was measured at **0.986** and **0.982**, but the model reported them as different class spellings. The top-edge detection is a genuinely different (partially visible) pothole, so the correct answer is **3**, not 2 and not 5.

### Video over-counting (12–13 potholes reported as 52)

The old video route:

1. summed every frame’s predictions (`totalDetections`);
2. deduplicated only against the **immediately previous** frame;
3. required **IoU ≥ 0.70** with no motion compensation, no missed-detection handling, and no per-frame duplicate suppression.

With a moving camera, scale changes, or one missed frame, the same pothole never matched and was counted again. Synonym duplicates inside a single frame also survived into the total.

---

## 2. What changed

### New post-processing core

`backend/server/utils/detectionPostprocess.ts`

- Validates the Roboflow response and ignores malformed predictions instead of crashing or counting `NaN`.
- Applies the confidence threshold locally as well as at Roboflow.
- Class-agnostic, mask-aware duplicate suppression:
  - mask IoU ≥ 0.50, or
  - containment (intersection over smaller mask) ≥ 0.90 with area ratio ≥ 0.35, or
  - bounding-box IoU ≥ 0.80 only when masks are unavailable.
- **Deliberately does not merge by centre proximity** — nearby separate potholes remain separate.
- Preserves every original Roboflow field and records merged detection IDs for auditing.
- Keeps unique counts and raw counts separate.

### New multi-frame tracker

`backend/server/utils/potholeTracker.ts`

- One-to-one greedy assignment (a detection cannot update two tracks).
- Constant-velocity motion prediction.
- Mask/box overlap plus a centre-distance gate scaled by object size.
- Scale tolerance 0.3×–3.0×.
- Tracks survive up to `maxMissedFrames` (default 3) sampled frames.
- Confirmation by minimum hits (default 2 for videos with ≥ 4 sampled frames, 1 for shorter clips); unconfirmed tracks are reported as **tentative**, never silently added to the unique count.
- Emits quality level, reasons, and limitations for short/sparse video.

### Image endpoint (`backend/server/index.ts`)

- Validates `confidence`, `overlap`, dedup thresholds.
- Deduplicates before counting.
- Response additions (existing fields preserved):
  - `analytics.uniquePotholeCount` (final answer)
  - `analytics.totalDetected` = unique count (backwards compatible final count)
  - `analytics.rawDetectionCount`, `rawTotalDetected`, `rawPredictionCount`
  - `analytics.candidateDetectionCount`, `duplicatePredictionsRemoved`
  - `confidenceThreshold`, `deduplication`, `warnings`
  - optional `debug.rawPredictions` / suppression decisions when `?debug=true`
- DB: `detection_count` = raw detections, `unique_pothole_count` = unique potholes; detection rows store only unique representatives.

### Video endpoint (`backend/server/routes/videoDetection.ts`)

- Per-frame validation → confidence filter → duplicate suppression → enrichment.
- Cross-frame tracking with persistent IDs on every prediction.
- Raw and unique totals are separate:
  - `analytics.totalDetections` = raw frame detections (kept for old clients)
  - `analytics.uniquePotholeCount` = final unique count
  - `analytics.confirmedPotholeCount`, `tentativePotholeCount`, `totalTracks`
  - `analytics.rawPredictionCount`, `candidateDetectionCount`, `duplicatePredictionsRemoved`
- `uniqueDetections` = one representative per confirmed pothole.
- `tracking.parameters`, `tracking.confirmedTracks`, `tracking.tentativeTracks`.
- `quality` and `limitations` for honest reporting.
- If **all** frame detections fail, returns HTTP 502 instead of a false “0 potholes”.
- DB: one inspection row with raw and unique counts; detection rows are track representatives.
- FFmpeg extraction, upload validation, file cleanup, and endpoints are unchanged.

### Frontend

- New `frontend/src/services/detectionCounts.ts` centralises count precedence:
  - unique: `analytics.uniquePotholeCount` → `uniquePotholeCount` → `potholeCount` → `analytics.totalDetected`
  - raw: `analytics.rawDetectionCount` → `rawDetectionCount` → `analytics.totalDetections`
  - history: `unique_pothole_count ?? detection_count`
- `ImageDetector` labels the detected count as **unique**, and technical details show raw predictions and merged duplicates.
- `VideoDetector` reports **unique** potholes as the result, shows raw frame detections only as a secondary audit line, and renders limitations.
- `VideoDetectionStudio` already had a unique/raw split; it now labels tracking properly, defaults the tracker gate to 20%, and displays reliability notes.
- `DashboardView`, `ReportsView`, `MapView` show `unique_pothole_count` when present and label raw counts explicitly.
- `AnalyticsView` keeps the highlighted “Unique Potholes” card and labels the separate raw-detection series as raw.

---

## 3. Default settings and trade-offs

| Setting | Default | Trade-off |
|---|---|---|
| Image/video confidence | 20% | Lower finds more real potholes but increases false positives. |
| Roboflow overlap | 30% | Standard NMS overlap passed to the model. |
| Mask IoU merge | 0.50 | Merges same-object masks; lower risks merging adjacent potholes. |
| Box IoU fallback | 0.80 | Strict, so distinct nearby boxes are not merged when masks are missing. |
| Containment | 0.90, min area ratio 0.35 | Merges nested duplicate masks but not a tiny speck inside a different pothole. |
| Tracker match IoU | 0.20 | Lower tolerates camera motion; proximity/scale gates prevent unrelated matches. The old default was 0.70. |
| Centre-distance gate | 1.75× mean object diagonal | Allows motion between samples; distant objects cannot match. |
| Max missed frames | 3 | Bridges brief occlusion/missed detections; too high risks identity swaps. |
| Min hits | 2 (≥4 frames), 1 (short clips) | Suppresses one-frame false positives while still counting short clips. |
| Extraction fps | 1 | Fast enough for most footage; increase for fast vehicles (server caps at 5). |
| Max extracted frames | 30 | Bounds Roboflow cost/latency; later video sections are not analysed and this is reported as a limitation. |

All counting/tracking parameters are query-configurable:

```
confidence, overlap, fps,
dedupe, maskIou, boxIou, containment, minAreaRatio,
iou (alias matchIou), maxMissed, minHits, debug
```

---

## 4. Actual verification results

### Automated tests

Command (from `backend/`):

```
npm test
```

Result: **16 passed, 0 failed** (Node test runner via `tsx`).

Coverage:

- provided-image regression fixture: **5 raw → 3 unique**
- near-identical duplicate boxes (IoU > 0.9)
- identical overlapping masks merge
- nested masks merge; tiny contained speck does not
- nearby separate potholes remain separate
- class synonyms/case variants merge
- empty / low-confidence responses
- invalid responses and malformed predictions
- same pothole across frames
- simultaneous multiple potholes
- temporary disappearance within `maxMissedFrames`
- track longer than `maxMissedFrames` splits
- moving camera + scale change
- single-frame detections are tentative, not counted
- short/empty video quality and limitations
- synthetic 3-frame clip: **18 raw → 2 unique**
- backend payload ↔ frontend count-helper consistency

### Builds

- `backend/`: `npm run build` (TypeScript) — **pass**
- `frontend/`: `npm run lint` (`tsc --noEmit`) — **pass**
- `frontend/`: `npm run build` (Vite) — **pass**

### Live image endpoint

`POST /api/detect?confidence=20&overlap=30` with the supplied photo:

```json
{
  "predictions": 3,
  "analytics": {
    "totalDetected": 3,
    "uniquePotholeCount": 3,
    "rawDetectionCount": 5,
    "rawPredictionCount": 5,
    "duplicatePredictionsRemoved": 2,
    "maxConfidence": 0.652,
    "overallRiskLevel": "HIGH"
  },
  "warnings": ["2 duplicate/overlapping prediction(s) were merged into 3 unique pothole(s)."]
}
```

DB row (inspection #56): `detection_count = 5`, `unique_pothole_count = 3`.

A second image (`101_jpg…`) returned **2 raw → 2 unique** (no regression).

### Live video endpoint — static repo clip

`POST /api/detect/video?confidence=20&fps=1` with `test/videos/test_pothole.mp4`:

- 3 sampled frames, all processed
- **18 raw frame detections → 6 unique potholes**
- 6 persistent track IDs across all 3 frames
- quality `medium`, with the limitation “Only 3 sampled frames were available; treat the unique count as indicative rather than exact.”
- DB row (inspection #57): `detection_count = 18`, `unique_pothole_count = 6`

Note: this clip is almost static, so the old adjacent-frame IoU approach also produced 6. It verifies compatibility but does not by itself demonstrate motion handling.

### Live video endpoint — moving-camera validation

The repository contains no 12–13-pothole moving-camera clip, so a synthetic pan was generated from the supplied **3-pothole** photo (horizontal crop move across 5 seconds, 25 fps, sampled at 2 fps). This is a real-image-derived motion test, not fabricated detections.

`/api/detect/video?confidence=20&fps=2`:

- 10 sampled frames
- **26 raw frame detections → 3 confirmed unique potholes**, plus 1 tentative track
- 3 persistent confirmed tracks; tentative track excluded from the final count
- per-frame counts varied from 1 to 4 as potholes entered/left the crop
- quality `medium` with explicit limitations for the tentative/single-frame track

This is the failure mode that produced inflated counts with the old 0.70 adjacent-frame IoU logic.

### Failure handling

- `confidence=abc` → HTTP **400** with a clear message (before upload processing).
- corrupt/non-video file → HTTP **400** “Could not read video metadata…”.
- all-frame inference failure → HTTP **502** (implemented; not reproducible without taking Roboflow down).

---

## 5. Known limitations

1. **No real 12–13-pothole moving footage exists in this repository.** Only static 3-second clips are available. The moving-camera path was validated with the real-image pan above; a manually annotated field video is still recommended before claiming production accuracy on such footage.
2. **Partial/edge potholes.** A pothole that is only briefly visible at the frame edge may remain a tentative track and is excluded from the confirmed count. The API reports this in `limitations` instead of guessing.
3. **Identity swaps.** If two potholes cross paths or the camera jumps, a track can theoretically switch identity. The one-to-one assignment and distance gate reduce this but cannot eliminate it.
4. **Sampling trade-off.** Default 1 fps and a 30-frame cap mean short visibility windows can be missed. Increase `fps` for fast footage; for videos longer than 30 s at 1 fps, only the first 30 frames are analysed (reported).
5. **Model limitations remain.** If the model never detects a pothole, no counting logic can recover it. Thresholds are configurable but not hardcoded to an expected count.
6. **Legacy DB rows.** Historical inspections created before this fix may still contain duplicate `detections` rows. New rows store unique representatives; history views use `unique_pothole_count` where available.

---

## 6. Reproduction

From the repository root:

```powershell
# Backend build + tests
cd backend
npm run build
npm test
npm run start:dev

# Image regression (PowerShell / curl.exe)
curl.exe -s -X POST "http://localhost:3001/api/detect?confidence=20&overlap=30" `
  -F "image=@C:\Pothole AI\backend\uploads\inspections\1793016052507_massive-potholes-unmaintained-road-south-africa-tar-filled-due-to-poorly-managed-municipalities-poor-service-455476500.webp;type=image/webp"

# Static video
curl.exe -s -X POST "http://localhost:3001/api/detect/video?confidence=20&fps=1" `
  -F "video=@C:\Pothole AI\test\videos\test_pothole.mp4;type=video/mp4"

# Debug raw predictions for the image
curl.exe -s -X POST "http://localhost:3001/api/detect?confidence=20&debug=true" `
  -F "image=@<path-to-image>;type=image/webp"
```

Expected: image `analytics.uniquePotholeCount = 3`, `rawDetectionCount = 5`; static video `uniquePotholeCount = 6`, `totalDetections = 18`.

---

## 7. Files changed for this fix

New:

- `backend/server/utils/detectionPostprocess.ts`
- `backend/server/utils/potholeTracker.ts`
- `backend/tests/detection.test.ts`
- `backend/tests/fixtures/massive-image-response.json`
- `frontend/src/services/detectionCounts.ts`
- `DETECTION_COUNTING_FIX.md`

Modified:

- `backend/server/index.ts`
- `backend/server/routes/videoDetection.ts`
- `backend/server/utils/iou.ts` (compatibility wrapper)
- `backend/package.json` (`test` script)
- `frontend/src/services/detection.ts`
- `frontend/src/types/index.ts`
- `frontend/src/types/detection.ts`
- `frontend/src/components/detection/ImageDetector.tsx`
- `frontend/src/components/detection/VideoDetector.tsx`
- `frontend/src/components/VideoDetectionStudio.tsx`
- `frontend/src/components/DashboardView.tsx`
- `frontend/src/components/ReportsView.tsx`
- `frontend/src/components/MapView.tsx`
- `frontend/src/components/AnalyticsView.tsx`
- `frontend/src/components/layout/Sidebar.tsx` and `frontend/src/components/reporting/ReportModal.tsx`
  (minimal type corrections so `tsc --noEmit` passes; no behaviour change)

Existing Roboflow credentials, upload handling, annotated image/video output, API routes, database schema, and deployment configuration were preserved.
