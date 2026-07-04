// Loudness worker: runs the pure-TypeScript BS.1770-4 meter off the main
// thread. The main thread resamples audio to 48000 Hz before posting here
// (this worker has no OfflineAudioContext), so this file just runs the math.
import { integratedLoudness, samplePeakDb } from "@/lib/audio/lufs";

export interface LoudnessWorkerRequest {
  id: number;
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
}

export interface LoudnessWorkerResponse {
  id: number;
  lufs?: number;
  peakDb?: number;
  error?: string;
}

self.onmessage = (event: MessageEvent<LoudnessWorkerRequest>) => {
  const { id, left, right, sampleRate } = event.data;
  try {
    const lufs = integratedLoudness(left, right, sampleRate);
    const peakDb = samplePeakDb([left, right]);
    const response: LoudnessWorkerResponse = { id, lufs, peakDb };
    self.postMessage(response);
  } catch (error) {
    const response: LoudnessWorkerResponse = { id, error: error instanceof Error ? error.message : String(error) };
    self.postMessage(response);
  }
};

export {};
