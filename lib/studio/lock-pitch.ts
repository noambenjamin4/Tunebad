// Lock pitch for the DAW: slow the mix down without dropping its pitch.
//
// THE TRICK, and why it is a clip transformation rather than an engine mode.
// An AudioBufferSourceNode can only change speed by changing pitch with it —
// that IS tape. To decouple them, each clip's buffer is pre-stretched offline
// (SoundTouch, via lib/audio/remix.ts timeStretch) and then played at rate 1.
//
// A buffer stretched by `speed` is `1/speed` as long, so a clip that occupied
// timeline [T, T+L] must now occupy [T/speed, (T+L)/speed] in the engine's
// internal clock, playing at rate 1. Scaling EVERY time field by 1/speed and
// scheduling at speed 1 reproduces the unlocked wall-clock timing exactly —
// same seams, same overlaps, same fades — with the pitch left alone.
//
// Because the result is just "different clips, different buffers, speed 1",
// live playback and the offline bounce keep sharing computeClipSchedule, so
// the export still cannot drift from the preview.

import { timeStretch } from "@/lib/audio/remix";
import type { StudioClip } from "./timeline";

/** Stretch cache key. Speed is quantised so slider jitter can't thrash it. */
export function stretchedIdFor(bufferId: string, speed: number): string {
  return `${bufferId}@${speed.toFixed(2)}`;
}

export function quantiseSpeed(speed: number): number {
  return Math.round(speed * 100) / 100;
}

const cache = new Map<string, AudioBuffer>();
const pending = new Map<string, Promise<AudioBuffer>>();

/** Cached pre-stretch. `speed` only — pitch shifting stays out of the DAW. */
export function getStretchedBuffer(
  bufferId: string,
  buffer: AudioBuffer,
  speed: number,
): Promise<AudioBuffer> {
  const key = stretchedIdFor(bufferId, speed);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;

  const job = timeStretch(buffer, speed, 0)
    .then((stretched) => {
      cache.set(key, stretched);
      pending.delete(key);
      return stretched;
    })
    .catch((err) => {
      pending.delete(key);
      throw err;
    });
  pending.set(key, job);
  return job;
}

export function peekStretchedBuffer(bufferId: string, speed: number): AudioBuffer | null {
  return cache.get(stretchedIdFor(bufferId, speed)) ?? null;
}

/** Drop every stretched variant of one buffer (its last clip was removed). */
export function forgetStretched(bufferId: string): void {
  for (const key of [...cache.keys()]) {
    if (key.startsWith(`${bufferId}@`)) cache.delete(key);
  }
}

/**
 * Pure: rewrite clips onto their stretched buffers, with every time field
 * divided by `speed`. The result is meant to be scheduled at speed 1, and
 * the engine multiplies its clock back by `speed` to report timeline
 * seconds. Returns the input untouched at speed 1 (nothing to stretch).
 */
export function scaleClipsForLock(clips: StudioClip[], speed: number): StudioClip[] {
  if (speed === 1) return clips;
  const k = 1 / speed;
  return clips.map((clip) => ({
    ...clip,
    bufferId: stretchedIdFor(clip.bufferId, speed),
    timelineStart: clip.timelineStart * k,
    clipStart: clip.clipStart * k,
    clipEnd: clip.clipEnd * k,
    fadeInSec: clip.fadeInSec * k,
    fadeOutSec: clip.fadeOutSec * k,
  }));
}
