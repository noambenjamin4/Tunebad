// Shared peak-reduction helper for waveform previews. Used by both the file
// analyzer (hooks/useAnalyzer.ts) and the Slowed + Reverb studio
// (components/remix/RemixStudio.tsx) so their waveforms are computed
// identically.
export function computeWaveformBars(buffer: AudioBuffer, barCount = 240): number[] {
  const data = buffer.getChannelData(0);
  const step = Math.max(1, Math.floor(data.length / barCount));
  const heights: number[] = [];
  for (let index = 0; index < barCount; index += 1) {
    let peak = 0;
    for (let j = 0; j < step; j += 1) {
      peak = Math.max(peak, Math.abs(data[index * step + j] || 0));
    }
    heights.push(Math.max(8, Math.round(peak * 56)));
  }
  return heights;
}
