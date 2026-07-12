export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${secs}`;
}

// m:ss.d readout with tenth-second precision — the MP3 cutter's trim times
// and steppers need finer granularity than formatTime's whole seconds.
// Rounds to tenths FIRST so 59.97s becomes 1:00.0 rather than 0:60.0.
export function formatTimeTenths(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00.0";
  const tenths = Math.round(seconds * 10);
  const minutes = Math.floor(tenths / 600);
  const rest = tenths % 600;
  return `${minutes}:${String(Math.floor(rest / 10)).padStart(2, "0")}.${rest % 10}`;
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
