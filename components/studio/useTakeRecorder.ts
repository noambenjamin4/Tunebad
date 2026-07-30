"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  type AutomationEvent,
  type RemixParams,
  automatedOutputDuration,
} from "@/lib/audio/remix";
import type { StudioEngine } from "@/lib/studio/engine";

export interface StudioTake {
  id: string;
  label: string;
  base: RemixParams;
  events: AutomationEvent[];
  startOffset: number;
  outDuration: number;
}

let nextTakeId = 1;
const makeTakeId = () => `take-${nextTakeId++}`;

/**
 * Move the counter past every restored id, so a take recorded after a reload
 * cannot be handed an id a restored one already has. Same hazard the clip ids
 * have: nothing crashes, the two takes just become indistinguishable to every
 * id-keyed operation, including which one gets exported.
 */
function reserveTakeIds(takes: StudioTake[]): void {
  for (const take of takes) {
    const match = /^take-(\d+)$/.exec(take.id);
    if (!match) continue;
    const n = Number(match[1]);
    if (Number.isFinite(n) && n >= nextTakeId) nextTakeId = n + 1;
  }
}

export interface TakeRecorder {
  takes: StudioTake[];
  selectedTakeId: string | null;
  setSelectedTakeId: (id: string | null) => void;
  /** Render-time flag. Callbacks should ask `isRecording()` instead. */
  recording: boolean;
  isRecording: () => boolean;
  /** Current time on the take's clock, for stamping an automation event. */
  outputNow: () => number;
  recordMove: (event: AutomationEvent) => void;
  begin: (base: RemixParams, startOffset: number) => void;
  finish: () => void;
  /** Throw away every take — the arrangement they belong to is gone. */
  clear: () => void;
  /** Install performances recovered from a saved session. */
  adopt: (takes: StudioTake[]) => void;
  /** Drop one take. Selection moves off it if it was the exported one. */
  deleteTake: (id: string) => void;
  /** User-supplied label; empty input keeps the old one. */
  renameTake: (id: string, label: string) => void;
  /** Readout while recording: moves captured and seconds on the take clock. */
  moveCount: number;
  recordElapsed: number;
}

/**
 * Live performance capture on the master bus: knob moves are recorded as
 * timestamped automation events and replayed by renderRemixAutomated at
 * export, so a bounce reproduces the performance instead of a static mix.
 *
 * Events are stamped in OUTPUT seconds, which the ENGINE keeps. It has to:
 * graphs are replaced constantly (a clip edit, a speed change, a seek, a loop
 * wrap) and each one only knows its own lifetime. This used to bank the
 * elapsed time here instead, which worked for the restarts the panel caused
 * and silently failed for the one it could not see — the loop wrap, which
 * restarts playback from inside the engine.
 *
 * `getTimelineSeconds` is a getter rather than a value because a take can
 * outlive several arrangements of the clips underneath it.
 */
export function useTakeRecorder(
  engine: StudioEngine,
  getTimelineSeconds: () => number,
): TakeRecorder {
  const { t } = useI18n();
  const [takes, setTakes] = useState<StudioTake[]>([]);
  const [selectedTakeId, setSelectedTakeId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const takesRef = useRef(takes);
  takesRef.current = takes;

  const recordingRef = useRef(false);
  const eventsRef = useRef<AutomationEvent[]>([]);
  const takeBaseRef = useRef<RemixParams | null>(null);
  const takeStartRef = useRef(0);

  const isRecording = useCallback(() => recordingRef.current, []);

  const outputNow = useCallback(() => engine.getOutputTime(), [engine]);

  // Mirrors of the in-progress take, purely for the readout: events stay in a
  // ref so finish() can read them synchronously (same reasoning as
  // RemixStudio's recorder), and these two exist only so the UI re-renders.
  const [moveCount, setMoveCount] = useState(0);
  const [recordElapsed, setRecordElapsed] = useState(0);

  const recordMove = useCallback((event: AutomationEvent) => {
    if (!recordingRef.current) return;
    eventsRef.current.push(event);
    setMoveCount(eventsRef.current.length);
  }, []);

  // Elapsed ticks on the OUTPUT clock — the same reference the events are
  // stamped in — so the readout agrees with where a move would land. A plain
  // interval, not rAF: it must keep counting in a backgrounded tab.
  useEffect(() => {
    if (!recording) return;
    const tick = () => setRecordElapsed(Math.max(0, engine.getOutputTime()));
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [recording, engine]);

  const begin = useCallback((base: RemixParams, startOffset: number) => {
    takeBaseRef.current = base;
    takeStartRef.current = startOffset;
    engine.resetOutputClock();
    eventsRef.current = [];
    setMoveCount(0);
    setRecordElapsed(0);
    recordingRef.current = true;
    setRecording(true);
  }, [engine]);

  const finish = useCallback(() => {
    recordingRef.current = false;
    setRecording(false);
    const events = eventsRef.current;
    eventsRef.current = [];
    const base = takeBaseRef.current;
    if (events.length === 0 || !base) return;
    const mixSeconds = getTimelineSeconds();
    const outDuration = automatedOutputDuration(
      Math.max(0, mixSeconds - takeStartRef.current),
      Math.max(0.01, base.lockPitch ? 1 : base.speed),
      events,
    );
    const take: StudioTake = {
      id: makeTakeId(),
      // Numbered from a ref, not from the `takes` state: finish() is reached
      // from the engine's ended callback, which is older than this render.
      label: `${t("studio.takeLabel")} ${takesRef.current.length + 1}`,
      base,
      events,
      startOffset: takeStartRef.current,
      outDuration,
    };
    setTakes((prev) => [...prev, take]);
    setSelectedTakeId(take.id);
  }, [getTimelineSeconds, t]);

  const clear = useCallback(() => {
    recordingRef.current = false;
    setRecording(false);
    eventsRef.current = [];
    takeBaseRef.current = null;
    setTakes([]);
    setSelectedTakeId(null);
  }, []);

  const adopt = useCallback((restored: StudioTake[]) => {
    if (restored.length === 0) return;
    reserveTakeIds(restored);
    setTakes(restored);
  }, []);

  const deleteTake = useCallback((id: string) => {
    setTakes((prev) => prev.filter((take) => take.id !== id));
    setSelectedTakeId((prev) => (prev === id ? null : prev));
  }, []);

  const renameTake = useCallback((id: string, label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setTakes((prev) => prev.map((take) => (take.id === id ? { ...take, label: trimmed } : take)));
  }, []);

  return {
    takes,
    selectedTakeId,
    setSelectedTakeId,
    recording,
    isRecording,
    outputNow,
    recordMove,
    begin,
    finish,
    clear,
    adopt,
    deleteTake,
    renameTake,
    moveCount,
    recordElapsed,
  };
}
