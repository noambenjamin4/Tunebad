/**
 * Shared fade math for the MP3 cutter: the export bakes a linear ramp into
 * the samples, and the SAME envelope drives the preview (audio.volume per
 * frame) and the waveform visual (bar heights scaled inside the fade
 * windows), so what you see and hear is exactly what you download.
 */

export const FADE_SECONDS = 0.5;

/** Ramp length, clamped to half the selection so short clips still fade sensibly. */
export function fadeRampSeconds(selectionSeconds: number): number {
  return Math.min(FADE_SECONDS, Math.max(0, selectionSeconds / 2));
}

/**
 * Linear gain at absolute time `t` for a [start, end] selection — 1 outside
 * the fade windows, ramping 0→1 across the fade-in window and 1→0 across the
 * fade-out window. Matches the sample ramp `applyFades` bakes into exports.
 */
export function fadeEnvelopeGain(
  t: number,
  start: number,
  end: number,
  fadeIn: boolean,
  fadeOut: boolean,
): number {
  const ramp = fadeRampSeconds(end - start);
  if (ramp <= 0) return 1;
  let gain = 1;
  if (fadeIn && t >= start && t < start + ramp) {
    gain = Math.min(gain, (t - start) / ramp);
  }
  if (fadeOut && t > end - ramp && t <= end) {
    gain = Math.min(gain, (end - t) / ramp);
  }
  return Math.max(0, Math.min(1, gain));
}
