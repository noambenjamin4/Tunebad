"use client";

import { useEffect, useRef } from "react";
import { formatTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

const SEEK_STEP_SECONDS = 5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function SeekableWaveform({
  bars,
  currentTime,
  duration,
  playing,
  onSeek,
  onTogglePlay,
  disabled,
}: {
  bars: number[];
  currentTime: number;
  duration: number;
  playing: boolean;
  onSeek: (seconds: number) => void;
  onTogglePlay: () => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const trackRef = useRef<HTMLDivElement>(null);
  const pointerActiveRef = useRef(false);

  const pct = duration > 0 ? clamp((currentTime / duration) * 100, 0, 100) : 0;

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
    onSeek(frac * duration);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || duration <= 0) return;
    pointerActiveRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
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
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onSeek(clamp(currentTime - SEEK_STEP_SECONDS, 0, duration));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      onSeek(clamp(currentTime + SEEK_STEP_SECONDS, 0, duration));
    } else if (event.key === "Home") {
      event.preventDefault();
      onSeek(0);
    } else if (event.key === "End") {
      event.preventDefault();
      onSeek(duration);
    }
  };

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
          aria-valuenow={currentTime}
          aria-label={t("analysis.seek")}
          tabIndex={disabled ? -1 : 0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onKeyDown={handleKeyDown}
        >
          <div className="seek-wave-bars" aria-hidden="true">
            {bars.map((height, index) => (
              <i key={index} style={{ "--bar-height": `${height}px` } as React.CSSProperties} />
            ))}
          </div>
          <div className="seek-wave-played" style={{ width: `${pct}%` }} aria-hidden="true">
            <div className="seek-wave-bars played">
              {bars.map((height, index) => (
                <i key={index} style={{ "--bar-height": `${height}px` } as React.CSSProperties} />
              ))}
            </div>
          </div>
          <div className="seek-wave-head" style={{ left: `${pct}%` }} aria-hidden="true" />
        </div>

        <div className="seek-wave-times">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
