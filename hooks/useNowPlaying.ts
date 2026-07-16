"use client";

import { useEffect, useRef } from "react";
import { registerPlaybackStopper, setNowPlaying } from "@/lib/audio/now-playing";

/**
 * Join the global playback registry: report whether this source is playing, and
 * hand over the means to stop it so another tool can take over the speakers.
 *
 * Replaces the copy of these effects that every audio tool grew independently.
 * That copy only ever announced playback; nobody could stop anybody, which is
 * why two songs could run at once.
 *
 * @param source unique key, e.g. "cutter-preview"
 * @param playing whether this source is currently producing sound
 * @param stop    silence this source NOW — must act synchronously (call
 *                audio.pause() / source.stop() directly, don't rely on a React
 *                state update alone, whose effect flushes too late to prevent
 *                an audible overlap). Re-entrancy is fine: reporting
 *                playing=false from inside it is expected and handled.
 */
export function useNowPlaying(source: string, playing: boolean, stop: () => void): void {
  // Held in a ref so the registration below never goes stale, while callers
  // stay free to pass an inline closure without re-registering every render.
  const stopRef = useRef(stop);
  stopRef.current = stop;

  useEffect(() => {
    const unregister = registerPlaybackStopper(source, () => stopRef.current());
    return () => {
      unregister();
      // Unmounting silences this source as far as everyone else is concerned;
      // without this the disc would spin forever for a tool that is gone.
      setNowPlaying(source, false);
    };
  }, [source]);

  useEffect(() => {
    setNowPlaying(source, playing);
  }, [source, playing]);
}
