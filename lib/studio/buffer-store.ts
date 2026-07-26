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
 * Drop a buffer and everything derived from it: the drawn waveforms (one per
 * character effect) and any pitch-locked stretches. Call this only once no
 * clip references the id — a split leaves two clips on one buffer.
 */
export function releaseBuffer(bufferId: string): void {
  forgetDisplaySignals(bufferId);
  forgetStretched(bufferId);
  bufferMap.delete(bufferId);
}
