// Live playback engine for the TuneBad DAW. One AudioContext per start (the
// RemixStudio pattern — avoids Safari's live-context cap and gives every
// start a clean clock), all clips scheduled up front as BufferSourceNodes:
//
//   clip source (playbackRate = masterSpeed) -> clipGain (gain × fade ramps)
//     -> mixBus -> buildRemixChain(reverb/EQ/effect/bass) -> destination
//
// Live-tweakable in place: reverb amount, bass, reverb EQ, character effect,
// per-clip gain. Everything else (seek, master speed, reverb type, clip
// edits) = stop + reschedule at the same timeline position — the same
// piecewise-constant model RemixStudio uses, so the recorded automation
// events replay correctly through renderRemixAutomated.

import {
  type RemixParams,
  type RemixChain,
  buildRemixChain,
  remixGain,
  applyEffectParams,
  applyReverbEqParams,
} from "@/lib/audio/remix";
import { type StudioClip, computeClipSchedule, timelineDuration } from "./timeline";

interface ActiveGraph {
  ctx: AudioContext;
  chain: RemixChain;
  mixBus: GainNode;
  sources: AudioBufferSourceNode[];
  clipGains: Map<string, GainNode>;
  startedAt: number; // ctx.currentTime at start
  startPos: number; // timeline seconds at start
  speed: number;
  endTimer: number;
}

export class StudioEngine {
  private graph: ActiveGraph | null = null;
  private position = 0; // timeline seconds while stopped
  private params: RemixParams;
  private onEnded: (() => void) | null = null;

  constructor(params: RemixParams, onEnded?: () => void) {
    this.params = params;
    this.onEnded = onEnded ?? null;
  }

  get playing(): boolean {
    return this.graph !== null;
  }

  /** Timeline position in seconds, on demand (no per-frame state). */
  getPosition(): number {
    const g = this.graph;
    if (!g) return this.position;
    // startedAt sits 30ms in the future at start — clamp so the readout
    // never dips below the start position while the first samples queue.
    return Math.max(g.startPos, g.startPos + (g.ctx.currentTime - g.startedAt) * g.speed);
  }

  /** Wall-clock output seconds since start — the take recorder's clock. */
  getOutputTime(): number {
    const g = this.graph;
    if (!g) return 0;
    return g.ctx.currentTime - g.startedAt;
  }

  start(clips: StudioClip[], buffers: Map<string, AudioBuffer>, position = this.position): void {
    this.stop();
    const duration = timelineDuration(clips);
    if (clips.length === 0 || position >= duration - 0.01) return;

    const speed = Math.max(0.01, this.params.lockPitch ? 1 : this.params.speed);
    const ctx = new AudioContext();
    // Autoplay policy can hand out a suspended context even from a click
    // handler (Safari after tab restore, embedded frames). Best-effort.
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const mixBus = ctx.createGain();
    const chain = buildRemixChain(ctx, mixBus, ctx.destination, this.params);

    const sources: AudioBufferSourceNode[] = [];
    const clipGains = new Map<string, GainNode>();
    const t0 = ctx.currentTime + 0.03; // small offset so ramps at t=0 land cleanly
    for (const scheduled of computeClipSchedule(clips, position, speed)) {
      const buffer = buffers.get(scheduled.bufferId);
      if (!buffer) continue;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = speed;
      const gainNode = ctx.createGain();
      gainNode.gain.value = scheduled.gain;
      if (scheduled.fadePoints.length > 0) {
        gainNode.gain.setValueAtTime(scheduled.fadePoints[0].gain, t0 + scheduled.fadePoints[0].at);
        for (let i = 1; i < scheduled.fadePoints.length; i++) {
          gainNode.gain.linearRampToValueAtTime(
            scheduled.fadePoints[i].gain,
            t0 + scheduled.fadePoints[i].at,
          );
        }
      }
      source.connect(gainNode);
      gainNode.connect(mixBus);
      source.start(t0 + scheduled.when, scheduled.offsetInBuffer, scheduled.sourceDuration);
      sources.push(source);
      clipGains.set(scheduled.clipId, gainNode);
    }

    // One timer for "the timeline ran out" — per-source onended fires per
    // clip and can't tell "clip done" from "transport done".
    const remainingWall = ((duration - position) / speed) * 1000 + 80;
    const endTimer = window.setTimeout(() => {
      this.position = 0;
      this.teardown();
      this.onEnded?.();
    }, remainingWall);

    this.graph = { ctx, chain, mixBus, sources, clipGains, startedAt: t0, startPos: position, speed, endTimer };
  }

  /** Stop and remember the current position (synchronous silence). */
  stop(): void {
    if (!this.graph) return;
    this.position = Math.max(0, this.getPosition());
    this.teardown();
  }

  private teardown(): void {
    const g = this.graph;
    if (!g) return;
    this.graph = null;
    window.clearTimeout(g.endTimer);
    for (const source of g.sources) {
      try {
        source.stop();
      } catch {
        // never started or already stopped
      }
    }
    g.ctx.close().catch(() => {});
  }

  seek(seconds: number): void {
    this.position = Math.max(0, seconds);
  }

  /** Replace params. Returns true when the change needs a restart to apply. */
  setParams(next: RemixParams): boolean {
    const prev = this.params;
    this.params = next;
    const g = this.graph;
    if (!g) return false;

    const needsRestart = next.speed !== prev.speed || next.reverbType !== prev.reverbType;
    if (needsRestart) return true;

    const { wet, dry } = remixGain(next.reverb);
    g.chain.wetGain.gain.value = wet;
    g.chain.dryGain.gain.value = dry;
    g.chain.bassFilter.gain.value = next.bassBoostDb;
    if (next.effect !== prev.effect) applyEffectParams(g.chain.effect, next.effect);
    if (next.reverbEq !== prev.reverbEq) applyReverbEqParams(g.chain.reverbEq, next.reverbEq);
    return false;
  }

  setClipGain(clipId: string, gain: number): void {
    const node = this.graph?.clipGains.get(clipId);
    if (node) node.gain.value = gain;
  }

  dispose(): void {
    this.teardown();
  }
}
