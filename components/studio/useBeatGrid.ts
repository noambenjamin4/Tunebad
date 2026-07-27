"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { bufferMap } from "@/lib/studio/buffer-store";
import {
  type BeatGrid,
  DEFAULT_BEATS_PER_BAR,
  MAX_BPM,
  MIN_BPM,
  type ClipAnalysis,
  analyseClip,
  estimateBeatPhase,
  warmAnalysisWorker,
} from "@/lib/studio/beat-grid";
import type { DisplaySignal } from "@/lib/studio/display-signal";
import type { StudioClip } from "@/lib/studio/timeline";

export interface BeatGridState {
  /** Project grid, or null while unknown. Null also means "draw no bars". */
  grid: BeatGrid | null;
  /**
   * Install a grid recovered from a saved session and protect it from
   * re-detection, against the source clip it was measured on.
   */
  adoptGrid: (grid: BeatGrid, sourceBufferId: string) => void;
  gridOn: boolean;
  setGridOn: React.Dispatch<React.SetStateAction<boolean>>;
  detecting: boolean;
  failed: boolean;
  /** Tempo AND key per BUFFER id, for the inspector and beatmatch. */
  clipInfo: Map<string, ClipAnalysis>;
  /** Record analysis for a buffer produced by stretching (beatmatch). */
  noteClipInfo: (bufferId: string, info: ClipAnalysis) => void;
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
  const [clipInfo, setClipInfo] = useState<Map<string, ClipAnalysis>>(new Map());
  const gridSourceRef = useRef<string | null>(null);
  // The buffer whose tempo the USER settled, by typing it or by restoring a
  // saved session. Detection may not overwrite it.
  //
  // Detection used to win unconditionally on mount, which quietly destroyed
  // the correction: type 140 over a detected 70, reload, and the estimate is
  // back on screen AND the autosave writes it over the 140 on disk. The
  // octave miss is exactly why the field is editable, so the one fix for it
  // could not survive a refresh.
  //
  // Pinned to the SOURCE rather than set as a global flag, so dropping in a
  // genuinely different opening track still detects — the pin protects a
  // decision about one piece of audio, not the session forever.
  const pinnedSourceRef = useRef<string | null>(null);
  const bpmRequestedRef = useRef<Set<string>>(new Set());

  // The clip the grid comes from: in a beat switch that is the track
  // everything else lines up with. Read by the effect below and by
  // setGridBpm, which needs it before the effect next runs.
  const firstBufferId =
    [...clips].sort((a, b) => a.timelineStart - b.timelineStart)[0]?.bufferId ?? null;
  const firstBufferRef = useRef<string | null>(null);
  firstBufferRef.current = firstBufferId;

  // Compile the tempo engine while the user is still choosing files, so the
  // first detection is not a cold start racing its own timeout.
  useEffect(() => {
    warmAnalysisWorker();
  }, []);

  // Detection runs once per source clip; the phase pass needs that clip's
  // display signal, so this waits for both rather than guessing a downbeat
  // at zero.
  useEffect(() => {
    const first = [...clips].sort((a, b) => a.timelineStart - b.timelineStart)[0];
    if (!first) {
      gridSourceRef.current = null;
      pinnedSourceRef.current = null;
      setGrid(null);
      setFailed(false);
      return;
    }
    if (pinnedSourceRef.current === first.bufferId) return;
    if (gridSourceRef.current === first.bufferId) return;
    const buffer = bufferMap.get(first.bufferId);
    const signal = signals.get(first.bufferId);
    if (!buffer || !signal) return;

    gridSourceRef.current = first.bufferId;
    setDetecting(true);
    setFailed(false);
    let cancelled = false;
    void analyseClip(buffer).then((tempo) => {
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
      void analyseClip(buffer).then((info) => {
        if (!info) return;
        setClipInfo((prev) => new Map(prev).set(id, info));
      });
    }
  }, [clips]);

  const noteClipInfo = useCallback((bufferId: string, info: ClipAnalysis) => {
    setClipInfo((prev) => new Map(prev).set(bufferId, info));
  }, []);

  const adoptGrid = useCallback((grid: BeatGrid, sourceBufferId: string) => {
    pinnedSourceRef.current = sourceBufferId;
    setGrid(grid);
  }, []);

  const setGridBpm = useCallback((bpm: number) => {
    if (!Number.isFinite(bpm) || bpm < MIN_BPM || bpm > MAX_BPM) return;
    pinnedSourceRef.current = firstBufferRef.current;
    setGrid((prev) =>
      prev
        ? { ...prev, bpm: Math.round(bpm) }
        : { bpm: Math.round(bpm), anchorSec: 0, beatsPerBar: DEFAULT_BEATS_PER_BAR },
    );
    setFailed(false);
  }, []);

  return {
    grid,
    adoptGrid,
    gridOn,
    setGridOn,
    detecting,
    failed,
    clipInfo,
    noteClipInfo,
    setGridBpm,
  };
}
