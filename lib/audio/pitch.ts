import { noteNames } from "./constants";

export function freqToPitch(freq: number): { note: string; cents: string } {
  if (!Number.isFinite(freq) || freq <= 0) return { note: "N/A", cents: "0" };

  const midiFractional = 12 * Math.log2(freq / 440) + 69;
  const midiNumber = Math.round(midiFractional);
  const cents = Math.round((midiFractional - midiNumber) * 100);
  const noteName = noteNames[((midiNumber % 12) + 12) % 12];
  const octave = Math.floor(midiNumber / 12) - 1;

  return {
    note: noteName + octave,
    cents: cents > 0 ? `+${cents}` : `${cents}`,
  };
}
