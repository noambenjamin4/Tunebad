"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAudioContextClass } from "@/lib/audio/decode";

// Standard Web Audio "lookahead" scheduler: a coarse setInterval wakes up
// frequently and schedules any clicks that fall within a short lookahead
// window at their exact audio-clock time, instead of relying on setInterval's
// (drifty, jittery) timing to *trigger* the sound directly.
const SCHEDULER_INTERVAL_MS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.1;

function clampBpm(bpm: number): number {
  return Math.max(30, Math.min(300, bpm || 120));
}

export function useMetronome(bpm: number) {
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(1);
  const [lightOn, setLightOn] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;
  const lightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uiTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const scheduleClick = useCallback((ctx: AudioContext, when: number, accent: boolean) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "square";
    oscillator.frequency.value = accent ? 1100 : 760;
    gain.gain.setValueAtTime(accent ? 0.18 : 0.12, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.055);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(when);
    oscillator.stop(when + 0.06);
  }, []);

  useEffect(() => {
    if (!running) return;

    const AudioContextClass = getAudioContextClass();
    if (!AudioContextClass) return;
    if (!audioContextRef.current) audioContextRef.current = new AudioContextClass();
    const ctx = audioContextRef.current;
    if (ctx.state === "suspended") void ctx.resume();

    let nextNoteTime = ctx.currentTime + 0.05;
    let beatIndex = 1;

    const scheduleUiUpdate = (beatNumber: number, when: number) => {
      const delayMs = Math.max(0, (when - ctx.currentTime) * 1000);
      const timeoutId = setTimeout(() => {
        setBeat(beatNumber);
        setLightOn(true);
        if (lightTimeoutRef.current) clearTimeout(lightTimeoutRef.current);
        lightTimeoutRef.current = setTimeout(() => setLightOn(false), 90);
      }, delayMs);
      uiTimeoutsRef.current.push(timeoutId);
    };

    const schedulerTick = () => {
      while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD_SECONDS) {
        scheduleClick(ctx, nextNoteTime, beatIndex === 1);
        scheduleUiUpdate(beatIndex, nextNoteTime);
        nextNoteTime += 60 / clampBpm(bpmRef.current);
        beatIndex = (beatIndex % 4) + 1;
      }
    };

    schedulerTick();
    const timer = setInterval(schedulerTick, SCHEDULER_INTERVAL_MS);

    return () => {
      clearInterval(timer);
      for (const id of uiTimeoutsRef.current) clearTimeout(id);
      uiTimeoutsRef.current = [];
      if (lightTimeoutRef.current) clearTimeout(lightTimeoutRef.current);
      setLightOn(false);
    };
  }, [running, scheduleClick]);

  useEffect(() => () => void audioContextRef.current?.close(), []);

  const toggle = useCallback(() => setRunning((current) => !current), []);

  // Unconditional stop, for when something else takes over the speakers (see
  // lib/audio/now-playing.ts). `toggle` can't serve: it would START a stopped
  // metronome. Clicks already scheduled inside the lookahead window still play
  // — a tail of up to SCHEDULE_AHEAD_SECONDS that would only be avoidable by
  // tracking every oscillator, which is not worth it for a 100ms click.
  const stop = useCallback(() => setRunning(false), []);

  return { running, beat, lightOn, toggle, stop };
}
