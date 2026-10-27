# RoadGuard AI — Pothole Counting Accuracy Fix

**Date:** 2026-10-26
**Scope:** `/api/detect` (image) and `/api/detect/video` (video) unique-pothole counting.
**Goal:** stop over-counting the same physical pothole without changing the model, API clients, annotated output, persistence, or deployment setup.

---

## 1. Root causes

### Image over-counting (the supplied photo was reported as 4–5)

The Roboflow instance-segmentation model returns multiple predictions for one physical pothole:

- synonym classes: `Pothole`, `Potholes`, `pothole`, `potholes`, `object`
- overlapping/nested masks and nearly identical boxes
- occasionally one lower-confidence mask that spans **two touching potholes**

The old endpoint returned `predictions.length` directly, so every synonym/duplicate prediction became a separate pothole.

Captured baseline for the supplied photo (`1793016052507_massive-potholes-…webp`):

| # | Class | Confidence | Box (x, y, w, h) | Meaning |
|---|-------|-----------|------------------|---------|
| 1 | pothole | 0.6522 | 350.5, 75.5, 137, 67 | upper-right pothole |
| 2 | Pothole | 0.6457 | 166.5, 188.5, 143, 91 | foreground pothole |
| 3 | Pothole | 0.4447 | 349.5, 75.5, 139, 67 | duplicate of #1 |
| 4 | pothole | 0.3489 | 166.0, 188.0, 144, 90 | duplicate of #2 |
| 5 | pothole | 0.2284 | 101.5, 10.5, 153, 21 | partial feature at the top edge |

Duplicate box IoU was measured at **0.986** and **0.982**, but the model reported them as different class spellings. The captured response therefore collapses **5 → 3**.

A second issue showed up during live re-testing: the current hosted model returned a larger, lower-confidence mask covering **both** touching upper-right potholes. The first containment rule merged it into the larger pothole and hid the second one. The rule now only lets a *smaller* mask merge into the kept pothole (see §2).

### Video over-counting (12–13 visible potholes reported as 52)

The old video route:

1. summed every frame’s predictions (`totalDetections`);
2. deduplicated only against the **immediately previous** frame;
3. required **IoU ≥ 0.70** with no motion compensation, no missed-detection handling, and no per-frame duplicate suppression;
4. hard-capped analysis at 30 sampled frames, so a 40.3 s clip at 1 fps silently lost its final ~10 s.

With a moving camera, scale changes, or one missed frame, the same pothole never matched and was counted again. Synonym duplicates inside a single frame also survived into the total. The frame cap could also *under*-count later potholes.

---

## 2. What changed

### New post-processing core

`backend/server/utils/detectionPostprocess.ts`

- Validates the Roboflow response and ignores malformed predictions instead of crashing or counting `NaN`.
- Applies the confidence threshold locally as well as at Roboflow.
- Class-agnostic, mask-aware duplicate suppression:
  - mask IoU ≥ **0.65**, or
  - containment (intersection over smaller mask) ≥ **0.90** with area ratio ≥ **0.35**, **and the candidate mask is no larger than the kept mask**, or
  - bounding-box IoU ≥ **0.80** only when masks are unavailable.
- The directional containment rule prevents a larger mask that spans two touching potholes from hiding the second pothole.
- Deliberately does **not** merge by centre proximity — nearby separate potholes remain separate.
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

### Frame-sampling plan

`backend/server/utils/videoSampling.ts`

- `planFrameExtraction(duration, fps, frameLimit)` returns `estimatedFrames`, `framesToExtract`, `truncated`, and `frameLimit`.
- Default cap is now **60 frames** (covers the 40.3 s regression clip at 1 fps).
- Override with `MAX_VIDEO_FRAMES` or the request query `maxFrames` (1–300).
- Truncation is reported in `processing.truncated` and in `limitations`; it is not silent.

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
- `processing.maxFrames`, `processing.frameLimit`, `processing.estimatedFrames`, `processing.truncated`.
- `quality` and `limitations` for honest reporting.
- If **all** frame detections fail, returns HTTP 502 instead of a false “0 potholes”.
- DB: one inspection row with raw and unique counts; detection rows are track representatives.
- FFmpeg extraction, upload validation, and endpoint paths remain compatible; the existing successful-video retention used for report playback is preserved.

