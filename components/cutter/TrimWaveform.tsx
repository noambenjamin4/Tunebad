"use client";

import { useEffect, useRef } from "react";
import { fadeEnvelopeGain, fadeRampSeconds } from "@/lib/audio/fade";
import { formatTimeTenths } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const MIN_SELECTION_SECONDS = 0.1;
const KEY_STEP_SECONDS = 1;
/** Pointer must land within this many CSS px of a grip bar to drag it. */
const HANDLE_GRAB_PX = 22;
/** Seeks stop just shy of the end so playback always has something to play. */
const SEEK_END_GAP_SECONDS = 0.05;

/**
 * The cutter's waveform IS both the trim control and the scrubber: the kept
 * selection renders as bright full-ink bars while the discarded ends fade
 * toward the card background. Press within ~22px of a grip bar and you drag
 * that bound (with pointer capture + arrow-key support); press anywhere ELSE
 * on the wave and the playhead jumps there and playback starts (`onSeek`) —
 * dragging after a seek-press keeps scrubbing the playhead, never a bound.
 * When a fade is toggled on, the bars inside its window are scaled by the
 * same linear envelope the export bakes in, so the taper is visible on the
 * wave itself. The fade in/out toggles sit ON the wave at the selection's
 * top corners (like the reference cutter), and the playhead is a thin line
 * driven by a CSS var (no re-renders). Under the wave: absolute start/end
 * times pinned under the selection edges plus the selection length centered
 * beneath. `headSignal` forces a playhead reposition after a programmatic
 * seek while paused (e.g. the back-to-start button).
 */
