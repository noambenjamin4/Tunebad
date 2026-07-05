import type { AnalysisResult } from "@/types/analysis";
import { formatTime } from "./format";

export function exportResultsCsv(results: AnalysisResult[]): void {
  const header = ["File Name", "Duration", "BPM", "Alt BPM", "Key", "Camelot", "Confidence", "Energy", "Danceability", "Loudness", "Engine", "Analyzed"];
  const rows = results.map((item) => [
    item.name,
    formatTime(item.duration),
    item.bpm ? String(Math.round(item.bpm)) : "N/A",
    item.bpmAlternate === null ? "N/A" : String(Math.round(item.bpmAlternate)),
    item.key,
    item.camelot || item.scale,
    `${item.confidence}%`,
    item.energy === null ? "N/A" : `${Math.round(item.energy)}`,
    item.danceability === null ? "N/A" : `${Math.round(item.danceability)}`,
    item.loudness === null ? "N/A" : `${item.loudness.toFixed(1)} dB`,
    item.engine,
    item.analyzedAt,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "tunebad-analysis-results.csv";
  link.click();
  URL.revokeObjectURL(url);
}