### Frontend

- New `frontend/src/services/detectionCounts.ts` centralises count precedence:
  - unique: `analytics.uniquePotholeCount` → `uniquePotholeCount` → `potholeCount` → `analytics.totalDetected`
  - raw: `analytics.rawDetectionCount` → `rawDetectionCount` → `analytics.totalDetections`
  - history: `unique_pothole_count ?? detection_count`
- `ImageDetector` labels the detected count as **unique**, and technical details show raw predictions and merged duplicates.
- `VideoDetector` reports **unique** potholes as the result, shows raw frame detections only as a secondary audit line, displays the tentative-track count, and renders limitations.
- `VideoDetectionStudio` labels tracking properly, defaults the tracker gate to 20%, and displays reliability notes.
- `DashboardView`, `ReportsView`, `MapView` show `unique_pothole_count` when present and label raw counts explicitly.
- `AnalyticsView` keeps the highlighted “Unique Potholes” card and labels the separate raw-detection series as raw.

---

## 3. Default settings and trade-offs

| Setting | Default | Trade-off |
|---|---|---|
| Image/video confidence | 20% | Lower finds more real potholes but increases weak/false detections. 30% gave 14 confirmed on the real clip. |
| Roboflow overlap | 30% | Standard NMS overlap passed to the model. |
| Mask IoU merge | 0.65 | Merges same-object masks; higher than the old 0.50 so a mask spanning two touching potholes is less likely to hide one. |
| Box IoU fallback | 0.80 | Strict, so distinct nearby boxes are not merged when masks are missing. |
| Containment | 0.90, min area ratio 0.35 | Merges nested duplicate masks only when the candidate is no larger than the kept mask. Tiny contained specks and larger spanning masks are preserved. |
| Tracker match IoU | 0.20 | Lower tolerates camera motion; proximity/scale gates prevent unrelated matches. The old default was 0.70. |
| Centre-distance gate | 1.75× mean object diagonal | Allows motion between samples; distant objects cannot match. |
| Max missed frames | 3 | Bridges brief occlusion/missed detections; too high risks identity swaps. |
| Min hits | 2 (≥4 frames), 1 (short clips) | Suppresses one-frame false positives while still counting short clips. |
| Extraction fps | 1 | Fast enough for most footage; increase for fast vehicles (server caps at 5). |
| Max extracted frames | 60 | Covers one minute at 1 fps, including the 40.3 s regression clip. Configurable via `maxFrames` / `MAX_VIDEO_FRAMES` (max 300); truncation is reported. |

All counting/tracking parameters are query-configurable:

