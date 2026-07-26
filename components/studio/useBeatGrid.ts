"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { bufferMap } from "@/lib/studio/buffer-store";
import {
  type BeatGrid,
  DEFAULT_BEATS_PER_BAR,
  MAX_BPM,
  MIN_BPM,
  detectTempo,
  estimateBeatPhase,
  warmTempoWorker,
} from "@/lib/studio/beat-grid";
import type { DisplaySignal } from "@/lib/studio/display-signal";
import type { StudioClip } from "@/lib/studio/timeline";

export interface BeatGridState {
  /** Project grid, or null while unknown. Null also means "draw no bars". */
  grid: BeatGrid | null;
  setGrid: (grid: BeatGrid | null) => void;
  gridOn: boolean;
  setGridOn: React.Dispatch<React.SetStateAction<boolean>>;
  detecting: boolean;
  failed: boolean;
  /** Detected tempo per BUFFER id, for the inspector and beatmatch. */
  clipBpms: Map<string, number>;
  /** Record a tempo for a buffer produced by stretching (beatmatch). */
  noteClipBpm: (bufferId: string, bpm: number) => void;
  /** Set the project tempo by hand — the BPM field and the x2 / ÷2 buttons. */
  setGridBpm: (bpm: number) => void;
}

/**
 * Tempo analysis and the project's beat grid.
 *
 * The grid comes from the FIRST clip on the timeline: in a beat switch that
 * is the track everything else has to line up with. Every clip still gets its
 * own tempo, keyed by buffer so a split or a duplicate costs no second
 * analysis, which is what lets the inspector say "this one is 140 against a
 * 128 project" and offer to fix it.
 */
export function useBeatGrid(
  clips: StudioClip[],
  signals: Map<string, DisplaySignal>,
): BeatGridState {
  const [grid, setGrid] = useState<BeatGrid | null>(null);
  const [gridOn, setGridOn] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [clipBpms, setClipBpms] = useState<Map<string, number>>(new Map());
  const gridSourceRef = useRef<string | null>(null);
  const bpmRequestedRef = useRef<Set<string>>(new Set());

  // Compile the tempo engine while the user is still choosing files, so the
  // first detection is not a cold start racing its own timeout.
  useEffect(() => {
    warmTempoWorker();
  }, []);

  // Detection runs once per source clip; the phase pass needs that clip's
  // display signal, so this waits for both rather than guessing a downbeat
  // at zero.
  useEffect(() => {
    const first = [...clips].sort((a, b) => a.timelineStart - b.timelineStart)[0];
    if (!first) {
      gridSourceRef.current = null;
      setGrid(null);
      setFailed(false);
      return;
    }
    if (gridSourceRef.current === first.bufferId) return;
    const buffer = bufferMap.get(first.bufferId);
    const signal = signals.get(first.bufferId);
    if (!buffer || !signal) return;

    gridSourceRef.current = first.bufferId;
    setDetecting(true);
    setFailed(false);
    let cancelled = false;
    void detectTempo(buffer).then((tempo) => {
      if (cancelled) return;
      setDetecting(false);
      if (!tempo) {
        setFailed(true);
        setGrid(null);
        return;
      }
      // Phase is measured in SOURCE seconds; map it onto the timeline through
      // the clip's own trim and position.
      const phase = estimateBeatPhase(signal, tempo.bpm);
      setGrid({
        bpm: tempo.bpm,
        anchorSec: first.timelineStart + (phase - first.clipStart),
        beatsPerBar: DEFAULT_BEATS_PER_BAR,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [clips, signals]);

  // One analysis per buffer, never repeated, and a failure just means no
  // number rather than a retry loop.
  useEffect(() => {
    for (const id of new Set(clips.map((c) => c.bufferId))) {
      if (bpmRequestedRef.current.has(id)) continue;
      const buffer = bufferMap.get(id);
      if (!buffer) continue;
      bpmRequestedRef.current.add(id);
      void detectTempo(buffer).then((tempo) => {
        if (!tempo) return;
        setClipBpms((prev) => new Map(prev).set(id, tempo.bpm));
      });
    }
  }, [clips]);

  const noteClipBpm = useCallback((bufferId: string, bpm: number) => {
    setClipBpms((prev) => new Map(prev).set(bufferId, bpm));
  }, []);

  const setGridBpm = useCallback((bpm: number) => {
    if (!Number.isFinite(bpm) || bpm < MIN_BPM || bpm > MAX_BPM) return;
    setGrid((prev) =>
      prev
        ? { ...prev, bpm: Math.round(bpm) }
        : { bpm: Math.round(bpm), anchorSec: 0, beatsPerBar: DEFAULT_BEATS_PER_BAR },
    );
    setFailed(false);
  }, []);

  return {
    grid,
    setGrid,
    gridOn,
    setGridOn,
    detecting,
    failed,
    clipBpms,
    noteClipBpm,
    setGridBpm,
  };
}
