// Live playback engine for the TuneBad DAW.
//
//   clip source (playbackRate = masterSpeed) -> clipGain (gain × fade ramps)
//     -> mixBus -> master -> buildRemixChain(reverb/EQ/effect/bass) -> out
//
// THREE RULES, all learned from a knob that clicked and lagged:
//
// 1. ONE AudioContext for the engine's life. Creating one costs milliseconds
//    and real hardware setup; a slider dragged at pointer-move rate used to
//    create and close ~60 per second.
// 2. NOTHING is torn down without a ramp. mixBus fades over FADE_SECONDS
//    before sources stop and after they start, so a rebuild is inaudible
//    instead of a click (a hard stop mid-waveform IS the click).
// 3. A knob NEVER rebuilds the graph on its own. Speed applies live via
//    playbackRate — continuous in amplitude, so it cannot click — and the
//    caller reschedules once, after the gesture, to fix the wall-clock start
//    times of clips that have not begun yet.
//
// Live in place: master speed, reverb amount, bass, reverb EQ, character
// effect, per-clip gain. Rebuild (ramped): seek, reverb type, clip edits.

import {
  type RemixParams,
  type RemixChain,
  buildRemixChain,
  remixGain,
  applyEffectParams,
  applyReverbEqParams,
} from "@/lib/audio/remix";
import { type StudioClip, computeClipSchedule, timelineDuration } from "./timeline";

/** Long enough to kill the click, short enough to read as instant. */
const FADE_SECONDS = 0.012;

interface ActiveGraph {
  sources: AudioBufferSourceNode[];
  clipGains: Map<string, GainNode>;
  startedAt: number; // ctx.currentTime the position clock is based on
  startPos: number; // timeline seconds at that instant
  speed: number;
  endTimer: number;
  duration: number; // timeline length this graph was scheduled against
}