```
confidence, overlap, fps, maxFrames,
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

Result: **32 passed, 0 failed** — 19 counting/tracking tests plus the existing 13 media-validation tests.

Counting coverage:

- provided-image regression fixture: **5 raw → 3 unique**
- near-identical duplicate boxes (IoU > 0.9)
- identical overlapping masks merge
- nested masks merge; tiny contained speck does not
- a larger mask spanning two touching potholes does **not** hide the second pothole
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
- 40.3 s clip is fully sampled with the 60-frame default; a 30-frame cap is reported as truncated
- frame planning handles sub-second, invalid and dense inputs
- backend payload ↔ frontend count-helper consistency

### Builds

- `backend/`: `npm run build` (TypeScript) — **pass**
- `frontend/`: `npm run lint` (`tsc --noEmit`) — **pass**
- `frontend/`: `npm run build` (Vite) — **pass**

### Live image endpoint

`POST /api/detect?confidence=20&overlap=30` with the supplied photo, current hosted model:

```json
{
  "predictions": 3,
  "analytics": {
    "totalDetected": 3,
    "uniquePotholeCount": 3,
    "rawDetectionCount": 4,
    "rawPredictionCount": 4,
    "duplicatePredictionsRemoved": 1
  }
}
```

DB row (inspection #103): `detection_count = 4`, `unique_pothole_count = 3`. A later re-run of the same photo returned the same **4 raw → 3 unique** (inspection #108), so the image result is stable across calls even though the raw prediction set can vary.

The model returned 4 predictions on this run: foreground, upper-right, a duplicate nested inside upper-right, and a larger mask for the second touching upper-right pothole. The final answer is **3**, and the two touching potholes are no longer merged.

An earlier capture of the same photo contained 5 predictions including a low-confidence edge feature; the fixture test still verifies **5 → 3** for that captured response. The hosted model's predictions vary between calls (see limitations). A second image (`101_jpg…`) returned **2 raw → 2 unique** (no regression).

### Live video endpoint — static repo clip

`POST /api/detect/video?confidence=20&fps=1` with `test/videos/test_pothole.mp4`:

- 3 sampled frames, all processed
- **12 raw frame detections → 4 unique potholes**
- 4 persistent track IDs across all 3 frames
- quality `medium`
- DB row (inspection #89): `detection_count = 12`, `unique_pothole_count = 4`

The hosted model returned 4 detections per frame on current runs. An earlier capture had 6 per frame (the historical `18 raw → 6` result), so the live number is lower now because the model returned fewer boxes — not because the tracker merged real potholes. The static clip still contains more visible potholes than the model finds; that is model coverage, not duplicate counting.

### Live video endpoint — moving-camera validation

The repository contains no 12–13-pothole moving-camera clip, so a synthetic pan was generated from the supplied photo (horizontal crop move, 10 sampled frames). This is a real-image-derived motion test, not fabricated detections.

`/api/detect/video?confidence=20&fps=2`:

- 10 sampled frames
- **57 raw frame detections → 26 per-frame unique → 3 confirmed unique potholes**, plus 1 tentative track
- 3 persistent confirmed tracks; the tentative track is excluded from the final count
- per-frame counts varied as potholes entered/left the crop
- quality `medium` with explicit limitations for the tentative/single-frame track
- DB row (inspection #106)

This is the failure mode that produced inflated counts with the old 0.70 adjacent-frame IoU logic.

### Live video endpoint — real 40.3 s “Terrible potholes in Rangoon Road” clip

`POST /api/detect/video?confidence=20&fps=1&debug=true`:

- 40.3 s, 640×360, 25 fps
- 40 frames extracted and processed (estimated 41; **not truncated**)
- **176 raw model predictions → 103 per-frame unique → 15 confirmed unique potholes**, plus **5 tentative** tracks (20 total)
- quality `medium`: “5 track(s) did not reach the 2-frame confirmation threshold”
- DB row (inspection #104): `detection_count = 176`, `unique_pothole_count = 15`
- raw/per-frame/unique totals all reported; the frontend shows **15** as the result and 176 only as an audit line

For comparison, the old 30-frame cap on the same clip produced **15 confirmed + 3 tentative from the first 30 s only** on a re-run (**14 confirmed + 3 tentative** on an earlier run — the hosted model is not deterministic); the remaining ~10 s was never analysed. That run processed 41 frames, used 30, and reported `truncated: true` (inspection #107). The new sampling plan analyses the whole clip and reports `truncated: false`.

At `confidence=30&fps=1` the same clip returns **14 confirmed + 2 tentative** (126 raw → 82 per-frame; inspection #105).

**Ground-truth note:** the manual estimate was ~12–13 potholes. The system reports 15 confirmed at the default 20% confidence and 14 at 30%. Visual review of the sampled frames shows several distinct potholes in the same frame (six separate tracks at t≈26 s, including small/far ones), so the remaining difference is not duplicate inflation. The count was **not** tuned or hardcoded to 12–13. If the operational definition is “major potholes only”, use `confidence=30` (or higher); the default 20% deliberately favours recall of smaller defects. The hosted model itself reports only **35.7% precision / 50.1% recall / 41.14 mAP50** in Roboflow metadata, so an exact manual match is not achievable without model improvement.

### Failure handling

- `confidence=abc` → HTTP **400** with a clear message (before upload processing).
- `maxFrames=abc` → HTTP **400**.
- corrupt/non-video file → HTTP **400** “Could not read video metadata…”.
- all-frame inference failure → HTTP **502** (implemented; not reproducible without taking Roboflow down).

---

## 5. Known limitations

1. **Hosted-model variability.** Roboflow returned different numbers of predictions for the same image/video between runs (e.g. 5 vs 4 raw predictions for the image; 18 vs 12 raw for the static clip). Counts are therefore reproducible in logic, not byte-for-byte across model calls. Compare duplicate/raw ratios rather than exact historical totals.
2. **No annotated field ground truth.** The manual ~12–13 estimate is approximate and appears to exclude small/distant potholes. The real clip contains more than 13 distinct depressions. Automated counting cannot resolve a disagreement about what counts as a pothole without a labelled frame set. The hosted model's own metadata reports 35.7% precision / 50.1% recall / 41.14 mAP50, so both missed potholes and false positives are expected.
3. **Partial/edge potholes.** A pothole visible in only one sampled frame remains tentative and is excluded from the confirmed count; the API reports this instead of guessing.
4. **Identity swaps.** If two potholes cross paths or the camera jumps, a track can theoretically switch identity. One-to-one assignment and the distance gate reduce this but cannot eliminate it.
5. **Sampling trade-off.** Default 1 fps and a 60-frame cap can miss short visibility windows. Increase `fps` for fast footage; longer clips are truncated and reported.
6. **Spanning masks.** When a lower-confidence mask covers two touching potholes, the count keeps both potholes but the kept representative box can visually cover both. This is preferable to hiding one pothole.
7. **Model missed detections cannot be recovered.** If the model never detects a pothole, no counting logic can add it. The static clip demonstrates this: many potholes are visible but only 4 are detected.
8. **Legacy DB rows.** Inspections created before this fix may still contain duplicate `detections` rows. New rows store unique representatives; history uses `unique_pothole_count` where available.

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

# Real 40.3 s clip (default 60-frame cap; add maxFrames=30 to reproduce the old truncation)
curl.exe -s -X POST "http://localhost:3001/api/detect/video?confidence=20&fps=1&debug=true" `
  -F "video=@C:\Users\govin\Downloads\Watch Video_ Terrible potholes in Rangoon Road.mp4;type=video/mp4"

