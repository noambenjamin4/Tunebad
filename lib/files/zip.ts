// Client-side ZIP engine for the file tools: create archives and extract
// them, powered by fflate. Files never leave the visitor's device.

// fflate is only needed once the visitor actually runs the ZIP tool, so it's
// loaded dynamically (and cached) on first use instead of being part of the
// main bundle. Same pattern as loadSoundTouch in lib/audio/remix.ts.
type FflateModule = typeof import("fflate");

let fflatePromise: Promise<FflateModule> | null = null;

function loadFflate(): Promise<FflateModule> {
  if (!fflatePromise) fflatePromise = import("fflate");
  return fflatePromise;
}

export const ZIP_MAX_BYTES = 500 * 1024 * 1024;
export const ZIP_MAX_EXPANDED_BYTES = 2 * 1024 * 1024 * 1024;

/** The archive's entries would expand past ZIP_MAX_EXPANDED_BYTES (zip bomb guard). */
export class ZipTooLargeError extends Error {}
/** The file could not be parsed as a ZIP archive. */
export class ZipInvalidError extends Error {}

export type ZipEntry = { name: string; data: Uint8Array };

/**
 * Neutralize path tricks in entry names before they're displayed or used as
 * download names: backslashes become slashes, and leading slashes, drive
 * letters, "." and ".." segments are dropped.
 */
export function sanitizeEntryName(name: string): string {
  return name
    .replace(/\\/g, "/")
    .replace(/^[a-zA-Z]:/, "")
    .split("/")
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/");
}

/**
 * Extract a ZIP archive fully in memory. Runs two passes: the first walks the
 * entry table WITHOUT inflating anything (filter returns false) to sum the
 * declared uncompressed sizes, so a zip bomb is rejected before a single byte
 * is decompressed; the second actually inflates.
 */
export async function extractZip(file: File): Promise<ZipEntry[]> {
  const fflate = await loadFflate();
  const buf = new Uint8Array(await file.arrayBuffer());

  let expandedTotal = 0;
  await new Promise<void>((resolve, reject) => {
    fflate.unzip(
      buf,
      {
        filter: (info) => {
          expandedTotal += info.originalSize ?? 0;
          return false;
        },
      },
      (err) => (err ? reject(new ZipInvalidError()) : resolve()),
    );
  });
  if (expandedTotal > ZIP_MAX_EXPANDED_BYTES) throw new ZipTooLargeError();

  const unzipped = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    fflate.unzip(buf, (err, data) => (err ? reject(new ZipInvalidError()) : resolve(data)));
  });

  return Object.entries(unzipped)
    .filter(([name]) => !name.endsWith("/"))
    .map(([name, data]) => ({ name: sanitizeEntryName(name), data }))
    .filter((entry) => entry.name.length > 0);
}

/** Bundle the given files into a ZIP archive (duplicate names get " (n)"). */
export async function createZip(files: File[]): Promise<Blob> {
  const fflate = await loadFflate();

  const entries: Record<string, Uint8Array> = {};
  for (const file of files) {
    const data = new Uint8Array(await file.arrayBuffer());
    let name = sanitizeEntryName(file.name) || "file";
    if (name in entries) {
      const dot = name.lastIndexOf(".");
      const stem = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : "";
      let n = 2;
      while (`${stem} (${n})${ext}` in entries) n += 1;
      name = `${stem} (${n})${ext}`;
    }
    entries[name] = data;
  }

  const zipped = await new Promise<Uint8Array>((resolve, reject) => {
    fflate.zip(entries, { level: 6 }, (err, data) => (err ? reject(new ZipInvalidError()) : resolve(data)));
  });
  return new Blob([zipped as BlobPart], { type: "application/zip" });
}
