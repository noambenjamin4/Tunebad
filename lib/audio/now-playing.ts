// Global playback registry: what is playing, and how to stop it.
//
// Two jobs, deliberately in one module because they answer the same question
// ("what is making noise right now?"):
//
//   1. The logo disc spins whenever anything is playing.
//   2. ONLY ONE SOURCE PLAYS AT A TIME — starting any source stops the others.
//
// WHY (2) EXISTS. Each tool owned its own player and knew nothing about the
// rest, so starting the MP3 cutter while Slowed & Reverb was running left BOTH
// running: two songs on top of each other, and the only way out was to go find
// the other tool's pause button. Switching tabs does not help — these tools
// stay mounted, which is exactly why their audio outlives the view you left.
//
// The exclusivity lives HERE rather than in each tool on purpose. Six players
// each pausing five others is thirty relationships to keep in sync, and every
// future tool would have to remember to join in. Registering a stopper is one
// line, and a source that forgets simply keeps its old behaviour rather than
// breaking someone else's.
//
// Deliberately not React state — a module-level Set + a DOM CustomEvent keeps
// this decoupled from any single component's lifecycle.
//
// Sources: analyzer-preview, cutter-preview, loudness-preview, master-preview,
// remix-preview, metronome. Prefer the useNowPlaying hook over calling these
// directly; it ties the state sync, the stopper and unmount cleanup together,
// which is easy to get subtly wrong by hand.

const NOW_PLAYING_EVENT = "tunebad:nowplaying";

const activeSources = new Set<string>();

/** How to silence each source. Registered on mount, dropped on unmount. */
const stoppers = new Map<string, () => void>();

export interface NowPlayingDetail {
  playing: boolean;
}

/**
 * Teach the registry how to stop `source`. Returns an unregister function.
 *
 * The callback MUST pause/stop the audio synchronously — it runs while another
 * source is starting, so anything deferred (a bare React state update, whose
 * effect flushes later) would let the two overlap audibly.
 */
export function registerPlaybackStopper(source: string, stop: () => void): () => void {
  stoppers.set(source, stop);
  return () => {
    // Only drop our own entry: under StrictMode/remount the new component can
    // register before the old one's cleanup runs, and an unconditional delete
    // would silence the live player.
    if (stoppers.get(source) === stop) stoppers.delete(source);
  };
}

export function setNowPlaying(source: string, playing: boolean): void {
  if (playing) {
    // Snapshot first: a stopper usually re-enters this function synchronously
    // (its own onPause fires), which would mutate activeSources mid-iteration.
    const others = [...activeSources].filter((s) => s !== source);
    for (const other of others) stoppers.get(other)?.();
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
