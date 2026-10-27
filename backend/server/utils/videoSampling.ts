/**
 * Video frame-sampling plan.
 *
 * The video route used to hard-cap analysis at 30 sampled frames. A 40-second
 * clip sampled at 1 fps therefore lost its final ~10 seconds, which silently
 * under-counted unique potholes. Sampling is now planned explicitly so the
 * route can report truncation honestly and clients can request a different cap.
 */

export interface FrameSamplingPlan {
  /** Frames implied by duration × extraction fps. */
  estimatedFrames: number;
  /** Frames that will actually be extracted and analysed. */
  framesToExtract: number;
  /** True when the requested frame cap cuts the video short. */
  truncated: boolean;
  /** The cap that produced framesToExtract. */
  frameLimit: number;
}

export function planFrameExtraction(
  durationSeconds: number,
  extractionFps: number,
  frameLimit: number,
): FrameSamplingPlan {
  const duration = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 0;
  const fps = Number.isFinite(extractionFps) && extractionFps > 0 ? extractionFps : 1;
  const limit = Number.isFinite(frameLimit) && frameLimit >= 1 ? Math.floor(frameLimit) : 1;
  const estimatedFrames = Math.max(1, Math.ceil(duration * fps));

  return {
    estimatedFrames,
    framesToExtract: Math.min(estimatedFrames, limit),
    truncated: estimatedFrames > limit,
    frameLimit: limit,
  };
}
