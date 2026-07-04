export type AnalysisEngine = "essentia" | "basic";

export interface AnalysisResult {
  name: string;
  duration: number;
  sampleRate: number;
  channels: number;
  bitDepthLabel: string;
  fileSize: number;
  bpm: number;
  bpmAlternate: number | null;
  key: string;
  scale: string;
  camelot: string;
  confidence: number;
  energy: number | null;
  danceability: number | null;
  loudness: number | null;
  engine: AnalysisEngine;
  analyzedAt: string;
}

export interface HistoryEntry {
  name: string;
  duration: string;
  bpm: number;
  key: string;
  scale: string;
  confidence: number;
  analyzedAt: string;
  energy?: number | null;
  danceability?: number | null;
  loudness?: number | null;
}

export interface WorkerRequest {
  id: number;
  samples: Float32Array;
  sampleRate: number;
}

export interface WorkerResponse {
  id: number;
  engine: AnalysisEngine;
  bpm: number;
  bpmAlternate: number | null;
  bpmConfidence: number;
  key: string;
  scale: string;
  keyConfidence: number;
  energy: number | null;
  danceability: number | null;
  loudness: number | null;
}

export type YtJobStatus = "starting" | "downloading" | "converting" | "done" | "error";

export type YtFormat = "mp3" | "wav" | "mp4";

export interface YtJobPublic {
  status: YtJobStatus;
  progress: number;
  title: string | null;
  error?: string;
}
