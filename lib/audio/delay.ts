import { clampBpm } from "../format";

export interface DelayValue {
  ms: number;
  hz: number;
}

export interface DelayDivision {
  label: string;
  normal: DelayValue;
  dotted: DelayValue;
  triplet: DelayValue;
  highlight: boolean;
}

export interface ReverbPreset {
  name: string;
  noteLabel: string;
  preDelayMs: number;
  decayMs: number;
}

export interface DelayResult {
  divisions: DelayDivision[];
  reverbPresets: ReverbPreset[];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toDelayValue(ms: number): DelayValue {
  return { ms: round2(ms), hz: round2(1000 / ms) };
}

const DIVISION_DEFS: { label: string; beats: number }[] = [
  { label: "1/1", beats: 4 },
  { label: "1/2", beats: 2 },
  { label: "1/4", beats: 1 },
  { label: "1/8", beats: 0.5 },
  { label: "1/16", beats: 0.25 },
  { label: "1/32", beats: 0.125 },
  { label: "1/64", beats: 0.0625 },
];

const REVERB_PRESET_DEFS: { name: string; noteLabel: string; totalBeats: number; preDelayDivisor: number }[] = [
  { name: "Hall", noteLabel: "1/1", totalBeats: 8, preDelayDivisor: 64 },
  { name: "Large Room", noteLabel: "1/2", totalBeats: 4, preDelayDivisor: 64 },
  { name: "Small Room", noteLabel: "1/4", totalBeats: 2, preDelayDivisor: 64 },
  { name: "Tight Ambience", noteLabel: "1/8", totalBeats: 1, preDelayDivisor: 128 },
];

export function delayDivisions(bpmValue: number | string): DelayResult {
  const bpm = clampBpm(bpmValue);
  const msPerBeat = 60000 / bpm;

  const divisions: DelayDivision[] = DIVISION_DEFS.map(({ label, beats }) => {
    const normalMs = msPerBeat * beats;
    const dottedMs = normalMs * 1.5;
    const tripletMs = normalMs * (2 / 3);
    return {
      label,
      normal: toDelayValue(normalMs),
      dotted: toDelayValue(dottedMs),
      triplet: toDelayValue(tripletMs),
      highlight: label === "1/4",
    };
  });

  const reverbPresets: ReverbPreset[] = REVERB_PRESET_DEFS.map(({ name, noteLabel, totalBeats, preDelayDivisor }) => {
    const totalMs = msPerBeat * totalBeats;
    const preDelayMs = totalMs / preDelayDivisor;
    const decayMs = totalMs - preDelayMs;
    return {
      name,
      noteLabel,
      preDelayMs: round2(preDelayMs),
      decayMs: round2(decayMs),
    };
  });

  return { divisions, reverbPresets };
}
