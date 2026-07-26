"use client";

import { useEffect, useState } from "react";
import type { EffectId } from "@/lib/audio/remix";
import { bufferMap } from "@/lib/studio/buffer-store";
import {
  type DisplaySignal,
  getDisplaySignal,
  peekDisplaySignal,
} from "@/lib/studio/display-signal";
import type { StudioClip } from "@/lib/studio/timeline";

/**
 * The waveform data the timeline draws, keyed by bufferId.
 *
 * The wave must show what you HEAR: when the master is in phone / underwater
 * / lo-fi, every clip's display signal is re-rendered through those same
 * filter frequencies, so the shape thins out exactly where the audio does.
 * Renders are cached per (buffer, effect) in display-signal.ts, so cached
 * variants are published in the same tick — flipping an effect back and
 * forth never blanks the timeline — and only genuine misses resolve async.
 */
export function useDisplaySignals(
  clips: StudioClip[],
  effect: EffectId,
): Map<string, DisplaySignal> {
  const [signals, setSignals] = useState<Map<string, DisplaySignal>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const ids = [...new Set(clips.map((c) => c.bufferId))];

    const immediate = new Map<string, DisplaySignal>();
    const missing: string[] = [];
    for (const id of ids) {
      const hit = peekDisplaySignal(id, effect);
      if (hit) immediate.set(id, hit);
      else missing.push(id);
    }
    setSignals(immediate);

    for (const id of missing) {
      const buffer = bufferMap.get(id);
      if (!buffer) continue;
      void getDisplaySignal(id, buffer, effect).then((signal) => {
        if (cancelled) return;
        setSignals((prev) => new Map(prev).set(id, signal));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [clips, effect]);

  return signals;
}
