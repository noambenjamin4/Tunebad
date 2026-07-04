import { decodeAudioFile } from "@/lib/audio/decode";

// Module-level cache of the single most recently decoded file. Several panels
// (analyzer, loudness, remix) may decode the same file in quick succession —
// e.g. a user re-opening the same preview — so this avoids a redundant
// decodeAudioData pass. Only the AudioBuffer is cached; the arrayBuffer is
// NOT cached because hooks/useAnalyzer.ts reads the raw bytes independently
// and decodeAudioFile's caller may still hold/transfer that buffer elsewhere,
// so re-decoding from the File on a cache hit keeps arrayBuffer semantics
// exactly as before for any caller that needs it.
let cacheKey: string | null = null;
let cachedBuffer: AudioBuffer | null = null;

function keyFor(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export async function decodeAudioFileCached(file: File): Promise<{ buffer: AudioBuffer; arrayBuffer: ArrayBuffer }> {
  const key = keyFor(file);
  if (key === cacheKey && cachedBuffer) {
    // Cache hit: still need the arrayBuffer for callers that use it (e.g.
    // bit-depth detection), so read it fresh from the File — cheap compared
    // to the decode itself, and avoids any risk of a detached/transferred
    // ArrayBuffer being handed out twice.
    const arrayBuffer = await file.arrayBuffer();
    return { buffer: cachedBuffer, arrayBuffer };
  }

  const result = await decodeAudioFile(file);
  cacheKey = key;
  cachedBuffer = result.buffer;
  return result;
}
