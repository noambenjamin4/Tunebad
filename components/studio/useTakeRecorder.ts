"use client";

import { useCallback, useRef, useState } from "react";
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
  /** Bank elapsed output time before the engine is torn down and rebuilt. */
  bankTime: () => void;
  begin: (base: RemixParams, startOffset: number) => void;
  finish: () => void;
}

/**
 * Live performance capture on the master bus: knob moves are recorded as
 * timestamped automation events and replayed by renderRemixAutomated at
 * export, so a bounce reproduces the performance instead of a static mix.
 *
 * The clock is the subtle part. Events are stamped in OUTPUT seconds, but
 * every reschedule (a clip edit, a speed change) tears the engine down and
 * gives the next one a fresh AudioContext whose clock restarts at zero — so
 * elapsed time is banked into `recordBase` before each teardown and added
 * back. `getTimelineSeconds` is a getter rather than a value because a take
 * can outlive several arrangements of the clips underneath it.
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
  const recordBaseRef = useRef(0);
  const eventsRef = useRef<AutomationEvent[]>([]);
  const takeBaseRef = useRef<RemixParams | null>(null);
  const takeStartRef = useRef(0);

  const isRecording = useCallback(() => recordingRef.current, []);

  const outputNow = useCallback(
    () => recordBaseRef.current + engine.getOutputTime(),
    [engine],
  );

  const recordMove = useCallback((event: AutomationEvent) => {
    if (!recordingRef.current) return;
    eventsRef.current.push(event);
  }, []);

  const bankTime = useCallback(() => {
    recordBaseRef.current += engine.getOutputTime();
  }, [engine]);

  const begin = useCallback((base: RemixParams, startOffset: number) => {
    takeBaseRef.current = base;
    takeStartRef.current = startOffset;
    recordBaseRef.current = 0;
    eventsRef.current = [];
    recordingRef.current = true;
    setRecording(true);
  }, []);

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

  return {
    takes,
    selectedTakeId,
    setSelectedTakeId,
    recording,
    isRecording,
    outputNow,
    recordMove,
    bankTime,
    begin,
    finish,
  };
}
