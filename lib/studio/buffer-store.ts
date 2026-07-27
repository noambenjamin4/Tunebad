// Decoded audio for the DAW, held OUTSIDE React state.
//
// Three reasons it does not belong in useState: the buffers are large (a
// 4-minute stereo track is ~40 MB of PCM), nothing about them changes on its
// own so they never need to trigger a render, and the site's single-entry
// decode cache would thrash the moment a second clip existed.
//
// The map is exported directly rather than behind get/set wrappers. Callers
// do `.has` / `.get` / `.set` / `.delete` and a wrapper around each would be
// four functions that add a name and prevent nothing. What DOES earn a
// function is `releaseBuffer`, because forgetting a buffer means forgetting
// three separate derived caches and missing one is a silent leak.

import { forgetDisplaySignals } from "./display-signal";
import { forgetStretched } from "./lock-pitch";

/** bufferId -> decoded audio. Ids come from `bufferKey` or `stretchedIdFor`. */
export const bufferMap = new Map<string, AudioBuffer>();

/**
 * Identity of a dropped file. Same name, size and mtime means the same audio,
 * so re-dropping a file already on the timeline reuses its decode instead of
 * spending a second and another 40 MB on an identical copy.
 */
export function bufferKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

/** Total PCM held, in bytes — Float32 per sample per channel. */
export function decodedBytes(): number {
  let total = 0;
  for (const b of bufferMap.values()) total += b.length * b.numberOfChannels * 4;
  return total;
}

/**
 * Every buffer id the given clip sets can still reach.
 *
 * "Still reachable" is the only safe test for whether audio is dead, and it
 * has to include the undo history: deleting a clip used to free its buffer
 * immediately, so undoing the delete brought the clip back with no audio
 * behind it — silent, no waveform, and no way to recover it short of
 * reloading the page.
 *
 * `sourceBufferId` counts too. A beatmatched clip plays a stretched buffer
 * that is never stored, and is rebuilt on restore from the origin it records;
 * forget the origin and the clip cannot come back.
 */
export function reachableBufferIds(...clipSets: { bufferId: string; sourceBufferId?: string }[][]): Set<string> {
  const reachable = new Set<string>();
  for (const clips of clipSets) {
    for (const clip of clips) {
      reachable.add(clip.bufferId);
      if (clip.sourceBufferId) reachable.add(clip.sourceBufferId);
    }
  }
  return reachable;
}

/** Free every buffer outside `reachable`. Returns the ids actually dropped. */
export function releaseUnreachable(reachable: Set<string>): string[] {
  const dropped: string[] = [];
  for (const id of [...bufferMap.keys()]) {
    if (reachable.has(id)) continue;
    releaseBuffer(id);
    dropped.push(id);
  }
  return dropped;
}

/**
 * Drop a buffer and everything derived from it: the drawn waveforms (one per
 * character effect) and any pitch-locked stretches. Call this only once no
 * clip references the id — a split leaves two clips on one buffer.
 */
export function releaseBuffer(bufferId: string): void {
  forgetDisplaySignals(bufferId);
  forgetStretched(bufferId);
  bufferMap.delete(bufferId);
}