export function TrimWaveform({
  bars,
  duration,
  start,
  end,
  playing,
  getCurrentTime,
  onChangeStart,
  onChangeEnd,
  onSeek,
  fadeIn,
  fadeOut,
  onToggleFadeIn,
  onToggleFadeOut,
  headSignal = 0,
  disabled,
}: {
  bars: number[];
  duration: number;
  start: number;
  end: number;
  playing: boolean;
  getCurrentTime: () => number;
  onChangeStart: (seconds: number) => void;
  onChangeEnd: (seconds: number) => void;
  onSeek: (seconds: number) => void;
  fadeIn: boolean;
  fadeOut: boolean;
  onToggleFadeIn: () => void;
  onToggleFadeOut: () => void;
  headSignal?: number;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<"start" | "end" | "seek" | null>(null);
  const rafRef = useRef<number | null>(null);
  const getCurrentTimeRef = useRef(getCurrentTime);
  getCurrentTimeRef.current = getCurrentTime;

  const applyHead = (seconds: number) => {
    const track = trackRef.current;
    if (!track) return;
    const pct = duration > 0 ? clamp((seconds / duration) * 100, 0, 100) : 0;
    track.style.setProperty("--trim-head-pct", `${pct}%`);
  };

  useEffect(() => {
    const tick = () => {
      applyHead(getCurrentTimeRef.current());
      rafRef.current = requestAnimationFrame(tick);
    };
    if (playing) rafRef.current = requestAnimationFrame(tick);
    else applyHead(getCurrentTimeRef.current());
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, duration, headSignal]);

  const secondsFromClientX = (clientX: number): number => {
    const track = trackRef.current;
    if (!track || duration <= 0) return 0;
    const rect = track.getBoundingClientRect();
    return clamp((clientX - rect.left) / rect.width, 0, 1) * duration;
  };

  const moveBound = (bound: "start" | "end", seconds: number) => {
    if (bound === "start") onChangeStart(clamp(seconds, 0, end - MIN_SELECTION_SECONDS));
    else onChangeEnd(clamp(seconds, start + MIN_SELECTION_SECONDS, duration));
  };

  // A plain press on the open wave = scrub: jump the playhead there (clamped
  // inside the selection) and hand the time to the panel, which starts
  // playback. The head line moves immediately via the CSS var — no waiting
  // on a re-render.
  const seekTo = (clientX: number) => {
    const seconds = clamp(
      secondsFromClientX(clientX),
      start,
      Math.max(start, end - SEEK_END_GAP_SECONDS),
    );
    applyHead(seconds);
    onSeek(seconds);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || duration <= 0) return;
    const track = trackRef.current;
    if (!track) return;
    // Dispatch on PIXEL distance to the grip bars: within HANDLE_GRAB_PX of
    // one you drag that bound (nearest wins, ties to start); anywhere else
    // on the wave is a seek, never a trim edit.
    const rect = track.getBoundingClientRect();
    const startX = rect.left + (start / duration) * rect.width;
    const endX = rect.left + (end / duration) * rect.width;
    const startDist = Math.abs(event.clientX - startX);
    const endDist = Math.abs(event.clientX - endX);
    const mode: "start" | "end" | "seek" =
      Math.min(startDist, endDist) <= HANDLE_GRAB_PX
        ? startDist <= endDist
          ? "start"
          : "end"
        : "seek";
    draggingRef.current = mode;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointers can't always be captured; drag still works.
    }
    if (mode === "seek") seekTo(event.clientX);
    else moveBound(mode, secondsFromClientX(event.clientX));
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const mode = draggingRef.current;
    if (!mode) return;
    if (mode === "seek") seekTo(event.clientX);
    else moveBound(mode, secondsFromClientX(event.clientX));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKey = (bound: "start" | "end") => (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || duration <= 0) return;
    const current = bound === "start" ? start : end;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      moveBound(bound, current - KEY_STEP_SECONDS);
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      moveBound(bound, current + KEY_STEP_SECONDS);
    }
  };

  // Fade buttons sit on the trim track, which owns every pointerdown for
  // drag-to-trim — stop the event there so pressing a toggle never moves a
  // bound underneath it.
  const stopTrackDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  const startPct = duration > 0 ? (start / duration) * 100 : 0;
  const endPct = duration > 0 ? (end / duration) * 100 : 100;
  const max = bars.length ? Math.max(...bars) : 1;
  // Width of the fade window as a % of the track — the envelope overlays
  // span exactly the region whose bars (and export samples) the ramp scales.
  const rampPct = duration > 0 ? (fadeRampSeconds(end - start) / duration) * 100 : 0;

  return (
    <div className="trim-wave">
      <div
        ref={trackRef}
        className="seek-wave-track trim-wave-track"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="seek-wave-bars" aria-hidden="true">
          {bars.map((bar, index) => {
            // Each bar's height is scaled by the export's fade envelope at
            // the bar's center time, so an enabled fade tapers the wave
            // exactly where (and how) the exported audio will taper.
            const barTime = bars.length ? ((index + 0.5) / bars.length) * duration : 0;
            const gain = fadeEnvelopeGain(barTime, start, end, fadeIn, fadeOut);
            return (
              <i key={index} style={{ height: `${Math.max(8, (bar / max) * 100) * gain}%` }} />
            );
          })}
        </div>

        {/* Scrimmed toward the background = discarded; the bright full-ink
            middle band is what gets kept. */}
        <div className="trim-shade" style={{ left: 0, width: `${startPct}%` }} aria-hidden="true" />
        <div
          className="trim-shade trim-shade-right"
          style={{ left: `${endPct}%`, width: `${100 - endPct}%` }}
          aria-hidden="true"
        />

        {/* Envelope overlays: two lines converging on the vertical center at
            the silent edge, opening to full height where the ramp ends —
            tracing exactly the taper the bars (and the export) follow. */}
        {fadeIn && rampPct > 0 && (
          <svg
            className="trim-fade-ramp"
            style={{ left: `${startPct}%`, width: `${rampPct}%` }}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <line x1="0" y1="50" x2="100" y2="0" vectorEffect="non-scaling-stroke" />
            <line x1="0" y1="50" x2="100" y2="100" vectorEffect="non-scaling-stroke" />
          </svg>
        )}
        {fadeOut && rampPct > 0 && (
          <svg
            className="trim-fade-ramp"
            style={{ left: `${endPct - rampPct}%`, width: `${rampPct}%` }}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <line x1="0" y1="0" x2="100" y2="50" vectorEffect="non-scaling-stroke" />
            <line x1="0" y1="100" x2="100" y2="50" vectorEffect="non-scaling-stroke" />
          </svg>
        )}

        {/* Fade toggles pinned to the selection's top corners. */}
        <button
          className="trim-fade-btn"
          type="button"
          style={{ left: `clamp(4px, calc(${startPct}% + 8px), calc(${endPct}% - 46px))` }}
          aria-pressed={fadeIn}
          aria-label={t("cutter.fadeIn")}
          title={t("cutter.fadeIn")}
          disabled={disabled}
          onPointerDown={stopTrackDrag}
          onClick={onToggleFadeIn}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 13.5 C 8 13.5, 8 2.5, 14 2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <button
          className="trim-fade-btn trim-fade-btn-out"
          type="button"
          style={{ left: `min(clamp(calc(${startPct}% + 46px), calc(${endPct}% - 8px), calc(100% - 4px)), calc(100% - 4px))` }}
          aria-pressed={fadeOut}
          aria-label={t("cutter.fadeOut")}
          title={t("cutter.fadeOut")}
          disabled={disabled}
          onPointerDown={stopTrackDrag}
          onClick={onToggleFadeOut}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 2.5 C 8 2.5, 8 13.5, 14 13.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <div
          className="trim-handle"
          style={{ left: `${startPct}%` }}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={t("cutter.start")}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(start)}
          aria-valuetext={formatTimeTenths(start)}
          onKeyDown={handleKey("start")}
        />
        <div
          className="trim-handle trim-handle-end"
          style={{ left: `${endPct}%` }}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={t("cutter.end")}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(end)}
          aria-valuetext={formatTimeTenths(end)}
          onKeyDown={handleKey("end")}
        />

        <div className="trim-head" aria-hidden="true" />
      </div>

      {/* Absolute times pinned under the selection edges... */}
      <div className="trim-times">
        <span style={{ left: `clamp(24px, ${startPct}%, calc(100% - 24px))` }}>{formatTimeTenths(start)}</span>
        <span style={{ left: `clamp(24px, ${endPct}%, calc(100% - 24px))` }}>{formatTimeTenths(end)}</span>
      </div>
      {/* ...and the selection length centered beneath the wave. */}
      <p className="trim-duration" aria-label={t("cutter.selection")}>
        {formatTimeTenths(Math.max(0, end - start))}
      </p>
    </div>
  );
}
