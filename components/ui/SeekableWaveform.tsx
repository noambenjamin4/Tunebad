"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

const SEEK_STEP_SECONDS = 5;
const DISPLAY_UPDATE_MS = 250;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function SeekableWaveform({
  bars,
  duration,
  playing,
  getCurrentTime,
  onSeek,
  onTogglePlay,
  disabled,
}: {
  bars: number[];
  duration: number;
  playing: boolean;
  getCurrentTime: () => number;
  onSeek: (seconds: number) => void;
  onTogglePlay: () => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const trackRef = useRef<HTMLDivElement>(null);
  const pointerActiveRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const getCurrentTimeRef = useRef(getCurrentTime);
  getCurrentTimeRef.current = getCurrentTime;

  // Coarse, React-rendered readout (aria-valuenow + the time text). Updated at
  // ~4 Hz while playing so React doesn't re-render on every animation frame —
  // the actual playhead position is driven imperatively via a CSS var below.
  const [displayTime, setDisplayTime] = useState(() => getCurrentTime());

  const applyPct = (seconds: number) => {
    const track = trackRef.current;
    if (!track) return;
    const pct = duration > 0 ? clamp((seconds / duration) * 100, 0, 100) : 0;
    track.style.setProperty("--seek-pct", `${pct}%`);
  };

  // rAF loop: imperatively updates the CSS var every frame while playing. No
  // setState here — that's the whole point (avoids re-rendering ~240 bar
  // elements twice per update, 4-60x/sec).
  useEffect(() => {
    const tick = () => {
      applyPct(getCurrentTimeRef.current());
      rafRef.current = requestAnimationFrame(tick);
    };
    if (playing) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      // One update when playback stops, so the head/fill reflect the final position.
      applyPct(getCurrentTimeRef.current());
    }
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, duration]);

  // Coarse React state for aria-valuenow + the mm:ss text, throttled to 4 Hz.
  useEffect(() => {
    if (!playing) {
      setDisplayTime(getCurrentTimeRef.current());
      return;
    }
    setDisplayTime(getCurrentTimeRef.current());
    const interval = setInterval(() => {
      setDisplayTime(getCurrentTimeRef.current());
    }, DISPLAY_UPDATE_MS);
    return () => clearInterval(interval);
  }, [playing]);

  // The played layer is width-clipped to `pct`, but its bars must line up
  // with the base layer's bars — so its inner row is pinned to the track's
  // full pixel width (kept in sync via a CSS var) rather than 100% of the
  // clipped container.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const setWidthVar = () => {
      track.style.setProperty("--seek-wave-track-width", `${track.getBoundingClientRect().width}px`);
    };
    setWidthVar();
    const observer = new ResizeObserver(setWidthVar);
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  const seekFromClientX = (clientX: number) => {
    const track = trackRef.current;
    if (!track || duration <= 0) return;
    const rect = track.getBoundingClientRect();
    const frac = clamp((clientX - rect.left) / rect.width, 0, 1);
    const seconds = frac * duration;
    // Follow the pointer immediately during an active scrub.
    applyPct(seconds);
    setDisplayTime(seconds);
    onSeek(seconds);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || duration <= 0) return;
    pointerActiveRef.current = true;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some pointer sources (synthetic events, detached pointers) can't be
      // captured — scrubbing still works via the move/up handlers below.
    }
    seekFromClientX(event.clientX);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerActiveRef.current) return;
    seekFromClientX(event.clientX);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    pointerActiveRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || duration <= 0) return;
    const current = getCurrentTimeRef.current();
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      const seconds = clamp(current - SEEK_STEP_SECONDS, 0, duration);
      applyPct(seconds);
      setDisplayTime(seconds);
      onSeek(seconds);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      const seconds = clamp(current + SEEK_STEP_SECONDS, 0, duration);
      applyPct(seconds);
      setDisplayTime(seconds);
      onSeek(seconds);
    } else if (event.key === "Home") {
      event.preventDefault();
      applyPct(0);
      setDisplayTime(0);
      onSeek(0);
    } else if (event.key === "End") {
      event.preventDefault();
      applyPct(duration);
      setDisplayTime(duration);
      onSeek(duration);
    }
  };

  const barElements = useMemo(
    () => bars.map((height, index) => <i key={index} style={{ "--bar-height": `${height}px` } as React.CSSProperties} />),
    [bars],
  );
  const playedBarElements = useMemo(
    () => bars.map((height, index) => <i key={index} style={{ "--bar-height": `${height}px` } as React.CSSProperties} />),
    [bars],
  );

  return (
    <div className="seek-wave">
      <button
        className="round-button"
        type="button"
        disabled={disabled}
        aria-label={playing ? t("analysis.pausePreview") : t("analysis.playPreview")}
        onClick={onTogglePlay}
      >
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="5" y="4" width="5" height="16" fill="currentColor" />
            <rect x="14" y="4" width="5" height="16" fill="currentColor" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <polygon points="6,4 20,12 6,20" fill="currentColor" />
          </svg>
        )}
      </button>

      <div className="seek-wave-main">
        <div
          className="seek-wave-track"
          ref={trackRef}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={displayTime}
          aria-label={t("analysis.seek")}
          tabIndex={disabled ? -1 : 0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onKeyDown={handleKeyDown}
        >
          <div className="seek-wave-bars" aria-hidden="true">
            {barElements}
          </div>
          <div className="seek-wave-played" aria-hidden="true">
            <div className="seek-wave-bars played">{playedBarElements}</div>
          </div>
          <div className="seek-wave-head" aria-hidden="true" />
        </div>

        <div className="seek-wave-times">
          <span>{formatTime(displayTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
