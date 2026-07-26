"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";

/** Everything at or above this is drawn as the danger zone (-6 dBFS). */
const HOT = 0.5;
/** Latch the clip light here rather than at exactly 1: reverb and the
 *  character stages add level after the sum, and a peak this close is
 *  already shaving transients. */
const CLIP = 0.99;
/** How long the clip light stays lit — long enough to notice a peak that
 *  lasted a single sample and was gone before the next frame. */
const CLIP_HOLD_MS = 1600;

/**
 * Master output level.
 *
 * Twelve clips summing at gain 1 will pass full scale easily, and until now
 * nothing said so: the export limiter caught it at -1 dBFS, so the file was
 * never damaged, it just quietly came out squashed with no way to know which
 * clip to pull down. This makes it visible while there is still a decision
 * to make.
 *
 * Owns its own rAF and writes to the DOM directly. Level through React state
 * would re-render the whole panel — and every clip canvas — sixty times a
 * second, which is the exact mistake the transport clock already avoids.
 */
export function LevelMeter({
  getLevel,
  playing,
}: {
  getLevel: () => number;
  playing: boolean;
}) {
  const { t } = useI18n();
  const fillRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLSpanElement>(null);
  const getRef = useRef(getLevel);
  getRef.current = getLevel;

  useEffect(() => {
    let raf = 0;
    // Decayed peak: the raw value flickers far too fast to read, so the bar
    // jumps up instantly and falls back slowly — how a real meter behaves,
    // and the only way a transient is visible at all.
    let shown = 0;
    let clippedAt = 0;

    const paint = () => {
      const level = getRef.current();
      shown = level > shown ? level : shown * 0.88;
      if (level >= CLIP) clippedAt = performance.now();

      if (fillRef.current) {
        fillRef.current.style.transform = `scaleX(${Math.min(1, shown)})`;
        fillRef.current.dataset.hot = shown >= HOT ? "true" : "false";
      }
      if (clipRef.current) {
        const lit = clippedAt > 0 && performance.now() - clippedAt < CLIP_HOLD_MS;
        clipRef.current.dataset.lit = lit ? "true" : "false";
      }
      raf = requestAnimationFrame(paint);
    };

    if (playing) {
      raf = requestAnimationFrame(paint);
    } else if (fillRef.current) {
      // Park at zero rather than freezing on the last frame, which would
      // read as "still that loud".
      fillRef.current.style.transform = "scaleX(0)";
    }
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  return (
    <div className="studio-meter" title={t("studio.meterHint")}>
      <div className="studio-meter-track" aria-hidden="true">
        <div ref={fillRef} className="studio-meter-fill" data-hot="false" />
      </div>
      <span ref={clipRef} className="studio-meter-clip num" data-lit="false">
        {t("studio.meterClip")}
      </span>
    </div>
  );
}
