export function getAudioContextClass(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext || null;
}

export async function decodeAudioFile(file: File): Promise<{ buffer: AudioBuffer; arrayBuffer: ArrayBuffer }> {
  const AudioContextClass = getAudioContextClass();
  if (!AudioContextClass) throw new Error("This browser cannot decode audio files.");
  const audioContext = new AudioContextClass();
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    return { buffer, arrayBuffer };
  } finally {
    void audioContext.close();
  }
}

export function monoSamples(buffer: AudioBuffer): Float32Array {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const output = new Float32Array(length);
  for (let channel = 0; channel < channels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) output[i] += data[i] / channels;
  }
  return output;
}

// Resample mono samples to targetRate with an OfflineAudioContext; halves the
// analysis cost without hurting BPM/key accuracy.
export async function resampleMono(samples: Float32Array, sampleRate: number, targetRate: number): Promise<Float32Array> {
  if (sampleRate === targetRate) return samples;
  const duration = samples.length / sampleRate;
  const offline = new OfflineAudioContext(1, Math.ceil(duration * targetRate), targetRate);
  const source = offline.createBufferSource();
  const buffer = offline.createBuffer(1, samples.length, sampleRate);
  buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

export function parseWavBitDepth(arrayBuffer: ArrayBuffer): number | null {
  const view = new DataView(arrayBuffer);
  if (view.byteLength < 44 || String.fromCharCode(...new Uint8Array(arrayBuffer, 0, 4)) !== "RIFF") return null;
  let offset = 12;
  while (offset + 8 <= view.byteLength) {
    const id = String.fromCharCode(...new Uint8Array(arrayBuffer, offset, 4));
    const size = view.getUint32(offset + 4, true);
    if (id === "fmt " && offset + 24 <= view.byteLength) return view.getUint16(offset + 22, true);
    offset += 8 + size + (size % 2);
  }
  return null;
}

export function describeBitDepth(fileName: string, arrayBuffer: ArrayBuffer): string {
  const extension = fileName.split(".").pop()?.toLowerCase() || "";
  if (extension === "wav") {
    const bits = parseWavBitDepth(arrayBuffer);
    return bits ? `${bits}-bit` : "PCM";
  }
  if (["mp3", "m4a", "aac", "ogg", "flac"].includes(extension)) return "Compressed";
  return "Decoded";
}
