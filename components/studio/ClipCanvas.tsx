"use client";

// One clip's waveform on the DAW timeline. The canvas IS the cache: it
// re-renders only when the trim window, width, gain, theme, fades, effect
// signal, or DPR change — dragging a clip around the timeline just moves the
// element. Bars are exact min/max columns from the display signal's peak
// pyramid, scaled by BOTH the clip's fade envelope and its volume, so the
// wave always looks like what it sounds like: quieter clip, smaller wave;
// phone/underwater on the master, thinner filtered wave (the signal itself
// is re-rendered through those filters — see lib/studio/display-signal.ts).

import { useEffect, useRef } from "react";
import type { DisplaySignal } from "@/lib/studio/display-signal";
import { windowMinMax } from "@/lib/studio/waveform-pyramid";

const COLUMN_PX = 3;
const BAR_PX = 2;

export function ClipCanvas({
  signal,
  clipStart,
  clipEnd,
  fadeInSec,
  fadeOutSec,
  gain,
  muted,
  widthPx,
  heightPx,
  themeSignal = 0,
}: {
  signal: DisplaySignal;
  clipStart: number;
  clipEnd: number;
  fadeInSec: number;
  fadeOutSec: number;
  gain: number;
  muted: boolean;
  widthPx: number;
  heightPx: number;
  /** Bump to force a repaint after a theme flip. */
  themeSignal?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || widthPx <= 0 || heightPx <= 0) return;
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    canvas.width = Math.max(1, Math.round(widthPx * dpr));
    canvas.height = Math.max(1, Math.round(heightPx * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, widthPx, heightPx);

    const styles = getComputedStyle(canvas);
    const ink = styles.getPropertyValue("--ink").trim() || "#111111";
    ctx.fillStyle = ink;
    ctx.globalAlpha = muted ? 0.28 : 0.85;

    const { data, pyramid, sampleRate } = signal;
    const duration = clipEnd - clipStart;
    if (duration <= 0) return;
    const secondsPerPx = duration / widthPx;
    const mid = heightPx / 2;
    const half = heightPx / 2 - 2;
    const fadeIn = Math.min(fadeInSec, duration / 2);
    const fadeOut = Math.min(fadeOutSec, duration / 2);

    for (let x = 0; x < widthPx; x += COLUMN_PX) {
      const t0 = clipStart + x * secondsPerPx;
      const t1 = clipStart + Math.min(widthPx, x + COLUMN_PX) * secondsPerPx;
      const { min, max } = windowMinMax(data, pyramid, t0 * sampleRate, t1 * sampleRate);

      // Fade envelope at the column's center, clip-local time, times volume.
      const local = (t0 + t1) / 2 - clipStart;
      let level = gain;
      if (fadeIn > 0 && local < fadeIn) level *= local / fadeIn;
      if (fadeOut > 0 && local > duration - fadeOut) level *= (duration - local) / fadeOut;
      level = Math.max(0, level);

      // Canvas y grows downward: max (positive) is the TOP of the column.
      // Clamp to the box so a boosted clip can't paint outside its lane.
      const up = Math.min(1, Math.max(0, max) * level);
      const down = Math.min(1, Math.abs(Math.min(0, min)) * level);
      const yTop = mid - up * half;
      const yBottom = mid + down * half;
      // One vertical min/max bar per column; floor 1px so silence stays visible.
      ctx.fillRect(x, yTop, BAR_PX, Math.max(1, yBottom - yTop));
    }
  }, [signal, clipStart, clipEnd, fadeInSec, fadeOutSec, gain, muted, widthPx, heightPx, themeSignal]);

  return (
    <canvas
      ref={canvasRef}
      className="studio-clip-canvas"
      style={{ width: `${widthPx}px`, height: `${heightPx}px` }}
      aria-hidden="true"
    />
  );
}
