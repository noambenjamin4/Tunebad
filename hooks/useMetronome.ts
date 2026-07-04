"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAudioContextClass } from "@/lib/audio/decode";

export function useMetronome(bpm: number) {
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(1);
  const [lightOn, setLightOn] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const beatRef = useRef(1);
  const lightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playClick = useCallback((accent: boolean) => {
    const AudioContextClass = getAudioContextClass();
    if (!AudioContextClass) return;
    if (!audioContextRef.current) audioContextRef.current = new AudioContextClass();
    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "square";
    oscillator.frequency.value = accent ? 1100 : 760;
    gain.gain.setValueAtTime(accent ? 0.18 : 0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.055);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.06);
  }, []);

  useEffect(() => {
    if (!running) return;
    beatRef.current = 1;

    const tick = () => {
      setBeat(beatRef.current);
      setLightOn(true);
      if (lightTimeoutRef.current) clearTimeout(lightTimeoutRef.current);
      lightTimeoutRef.current = setTimeout(() => setLightOn(false), 90);
      playClick(beatRef.current === 1);
      beatRef.current = beatRef.current === 4 ? 1 : beatRef.current + 1;
    };

    tick();
    const timer = setInterval(tick, 60000 / Math.max(30, Math.min(300, bpm || 120)));
    return () => {
      clearInterval(timer);
      if (lightTimeoutRef.current) clearTimeout(lightTimeoutRef.current);
      setLightOn(false);
    };
  }, [running, bpm, playClick]);

  useEffect(() => () => void audioContextRef.current?.close(), []);

  const toggle = useCallback(() => setRunning((current) => !current), []);

  return { running, beat, lightOn, toggle };
}
