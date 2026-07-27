// The Info/LAME header frame that makes an MP3 report its own encoder delay.
//
// THE PROBLEM, measured rather than assumed. Exporting a 10.000 s mix as WAV
// gives a 10.000 s file whose first sample is the first sample of the music.
// The same mix as MP3 decoded to 10.032 s with 1,016 samples (23 ms) of
// silence in front of it.
//
// That is not a bug in the mix — it is how MP3 works. The encoder needs
// samples of lookahead before it can emit the first frame, so every LAME
// stream begins with a fixed slug of padding, and the decoder adds its own.
// The cure is metadata, not DSP: a single leading frame that states how many
// samples to throw away at the start and the end. Players that read it (and
// Chrome's decoder does) hand back exactly the audio that went in.
//
// wasm-media-encoders never emits that frame — the stream starts on a raw
// audio frame and there is no "Xing" or "Info" marker anywhere in it — so
// nothing downstream can know. This builds it.
//
// If any of this were subtly wrong the failure is bounded and dull: the frame
// carries no audio, so a decoder that doesn't recognise the tag simply plays
// one extra frame of silence (26 ms) instead of stripping 23. It cannot
// corrupt the stream or the frames after it.

/** LAME's fixed encoder delay, in samples. Constant for a given encoder. */
const ENCODER_DELAY = 576;
/** Samples per MPEG-1 Layer III frame. */
const SAMPLES_PER_FRAME = 1152;

const BITRATES_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const BITRATES_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
const SAMPLE_RATES_V1 = [44100, 48000, 32000, 0];

interface FrameHeader {
  /** true for MPEG-1 (44.1/48/32 kHz), false for the half-rate versions. */
  mpeg1: boolean;
  mono: boolean;
  bitrateKbps: number;
  sampleRate: number;
}

/**
 * Read the first frame's header. Every frame in a CBR stream shares it, so
 * the tag frame can be built by copying these four bytes verbatim — which
 * also means the tag can never disagree with the stream about its own format.
 */
function readFrameHeader(stream: Uint8Array): FrameHeader | null {
  if (stream.length < 4 || stream[0] !== 0xff || (stream[1] & 0xe0) !== 0xe0) return null;
  const versionBits = (stream[1] >> 3) & 0x03;
  const layerBits = (stream[1] >> 1) & 0x03;
  if (layerBits !== 0x01) return null; // Layer III only
  const mpeg1 = versionBits === 0x03;
  const bitrateIndex = (stream[2] >> 4) & 0x0f;
  const sampleIndex = (stream[2] >> 2) & 0x03;
  const channelMode = (stream[3] >> 6) & 0x03;

  const bitrateKbps = (mpeg1 ? BITRATES_V1 : BITRATES_V2)[bitrateIndex];
  let sampleRate = SAMPLE_RATES_V1[sampleIndex];
  if (!mpeg1) sampleRate /= versionBits === 0x02 ? 2 : 4; // MPEG-2 / 2.5
  if (!bitrateKbps || !sampleRate) return null;

  return { mpeg1, mono: channelMode === 0x03, bitrateKbps, sampleRate };
}

/**
 * Bytes between the frame header and the start of the tag. The Info marker
 * has to sit AFTER the side-information block, whose size depends on both the
 * MPEG version and whether the stream is mono — get this wrong and the tag is
 * invisible to every decoder.
 */
function sideInfoBytes(header: FrameHeader): number {
  if (header.mpeg1) return header.mono ? 17 : 32;
  return header.mono ? 9 : 17;
}

/**
 * Prepend an Info/LAME header frame describing `pcmSamples` of real audio.
 *
 * Returns the stream unchanged if it doesn't start on a frame header we
 * understand — an MP3 without gapless metadata is a small flaw, and one with
 * a bogus first frame is a bigger one.
 */
export function withGaplessHeader(stream: Uint8Array, pcmSamples: number): Uint8Array {
  const header = readFrameHeader(stream);
  if (!header) return stream;

  const samplesPerFrame = header.mpeg1 ? SAMPLES_PER_FRAME : SAMPLES_PER_FRAME / 2;
  // CBR frame length. The tag frame carries no payload, so it never needs the
  // padding bit and the +0 is deliberate.
  const frameLength = Math.floor((144 * header.bitrateKbps * 1000) / header.sampleRate);
  if (frameLength < 24) return stream;

  const audioFrames = Math.ceil((pcmSamples + ENCODER_DELAY) / samplesPerFrame);
  // What the encoder appended past the end of the real audio to fill the
  // final frame. Together with the delay this is what a player strips.
  const padding = Math.max(0, audioFrames * samplesPerFrame - pcmSamples - ENCODER_DELAY);

  const frame = new Uint8Array(frameLength);
  const view = new DataView(frame.buffer);
  // Copy the stream's own header, then clear the padding bit: the tag frame
  // is a fixed length and must not claim an extra byte.
  frame.set(stream.subarray(0, 4), 0);
  frame[2] &= ~0x02;

  let at = 4 + sideInfoBytes(header);
  const ascii = (text: string) => {
    for (let i = 0; i < text.length; i++) frame[at + i] = text.charCodeAt(i);
    at += text.length;
  };

  // "Info" is the CBR spelling of the tag; "Xing" means VBR, and claiming
  // VBR here would make players scan for a table that isn't there.
  ascii("Info");
  view.setUint32(at, 0x0003); at += 4; // flags: frame count + byte count
  view.setUint32(at, audioFrames); at += 4;
  view.setUint32(at, frameLength + stream.length); at += 4;

  // The LAME extension. Only the delay/padding pair actually matters here;
  // the rest is the fixed-size run-up to it, which decoders skip over but
  // whose LENGTH they rely on to find the pair.
  ascii("LAME3.100");
  at += 11; // revision, lowpass, replaygain, flags, bitrate — all zero
  frame[at] = (ENCODER_DELAY >> 4) & 0xff;
  frame[at + 1] = ((ENCODER_DELAY & 0x0f) << 4) | ((padding >> 8) & 0x0f);
  frame[at + 2] = padding & 0xff;

  const out = new Uint8Array(frameLength + stream.length);
  out.set(frame, 0);
  out.set(stream, frameLength);
  return out;
}
