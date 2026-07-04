// Simple in-memory sliding-window rate limiter (per-IP). Fine for a
// local single-user tool; stored on globalThis to survive dev HMR.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_STARTS = 10;

const globalStore = globalThis as unknown as { __tunerRateLimit?: Map<string, number[]> };
const store = (globalStore.__tunerRateLimit ??= new Map<string, number[]>());

export function allowJobStart(key: string): boolean {
  const now = Date.now();
  const recent = (store.get(key) || []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_STARTS) {
    store.set(key, recent);
    return false;
  }
  recent.push(now);
  store.set(key, recent);
  return true;
}
