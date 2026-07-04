// Pure DSP for the Slowed + Reverb studio: speed/pitch, convolution reverb,
// and a bass-boosting low shelf. No React here — see components/remix/RemixStudio.tsx
// for the UI that wires this graph up to the transport controls.

// soundtouchjs ships no type declarations, so we import it with a suppressed
// check and describe the small slice of its API this file uses (SoundTouch
// tempo/pitch processor and the SimpleFilter that pulls stretched frames
// from a source object) via casts below.
// @ts-expect-error - soundtouchjs has no bundled or published type declarations
import * as SoundTouchJs from "soundtouchjs";

interface SoundTouchInstance {
  tempo: number;
  pitch: number;
  pitchOctaves: number;
  pitchSemitones: number;
  rate: number;
}

interface SoundTouchSource {
  extract(target: Float32Array, numFrames: number, position: number): number;
}

interface SimpleFilterInstance {
  extract(target: Float32Array, numFrames: number): number;
  sourcePosition: number;
}

const SoundTouchCtor = SoundTouchJs.SoundTouch as unknown as new () => SoundTouchInstance;
const SimpleFilterCtor = SoundTouchJs.SimpleFilter as unknown as new (
  sourceSound: SoundTouchSource,
  pipe: SoundTouchInstance,
  callback?: () => void,
) => SimpleFilterInstance;

export interface RemixParams {
  speed: number;
  reverb: number;
  bassBoostDb: number;
  lockPitch: boolean;
  pitchSemitones: number;
}

// A short, exponentially-decaying noise burst used as the reverb's impulse
// response. Cheap to generate and avoids shipping a sample asset.
export function generateImpulseResponse(ctx: BaseAudioContext, seconds = 2.8, decay = 3.5): AudioBuffer {
  const length = Math.max(1, Math.round(seconds * ctx.sampleRate));
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.exp((-decay * i) / length);
    }
  }
  return impulse;
}

// Wet/dry mix for the reverb send. Kept as a pure function so it can be unit
// tested without touching the Web Audio API.
export function remixGain(reverb: number): { wet: number; dry: number } {
  const amount = reverb / 100;
  return { wet: 0.65 * amount, dry: 1 - 0.35 * amount };
}

// Coupled-pitch display helper: when speed changes without pitch lock, the
// pitch shifts along with it (tape-style). Returns semitone offset.
export function coupledSemitones(speed: number): number {
  return 12 * Math.log2(speed);
}

export interface RemixGraph {
  source: AudioBufferSourceNode;
  dryGain: GainNode;
  wetGain: GainNode;
  bassFilter: BiquadFilterNode;
}

// Builds: source -> [dry gain, convolver -> wet gain] -> bass shelf -> destination,
// and starts the source immediately (at `offset` seconds into the buffer).
// `offset` lets playback begin partway through the buffer, which is how
// scrubbing works for an AudioBufferSourceNode: it can't be seeked in place
// once started, so seeking means stopping and rebuilding this graph with a
// new offset. The caller can still live-update dryGain/wetGain/bassFilter/
// source.playbackRate afterward.
export function buildRemixGraph(ctx: BaseAudioContext, buffer: AudioBuffer, params: RemixParams, offset = 0): RemixGraph {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = params.lockPitch ? 1 : params.speed;

  const dryGain = ctx.createGain();
  const wetGain = ctx.createGain();
  const { wet, dry } = remixGain(params.reverb);
  dryGain.gain.value = dry;
  wetGain.gain.value = wet;

  const convolver = ctx.createConvolver();
  convolver.buffer = generateImpulseResponse(ctx);

  const bassFilter = ctx.createBiquadFilter();
  bassFilter.type = "lowshelf";
  bassFilter.frequency.value = 200;
  bassFilter.gain.value = params.bassBoostDb;

  source.connect(dryGain);
  source.connect(convolver);
  convolver.connect(wetGain);

  dryGain.connect(bassFilter);
  wetGain.connect(bassFilter);
  bassFilter.connect(ctx.destination);

  const clampedOffset = Math.min(Math.max(0, offset), Math.max(0, buffer.duration - 0.001));
  source.start(0, clampedOffset);

  return { source, dryGain, wetGain, bassFilter };
}

// Renders the remix graph offline to raw channel data, ready for encoding.
// `buffer` should already be time-stretched by `timeStretch` when lockPitch is
// on (so playbackRate here only needs to apply the semitone shift's rate
// component - see below); when lockPitch is off, playbackRate carries the
// coupled speed change directly.
export async function renderRemix(
  buffer: AudioBuffer,
  params: RemixParams,
): Promise<{ channels: Float32Array[]; sampleRate: number }> {
  const numberOfChannels = Math.min(2, buffer.numberOfChannels);
  const effectiveSpeed = params.lockPitch ? 1 : params.speed;
  const length = Math.ceil((buffer.duration / effectiveSpeed + 2.8) * buffer.sampleRate);
  const offline = new OfflineAudioContext(numberOfChannels, length, buffer.sampleRate);

  buildRemixGraph(offline, buffer, params);

  const rendered = await offline.startRendering();
  const channels: Float32Array[] = [];
  for (let channel = 0; channel < rendered.numberOfChannels; channel += 1) {
    channels.push(rendered.getChannelData(channel));
  }
  return { channels, sampleRate: rendered.sampleRate };
}