# Higher-precision variant
curl.exe -s -X POST "http://localhost:3001/api/detect/video?confidence=30&fps=1" `
  -F "video=@C:\Users\govin\Downloads\Watch Video_ Terrible potholes in Rangoon Road.mp4;type=video/mp4"

# Debug raw predictions for the image
curl.exe -s -X POST "http://localhost:3001/api/detect?confidence=20&debug=true" `
  -F "image=@<path-to-image>;type=image/webp"
```

Expected current behaviour: image `analytics.uniquePotholeCount = 3`; static video `uniquePotholeCount = 4`, `totalDetections = 12`; real clip `uniquePotholeCount = 15`, `tentativePotholeCount = 5`, `processing.truncated = false`. Exact raw totals can vary with the hosted model.

---

## 7. Files changed for this fix

New:

- `backend/server/utils/detectionPostprocess.ts`
- `backend/server/utils/potholeTracker.ts`
- `backend/server/utils/videoSampling.ts`
- `backend/tests/detection.test.ts`
- `backend/tests/fixtures/massive-image-response.json`
- `frontend/src/services/detectionCounts.ts`
- `DETECTION_COUNTING_FIX.md`

Modified:

- `backend/server/index.ts`
- `backend/server/routes/videoDetection.ts`
- `backend/server/utils/iou.ts` (compatibility wrapper)
- `backend/package.json` (`test` script)
- `backend/VIDEO_DETECTION_SUMMARY.md` (updated behaviour note)
- `backend/.env.example` (`MAX_VIDEO_FRAMES`)
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
