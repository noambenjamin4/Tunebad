"use client";

import { useEffect, useState } from "react";
import type { EffectId } from "@/lib/audio/remix";
import { bufferMap } from "@/lib/studio/buffer-store";
import {
  type DisplaySignal,
  getDisplaySignal,
  displayKey,
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
    // One entry per DISTINCT (buffer, clip effect) pair, not per buffer: two
    // clips can share audio and disagree about the effect on it, and two
    // clips that agree still share a single render.
    const wanted = new Map<string, { bufferId: string; chain: EffectId[] }>();
    for (const clip of clips) {
      wanted.set(displayKey(clip.bufferId, clip.effect, effect), {
        bufferId: clip.bufferId,
        chain: [clip.effect ?? "none", effect],
      });
    }

    const immediate = new Map<string, DisplaySignal>();
    const missing: string[] = [];
    for (const key of wanted.keys()) {
      const hit = peekDisplaySignal(key);
      if (hit) immediate.set(key, hit);
      else missing.push(key);
    }
    setSignals(immediate);

    for (const key of missing) {
      const want = wanted.get(key)!;
      const buffer = bufferMap.get(want.bufferId);
      if (!buffer) continue;
      void getDisplaySignal(key, buffer, want.chain).then((signal) => {
        if (cancelled) return;
        setSignals((prev) => new Map(prev).set(key, signal));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [clips, effect]);

  return signals;
}
