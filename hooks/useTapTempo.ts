"use client";

import { useCallback, useRef, useState } from "react";
import { clampBpm } from "@/lib/format";

export function useTapTempo(windowMs: number) {
  const timesRef = useRef<number[]>([]);
  const [bpm, setBpm] = useState<number | null>(null);
  const [count, setCount] = useState(0);

  const tap = useCallback((): number | null => {
    const now = performance.now();
    timesRef.current = timesRef.current.filter((time) => now - time < windowMs);
    timesRef.current.push(now);
    setCount(timesRef.current.length);
    if (timesRef.current.length >= 2) {
      const times = timesRef.current;
      const intervals = times.slice(1).map((time, index) => time - times[index]);
      const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
      const next = clampBpm(60000 / average);
      setBpm(next);
      return next;
    }
    return null;
  }, [windowMs]);

  const reset = useCallback(() => {
    timesRef.current = [];
    setBpm(null);
    setCount(0);
  }, []);

  return { bpm, count, tap, reset };
}
