// Offline rendering for the TuneBad DAW: mix the clip timeline down to one
// AudioBuffer, then (optionally) replay the user's recorded master-bus moves
// over it and encode. The mixdown schedules clips with the SAME
// computeClipSchedule the live engine uses, so what you export is what you
// heard — the two can only drift if that one function changes.

import {
  type StudioClip,
  computeClipSchedule,
  timelineDuration,
} from "./timeline";
import {
  type AutomationEvent,
  type RemixParams,
  renderRemix,
  renderRemixAutomated,
} from "@/lib/audio/remix";
import { limitPeak } from "@/lib/audio/bass-boost";
import { encodeMp3FromChannels, encodeWavFromChannels } from "@/lib/audio/mp3-encoder";
import type { StageReporter } from "@/lib/audio/stages";
import { nextPaint } from "@/lib/audio/stages";

/**
 * Speed-1 mixdown of the timeline, no master effects. Sample rate = the
 * highest rate among the clips (OfflineAudioContext resamples each source
 * automatically); channels = stereo unless every clip is mono.
 */
export async function renderTimeline(
  clips: StudioClip[],
  buffers: Map<string, AudioBuffer>,
): Promise<AudioBuffer> {
  if (clips.length === 0) throw new Error("empty timeline");
  const used = clips.map((c) => {
    const buffer = buffers.get(c.bufferId);
    if (!buffer) throw new Error(`missing buffer for clip ${c.id}`);
    return buffer;
  });
  const sampleRate = Math.max(...used.map((b) => b.sampleRate));
  const numberOfChannels = Math.min(2, Math.max(...used.map((b) => b.numberOfChannels)));
  const length = Math.max(1, Math.ceil(timelineDuration(clips) * sampleRate));
  const offline = new OfflineAudioContext(numberOfChannels, length, sampleRate);

  for (const scheduled of computeClipSchedule(clips, 0, 1)) {
    const buffer = buffers.get(scheduled.bufferId);
    if (!buffer) continue;
    const source = offline.createBufferSource();
    source.buffer = buffer;
    const gainNode = offline.createGain();
    gainNode.gain.value = scheduled.gain;
    if (scheduled.fadePoints.length > 0) {
      gainNode.gain.setValueAtTime(scheduled.fadePoints[0].gain, scheduled.fadePoints[0].at);
      for (let i = 1; i < scheduled.fadePoints.length; i++) {
        gainNode.gain.linearRampToValueAtTime(scheduled.fadePoints[i].gain, scheduled.fadePoints[i].at);
      }
    }
    source.connect(gainNode);
    gainNode.connect(offline.destination);
    source.start(scheduled.when, scheduled.offsetInBuffer, scheduled.sourceDuration);
  }

  return offline.startRendering();
}

export interface StudioExportOptions {
  format: "wav" | "mp3";
  mp3Kbps?: number;
  /** Master-bus params (speed/reverb/effect/bass/EQ). lockPitch must be false. */
  params: RemixParams;
  /** A recorded take to replay; when absent the static params render. */
  take?: { base: RemixParams; events: AutomationEvent[]; startOffset: number } | null;
  onStage?: StageReporter;
}

/**
 * Full export: mixdown -> master effects (automated take or static params)
 * -> peak limit at -1 dBFS (N summed clips + convolver energy WILL exceed
 * 0 dBFS on real material) -> encode.
 */
export async function exportStudioMix(
  clips: StudioClip[],
  buffers: Map<string, AudioBuffer>,
  options: StudioExportOptions,
): Promise<Blob> {
  const { format, mp3Kbps = 320, params, take, onStage } = options;

  onStage?.("rendering");
  await nextPaint();
  let mixdown: AudioBuffer | null = await renderTimeline(clips, buffers);

  const staticParams: RemixParams = { ...params, lockPitch: false };
  const rendered = take
    ? await renderRemixAutomated(mixdown, { ...take.base, lockPitch: false }, take.events, take.startOffset)
    : await renderRemix(mixdown, staticParams);
  mixdown = null; // free the intermediate before encoding

  onStage?.("normalizing");
  await nextPaint();
  limitPeak(rendered.channels, -1);

  if (format === "wav") return encodeWavFromChannels(rendered.channels, rendered.sampleRate);
  return encodeMp3FromChannels(rendered.channels, rendered.sampleRate, mp3Kbps);
}
