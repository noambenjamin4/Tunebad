// Demo material for the DAW's empty state.
//
// A first-time visitor sees a drop zone and nothing else — every control is
// behind "clips exist", so the product is invisible until they commit a file.
// One click here builds the whole pitch: two drum loops at DIFFERENT tempos
// land overlapped with a crossfade, which is a beat switch — the thing the
// tool exists for — with the tempo-match button one click away.
//
// The loops are SYNTHESIZED in the browser (OfflineAudioContext), not shipped
// as bytes: nothing to license, nothing added to the bundle, and the WAV goes
// through the exact pipeline a dropped file uses (encode -> File -> addFiles
// -> decode), so the demo also exercises the real ingest path.

import { encodeWavFromChannels } from "@/lib/audio/mp3-encoder";

const RATE = 44100;

/**
 * One drum loop: kick on every beat, hat on the offbeats, and (bright only)
 * a snare-ish noise burst on 2 and 4 so the two loops read as different
 * songs, not the same loop at two speeds. Kicks are the loudest element on
 * purpose — the tempo detector and the beat-phase estimator both key on them.
 */
async function renderLoop(bpm: number, seconds: number, character: "warm" | "bright"): Promise<File> {
  const length = Math.ceil(seconds * RATE);
  const ctx = new OfflineAudioContext(1, length, RATE);
  const beat = 60 / bpm;

  // Shared noise buffer for hats/snares.
  const noise = ctx.createBuffer(1, Math.ceil(0.2 * RATE), RATE);
  const nd = noise.getChannelData(0);
  // Deterministic pseudo-noise: the demo should sound identical every run.
  let seed = 0x9e3779b9;
  for (let i = 0; i < nd.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    nd[i] = (seed / 0xffffffff) * 2 - 1;
  }

  const noiseHit = (at: number, gain: number, hz: number, decay: number) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = hz;
    filter.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + decay);
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start(at);
    src.stop(at + decay + 0.01);
  };

  for (let i = 0, at = 0; at < seconds - 0.35; at = ++i * beat) {
    // Kick: pitch drop 120 -> 45 Hz.
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(120, at);
    osc.frequency.exponentialRampToValueAtTime(45, at + 0.12);
    g.gain.setValueAtTime(0.85, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.26);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.3);

    // Offbeat hat.
    noiseHit(at + beat / 2, character === "bright" ? 0.22 : 0.12, 8000, 0.05);
    // Backbeat snare, bright loop only.
    if (character === "bright" && i % 2 === 1) noiseHit(at, 0.3, 2000, 0.12);
  }

  const rendered = await ctx.startRendering();
  const blob = encodeWavFromChannels([rendered.getChannelData(0)], RATE);
  return new File([blob], `Demo ${bpm} BPM.wav`, { type: "audio/wav" });
}

/** The two demo songs: a slower warm loop and a faster bright one. */
export function makeDemoFiles(): Promise<File[]> {
  return Promise.all([renderLoop(90, 12, "warm"), renderLoop(120, 12, "bright")]);
}

/** How far the second loop overlaps the first — the crossfade span. */
export const DEMO_OVERLAP_SECONDS = 3;
