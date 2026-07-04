export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${secs}`;
}

export function formatDetailedTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "00:00.000";
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  const ms = Math.round((seconds % 1) * 1000).toString().padStart(3, "0");
  return `${minutes}:${secs}.${ms}`;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes)) return "N/A";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function formatSampleRate(sampleRate: number): string {
  return `${(sampleRate / 1000).toFixed(sampleRate % 1000 === 0 ? 0 : 1)} kHz`;
}

export function clampBpm(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Math.max(30, Math.min(300, Number.isFinite(parsed) ? parsed : 120));
}
