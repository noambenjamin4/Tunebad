// Minimal global "is any audio playing" signal. Independent playback sources
// (analyzer preview, loudness preview, remix studio, metronome) each register
// themselves under a unique key; the logo spins whenever the set is non-empty.
// Deliberately not React state — a plain module-level Set + a DOM CustomEvent
// keeps this decoupled from any single component's lifecycle.

const NOW_PLAYING_EVENT = "tunebad:nowplaying";

const activeSources = new Set<string>();

export interface NowPlayingDetail {
  playing: boolean;
}

export function setNowPlaying(source: string, playing: boolean): void {
  if (playing) {
    activeSources.add(source);
  } else {
    activeSources.delete(source);
  }
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<NowPlayingDetail>(NOW_PLAYING_EVENT, {
      detail: { playing: activeSources.size > 0 },
    }),
  );
}

export function isAnyAudioPlaying(): boolean {
  return activeSources.size > 0;
}

export { NOW_PLAYING_EVENT };
