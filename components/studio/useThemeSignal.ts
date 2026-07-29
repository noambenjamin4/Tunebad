"use client";

// A counter that bumps whenever the OS light/dark theme flips.
//
// Everything CSS-styled follows a theme change on its own; a <canvas> does
// not. ClipCanvas reads the --ink variable at PAINT time and has always taken
// a `themeSignal` prop to repaint on — but nothing ever produced the signal,
// so it sat at its default forever. Flip the OS to dark and every surface
// updated except the painted waveforms, which kept their light-mode ink:
// dark-on-dark, invisible.
//
// The site themes exclusively via prefers-color-scheme (no manual toggle), so
// matchMedia is the single authoritative source. The bump is synchronous, NOT
// deferred through requestAnimationFrame: by the time the change event fires
// the new media query has applied, getComputedStyle forces any pending recalc
// at paint time anyway — and rAF never fires in a hidden tab, so a deferred
// bump silently drops the repaint for anyone who switches theme while the tab
// is backgrounded and comes back to the exact invisible waveform this fixes.

import { useEffect, useState } from "react";

export function useThemeSignal(): number {
  const [signal, setSignal] = useState(0);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSignal((n) => n + 1);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return signal;
}
