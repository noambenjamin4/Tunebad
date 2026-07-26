// Session persistence for the DAW: an arrangement survives a refresh, a
// crash, and closing the tab.
//
// Split by size, deliberately:
//   ARRANGEMENT (clips, master params, grid, loop) is a few KB of JSON and
//     lives in localStorage — synchronous, trivial to read on mount.
//   AUDIO lives in IndexedDB, which is the only browser store that takes
//     tens of megabytes. The original File objects go in as-is: structured
//     clone handles Blobs, so there is no encode/decode step and no
//     base64 bloat, and restore hands the same File back to the same
//     decoder the drop zone uses.
//
// Beatmatched clips are NOT stored as audio. A stretched buffer is ~40 MB
// and derivable, so the clip records what it was stretched FROM and by how
// much (sourceBufferId + tempoRatio) and the stretch is re-run on restore.
// Cheaper to spend a second of CPU than 40 MB of the user's disk quota.

import type { StudioClip } from "./timeline";

const ARRANGEMENT_KEY = "tunebadStudioSession";
const DB_NAME = "tunebad-studio";
const STORE = "files";
const SCHEMA_VERSION = 1;
/** Past this, stop storing audio rather than fill the user's quota. */
export const MAX_SESSION_BYTES = 300 * 1024 * 1024;

export interface StoredArrangement {
  version: number;
  clips: StudioClip[];
  params: unknown;
  grid: unknown;
  loop: { start: number; end: number } | null;
  gridOn: boolean;
  pxPerSecond: number;
  savedAt: number;
}

/* ----------------------------- IndexedDB ----------------------------- */

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = run(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
      }),
  );
}

/** Keep one source file. Silently a no-op when storage is unavailable. */
export async function saveSessionFile(bufferId: string, file: File): Promise<void> {
  try {
    await tx("readwrite", (store) => store.put(file, bufferId));
  } catch {
    // Private browsing, quota, or no IDB at all — the session simply won't
    // survive. Never break the editor over it.
  }
}

export async function loadSessionFiles(): Promise<Map<string, File>> {
  const out = new Map<string, File>();
  try {
    const db = await openDb();
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const values = await new Promise<unknown[]>((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    keys.forEach((key, i) => {
      const value = values[i];
      if (typeof key === "string" && value instanceof File) out.set(key, value);
    });
  } catch {
    // fall through with whatever was read
  }
  return out;
}

export async function clearSessionFiles(): Promise<void> {
  try {
    await tx("readwrite", (store) => store.clear());
  } catch {
    // nothing to do
  }
}

/* --------------------------- the arrangement --------------------------- */

export function saveArrangement(data: Omit<StoredArrangement, "version" | "savedAt">): void {
  try {
    const payload: StoredArrangement = { ...data, version: SCHEMA_VERSION, savedAt: Date.now() };
    localStorage.setItem(ARRANGEMENT_KEY, JSON.stringify(payload));
  } catch {
    // Quota or disabled storage: the editor keeps working, unsaved.
  }
}

export function loadArrangement(): StoredArrangement | null {
  try {
    const raw = localStorage.getItem(ARRANGEMENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredArrangement;
    // A future schema is not worth guessing at — start clean instead of
    // restoring an arrangement whose fields mean something else now.
    if (parsed.version !== SCHEMA_VERSION) return null;
    if (!Array.isArray(parsed.clips) || parsed.clips.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearArrangement(): void {
  try {
    localStorage.removeItem(ARRANGEMENT_KEY);
  } catch {
    // nothing to do
  }
}

export async function clearSession(): Promise<void> {
  clearArrangement();
  await clearSessionFiles();
}

/** Bytes currently held, so the caller can stop before filling the quota. */
export function sessionBytes(files: Map<string, File>): number {
  let total = 0;
  for (const file of files.values()) total += file.size;
  return total;
}