// Runs SoundTouch's tempo/pitch processor offline over an AudioBuffer's
// channel data. `tempo` changes duration (1/tempo x length); `pitchSemitones`
// shifts pitch independently of tempo. SoundTouch's internal pipeline needs a
// tail of silence fed through it to fully drain its overlap buffers, so we
// pad the source with ~1s of silence and stop once the extracted audio goes
// quiet for good.
export async function timeStretch(buffer: AudioBuffer, tempo: number, pitchSemitones: number): Promise<AudioBuffer> {
  const numberOfChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const frameCount = buffer.length;
  const left = buffer.getChannelData(0);
  const right = numberOfChannels > 1 ? buffer.getChannelData(1) : left;

  const padFrames = Math.round(sampleRate * 1);
  const totalSourceFrames = frameCount + padFrames;

  const source = {
    extract(target: Float32Array, numFrames: number, position: number): number {
      let extracted = 0;
      for (let i = 0; i < numFrames; i += 1) {
        const idx = position + i;
        if (idx >= totalSourceFrames) break;
        const l = idx < frameCount ? left[idx] : 0;
        const r = idx < frameCount ? right[idx] : 0;
        target[i * 2] = l;
        target[i * 2 + 1] = r;
        extracted += 1;
      }
      return extracted;
    },
  };

  const soundTouch = new SoundTouchCtor();
  soundTouch.tempo = tempo;
  soundTouch.pitchSemitones = pitchSemitones;

  const filter = new SimpleFilterCtor(source, soundTouch);
  const chunkFrames = 4096;
  const chunk = new Float32Array(chunkFrames * 2);

  const outLeftChunks: Float32Array[] = [];
  const outRightChunks: Float32Array[] = [];
  let totalExtracted = 0;
  let lastNonSilentFrame = 0;
  const maxIterations = 200_000;
  let iterations = 0;

  while (iterations < maxIterations) {
    const framesExtracted = filter.extract(chunk, chunkFrames);
    if (framesExtracted === 0) break;

    const chunkLeft = new Float32Array(framesExtracted);
    const chunkRight = new Float32Array(framesExtracted);
    for (let i = 0; i < framesExtracted; i += 1) {
      chunkLeft[i] = chunk[i * 2];
      chunkRight[i] = chunk[i * 2 + 1];
      if (Math.abs(chunk[i * 2]) > 1e-6 || Math.abs(chunk[i * 2 + 1]) > 1e-6) {
        lastNonSilentFrame = totalExtracted + i + 1;
      }
    }
    outLeftChunks.push(chunkLeft);
    outRightChunks.push(chunkRight);
    totalExtracted += framesExtracted;
    iterations += 1;
  }

  // Trim to the last non-silent frame (drops the padding tail) but keep a
  // small margin so natural decay/reverb tails aren't clipped.
  const margin = Math.round(sampleRate * 0.05);
  const outputLength = Math.min(totalExtracted, lastNonSilentFrame + margin) || totalExtracted;

  const outLeft = new Float32Array(outputLength);
  const outRight = new Float32Array(outputLength);
  let writeIndex = 0;
  for (let c = 0; c < outLeftChunks.length && writeIndex < outputLength; c += 1) {
    const cl = outLeftChunks[c];
    const cr = outRightChunks[c];
    const remaining = outputLength - writeIndex;
    const take = Math.min(cl.length, remaining);
    outLeft.set(cl.subarray(0, take), writeIndex);
    outRight.set(cr.subarray(0, take), writeIndex);
    writeIndex += take;
  }

  const safeLength = Math.max(1, outputLength);

  if (typeof OfflineAudioContext !== "undefined") {
    const offline = new OfflineAudioContext(numberOfChannels, safeLength, sampleRate);
    const outputBuffer = offline.createBuffer(numberOfChannels, safeLength, sampleRate);
    outputBuffer.copyToChannel(outLeft as Float32Array<ArrayBuffer>, 0);
    if (numberOfChannels > 1) outputBuffer.copyToChannel(outRight as Float32Array<ArrayBuffer>, 1);
    return outputBuffer;
  }

  // Fallback (shouldn't be hit in-browser): construct via AudioContext.
  const AudioContextClass =
    typeof window !== "undefined"
      ? window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined;
  if (!AudioContextClass) throw new Error("No AudioContext available for time-stretch output.");
  const ctx = new AudioContextClass();
  const outputBuffer = ctx.createBuffer(numberOfChannels, safeLength, sampleRate);
  outputBuffer.copyToChannel(outLeft as Float32Array<ArrayBuffer>, 0);
  if (numberOfChannels > 1) outputBuffer.copyToChannel(outRight as Float32Array<ArrayBuffer>, 1);
  void ctx.close();
  return outputBuffer;
}
