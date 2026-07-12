// Client-side TAR / TAR.GZ engine for the Extract Archives tool. TAR parsing
// and writing are hand-rolled (the format is just 512-byte header blocks with
// 512-padded data); gzip compression/decompression comes from fflate, which
// the ZIP path already ships. Files never leave the visitor's device.
//
// Extraction handles: regular files ('0' / NUL typeflag), directories ('5',
// skipped but their paths survive inside entry names), and ustar prefix-field
// long names. Symlinks/hardlinks ('2'/'1') are skipped without consuming data
// blocks. PAX extended headers ('x'/'g') and GNU long-name entries ('L'/'K')
// have their data blocks skipped safely; a PAX/GNU override that precedes a
// file is ignored, so that file keeps its (possibly truncated) header name.
import {
  ZIP_MAX_EXPANDED_BYTES,
  ZipInvalidError,
  ZipTooLargeError,
  loadFflate,
  sanitizeEntryName,
  type ZipEntry,
} from "./zip";

const BLOCK = 512;

/** True when the buffer starts with the gzip magic bytes 1f 8b. */
export function isGzip(bytes: Uint8Array): boolean {
  return bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

/** True when the filename looks like a TAR family archive. */
export function isTarFileName(name: string): boolean {
  return /\.(tar|tgz|tar\.gz)$/i.test(name);
}

// Streaming gunzip with a running-total cap, so a tiny gzip that inflates to
// hundreds of gigabytes (gzip bomb) is rejected long before memory runs out.
async function gunzipCapped(bytes: Uint8Array, cap: number): Promise<Uint8Array> {
  const fflate = await loadFflate();
  const chunks: Uint8Array[] = [];
  let total = 0;

  // Throwing inside ondata propagates out of the synchronous push() call, so
  // decompression stops the moment the cap is crossed.
  const stream = new fflate.Gunzip((chunk) => {
    total += chunk.length;
    if (total > cap) throw new ZipTooLargeError();
    chunks.push(chunk);
  });
  try {
    stream.push(bytes, true);
  } catch (error) {
    if (error instanceof ZipTooLargeError) throw error;
    throw new ZipInvalidError();
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

// Numeric header fields are octal ASCII (NUL/space terminated); GNU tar
// switches to base-256 (high bit set on the first byte) for values that do
// not fit, so both encodings are handled.
function parseNumeric(buf: Uint8Array, offset: number, length: number): number {
  if (buf[offset] & 0x80) {
    let value = buf[offset] & 0x7f;
    for (let i = 1; i < length; i += 1) value = value * 256 + buf[offset + i];
    return value;
  }
  let text = "";
  for (let i = offset; i < offset + length; i += 1) {
    const byte = buf[i];
    if (byte === 0) break;
    text += String.fromCharCode(byte);
  }
  const parsed = parseInt(text.trim(), 8);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function decodeString(buf: Uint8Array, offset: number, length: number): string {
  let end = offset;
  while (end < offset + length && buf[end] !== 0) end += 1;
  return new TextDecoder().decode(buf.subarray(offset, end));
}

function isZeroBlock(buf: Uint8Array, offset: number): boolean {
  for (let i = offset; i < offset + BLOCK; i += 1) if (buf[i] !== 0) return false;
  return true;
}

// Header checksum: sum of all 512 header bytes with the checksum field
// (offset 148, length 8) treated as spaces. Used both to validate parsed
// headers (catching non-TAR input early) and to write created ones.
function computeChecksum(header: Uint8Array, offset: number): number {
  let sum = 0;
  for (let i = 0; i < BLOCK; i += 1) {
    sum += i >= 148 && i < 156 ? 0x20 : header[offset + i];
  }
  return sum;
}

interface TarHeader {
  name: string;
  size: number;
  typeflag: number;
  dataStart: number;
  /** Bytes to advance past this entry (header + padded data). */
  span: number;
}

// Walk every header in the archive, yielding parsed headers. Throws
// ZipInvalidError when the first block is not a valid TAR header.
function* walkTar(buf: Uint8Array): Generator<TarHeader> {
  let offset = 0;
  let sawValidHeader = false;

  while (offset + BLOCK <= buf.length) {
    if (isZeroBlock(buf, offset)) break; // end-of-archive marker

    const stored = parseNumeric(buf, offset + 148, 8);
    if (stored !== computeChecksum(buf, offset)) throw new ZipInvalidError();
    sawValidHeader = true;

    const typeflag = buf[offset + 156];
    const size = parseNumeric(buf, offset + 124, 12);
    let name = decodeString(buf, offset, 100);

    // ustar long names: prefix field at 345 (155 bytes) prepends to name.
    const magic = decodeString(buf, offset + 257, 6);
    if (magic.startsWith("ustar")) {
      const prefix = decodeString(buf, offset + 345, 155);
      if (prefix) name = `${prefix}/${name}`;
    }

    // Link entries ('1' hardlink, '2' symlink) carry no data blocks even if
    // the size field is non-zero (it describes the link target, not stored
    // bytes), so they only span their header.
    const dataSize = typeflag === 0x31 || typeflag === 0x32 ? 0 : size;
    const span = BLOCK + Math.ceil(dataSize / BLOCK) * BLOCK;
    // Truncated archive: the declared data runs past the end of the buffer.
    if (offset + BLOCK + dataSize > buf.length) throw new ZipInvalidError();

    yield { name, size: dataSize, typeflag, dataStart: offset + BLOCK, span };
    offset += span;
  }

  if (!sawValidHeader) throw new ZipInvalidError();
}

function isRegularFile(typeflag: number): boolean {
  return typeflag === 0 || typeflag === 0x30; // NUL or '0'
}

/**
 * Extract a .tar / .tar.gz / .tgz archive fully in memory. Mirrors
 * extractZip's two-pass shape: the first pass only reads headers to sum the
 * declared file sizes (bomb guard), the second slices the data out.
 */
export async function extractTarArchive(file: File): Promise<ZipEntry[]> {
  const raw = new Uint8Array(await file.arrayBuffer());
  const buf = isGzip(raw) ? await gunzipCapped(raw, ZIP_MAX_EXPANDED_BYTES) : raw;

  let declaredTotal = 0;
  for (const header of walkTar(buf)) {
    if (isRegularFile(header.typeflag)) declaredTotal += header.size;
  }
  if (declaredTotal > ZIP_MAX_EXPANDED_BYTES) throw new ZipTooLargeError();

  const entries: ZipEntry[] = [];
  for (const header of walkTar(buf)) {
    if (!isRegularFile(header.typeflag)) continue;
    const name = sanitizeEntryName(header.name);
    if (!name) continue;
    entries.push({ name, data: buf.slice(header.dataStart, header.dataStart + header.size) });
  }
  return entries;
}

function writeAscii(header: Uint8Array, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) header[offset + i] = text.charCodeAt(i);
}

// Octal field: (length - 1) zero-padded digits + NUL terminator.
function writeOctal(header: Uint8Array, offset: number, length: number, value: number): void {
  writeAscii(header, offset, Math.max(0, value).toString(8).padStart(length - 1, "0"));
}

function buildHeader(nameBytes: Uint8Array, size: number, mtimeSeconds: number): Uint8Array {
  const header = new Uint8Array(BLOCK);
  header.set(nameBytes.subarray(0, 100), 0);
  writeOctal(header, 100, 8, 0o644); // mode
  writeOctal(header, 108, 8, 0); // uid
  writeOctal(header, 116, 8, 0); // gid
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, Math.max(0, mtimeSeconds));
  header[156] = 0x30; // typeflag '0': regular file
  writeAscii(header, 257, "ustar"); // magic (NUL-terminated by the zero fill)
  writeAscii(header, 263, "00"); // version

  // Checksum: computed with the field as spaces, stored as 6 octal digits,
  // NUL, space.
  const sum = computeChecksum(header, 0);
  writeAscii(header, 148, sum.toString(8).padStart(6, "0"));
  header[154] = 0;
  header[155] = 0x20;
  return header;
}

/**
 * Bundle the given files into a gzipped TAR archive (duplicate names get
 * " (n)", matching createZip). Names longer than 100 UTF-8 bytes are
 * truncated to fit the classic header name field.
 */
export async function createTarGz(files: File[]): Promise<Blob> {
  const fflate = await loadFflate();
  const encoder = new TextEncoder();

  const used = new Set<string>();
  const chunks: Uint8Array[] = [];
  for (const file of files) {
    let name = sanitizeEntryName(file.name) || "file";
    if (used.has(name)) {
      const dot = name.lastIndexOf(".");
      const stem = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : "";
      let n = 2;
      while (used.has(`${stem} (${n})${ext}`)) n += 1;
      name = `${stem} (${n})${ext}`;
    }
    used.add(name);

    const data = new Uint8Array(await file.arrayBuffer());
    chunks.push(buildHeader(encoder.encode(name), data.length, Math.floor(file.lastModified / 1000)));
    chunks.push(data);
    const remainder = data.length % BLOCK;
    if (remainder) chunks.push(new Uint8Array(BLOCK - remainder));
  }
  chunks.push(new Uint8Array(BLOCK * 2)); // end-of-archive: two zero blocks

  let total = 0;
  for (const chunk of chunks) total += chunk.length;
  const tar = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    tar.set(chunk, offset);
    offset += chunk.length;
  }

  const gzipped = await new Promise<Uint8Array>((resolve, reject) => {
    fflate.gzip(tar, { level: 6 }, (err, out) => (err ? reject(new ZipInvalidError()) : resolve(out)));
  });
  return new Blob([gzipped as BlobPart], { type: "application/gzip" });
}