export class StudioEngine {
  private ctx: AudioContext | null = null;
  private mixBus: GainNode | null = null;
  private chain: RemixChain | null = null;
  private chainReverbType: string | null = null;
  private graph: ActiveGraph | null = null;
  // ctx time at which the last fade-OUT completes. A restart must wait for
  // it: cancelling that ramp and forcing the gain to 0 would silence the
  // still-sounding old sources instantly, which is the very click the ramp
  // exists to prevent.
  private silentAt = 0;
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
    if (!g || !this.ctx) return this.position;
    // startedAt sits slightly in the future at start — clamp so the readout
    // never dips below the start position while the first samples queue.
    return Math.max(g.startPos, g.startPos + (this.ctx.currentTime - g.startedAt) * g.speed);
  }

  /** Wall-clock output seconds since start — the take recorder's clock. */
  getOutputTime(): number {
    const g = this.graph;
    if (!g || !this.ctx) return 0;
    return Math.max(0, this.ctx.currentTime - g.startedAt);
  }

  /**
   * The one context, created on first use. Reused for the whole session:
   * per-start contexts are what made every knob turn expensive.
   */
  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.mixBus = this.ctx.createGain();
      this.mixBus.gain.value = 0;
    }
    // Autoplay policy can hand out a suspended context even from a click
    // handler (Safari after tab restore, embedded frames). Best-effort.
    if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  /** Master chain, rebuilt only when the reverb TYPE changes (new IR). */
  private ensureChain(ctx: AudioContext, mixBus: GainNode): RemixChain {
    if (this.chain && this.chainReverbType === this.params.reverbType) return this.chain;
    if (this.chain) mixBus.disconnect();
    this.chain = buildRemixChain(ctx, mixBus, ctx.destination, this.params);
    this.chainReverbType = this.params.reverbType;
    return this.chain;
  }

  start(clips: StudioClip[], buffers: Map<string, AudioBuffer>, position = this.position): void {
    this.stopSources();
    const duration = timelineDuration(clips);
    if (clips.length === 0 || position >= duration - 0.01) return;

    const speed = Math.max(0.01, this.params.lockPitch ? 1 : this.params.speed);
    const ctx = this.ensureContext();
    const mixBus = this.mixBus!;
    this.ensureChain(ctx, mixBus);

    const sources: AudioBufferSourceNode[] = [];
    const clipGains = new Map<string, GainNode>();
    // Resume only once any in-flight fade-out has landed, so the two ramps
    // meet at zero instead of the second one cutting the first.
    const resumeAt = Math.max(ctx.currentTime, this.silentAt);
    const t0 = resumeAt + 0.02;
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

    // Fade the master IN so the first sample isn't a step from silence.
    // No cancelScheduledValues: a pending fade-out is legitimate and lands
    // before resumeAt.
    mixBus.gain.setValueAtTime(0, resumeAt);
    mixBus.gain.linearRampToValueAtTime(1, t0 + FADE_SECONDS);

    this.graph = {
      sources,
      clipGains,
      startedAt: t0,
      startPos: position,
      speed,
      duration,
      endTimer: this.armEndTimer(duration, position, speed),
    };
  }

  /** One timer for "the timeline ran out" — per-source onended can't tell
   *  "this clip finished" from "the transport finished". */
  private armEndTimer(duration: number, position: number, speed: number): number {
    const remainingWall = ((duration - position) / speed) * 1000 + 80;
    return window.setTimeout(() => {
      this.position = 0;
      this.stopSources();
      this.onEnded?.();
    }, Math.max(0, remainingWall));
  }

  /** Stop playback, remembering where we were. */
  stop(): void {
    if (!this.graph) return;
    this.position = Math.max(0, this.getPosition());
    this.stopSources();
  }

  /**
   * Silence and drop the current sources. The master ramps down first, then
   * sources stop just after the ramp lands — audibly immediate (12 ms), but
   * without the discontinuity that a bare source.stop() leaves behind.
   */
  private stopSources(): void {
    const g = this.graph;
    if (!g) return;
    this.graph = null;
    window.clearTimeout(g.endTimer);

    const ctx = this.ctx;
    const mixBus = this.mixBus;
    if (!ctx || !mixBus) return;
    const now = ctx.currentTime;
    const stopAt = now + FADE_SECONDS;
    this.silentAt = stopAt;
    mixBus.gain.cancelScheduledValues(now);
    mixBus.gain.setValueAtTime(Math.max(0.0001, mixBus.gain.value), now);
    mixBus.gain.linearRampToValueAtTime(0, stopAt);
    for (const source of g.sources) {
      try {
        source.stop(stopAt);
      } catch {
        // never started, or already stopped
      }
    }
  }

  seek(seconds: number): void {
    this.position = Math.max(0, seconds);
  }

  /**
   * Master speed, applied to a RUNNING graph with no rebuild: playbackRate
   * is continuous in amplitude, so it cannot click, and re-basing the clock
   * keeps getPosition() exact across the change.
   *
   * Clips that have not started yet keep wall-clock start times computed at
   * the old speed, so the caller must reschedule once the gesture settles
   * (StudioPanel debounces that) — during the drag itself you hear the new
   * speed immediately and nothing is torn down.
   */
  setSpeedLive(speed: number): void {
    const g = this.graph;
    const ctx = this.ctx;
    if (!g || !ctx) return;
    const next = Math.max(0.01, speed);
    if (next === g.speed) return;

    // Re-base BEFORE changing rate: everything up to now happened at the old
    // speed, everything after at the new one.
    g.startPos = this.getPosition();
    g.startedAt = ctx.currentTime;
    g.speed = next;
    for (const source of g.sources) source.playbackRate.value = next;

    window.clearTimeout(g.endTimer);
    g.endTimer = this.armEndTimer(g.duration, g.startPos, next);
  }

  /**
   * Replace params. Returns true when the change needs a reschedule to be
   * exact — speed reports true (pending clips), but it has ALREADY applied
   * live, so the caller may defer that reschedule until the knob settles.
   */
  setParams(next: RemixParams): boolean {
    const prev = this.params;
    this.params = next;
    const g = this.graph;
    if (!g) return false;

    if (next.reverbType !== prev.reverbType) return true;

    if (next.speed !== prev.speed || next.lockPitch !== prev.lockPitch) {
      this.setSpeedLive(next.lockPitch ? 1 : next.speed);
      return true;
    }

    const chain = this.chain;
    if (!chain) return false;
    const { wet, dry } = remixGain(next.reverb);
    chain.wetGain.gain.value = wet;
    chain.dryGain.gain.value = dry;
    chain.bassFilter.gain.value = next.bassBoostDb;
    if (next.effect !== prev.effect) applyEffectParams(chain.effect, next.effect);
    if (next.reverbEq !== prev.reverbEq) applyReverbEqParams(chain.reverbEq, next.reverbEq);
    return false;
  }

  setClipGain(clipId: string, gain: number): void {
    const node = this.graph?.clipGains.get(clipId);
    if (node) node.gain.value = gain;
  }

  dispose(): void {
    this.stopSources();
    this.chain = null;
    this.chainReverbType = null;
    this.mixBus = null;
    const ctx = this.ctx;
    this.ctx = null;
    // Outlive the fade so the last ramp isn't cut into a click on unmount.
    if (ctx) window.setTimeout(() => void ctx.close().catch(() => {}), 60);
  }
}
