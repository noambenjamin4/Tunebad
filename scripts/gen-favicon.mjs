// Regenerates app/favicon.ico from public/icon-512.png.
//
// The old file was subtly malformed: its directory entry claimed 32 bpp while
// the embedded PNG was colour type 2 (RGB, no alpha channel). Webpack never
// looked, so it shipped for months. Turbopack decodes icons at build time and
// refuses it outright — "The PNG is not in RGBA format!" — which is how it
// surfaced during the Next 16 migration.
//
// Modern .ico files may embed PNG data directly, so this is a small container
// around three sharp-rendered RGBA PNGs. Run with `node scripts/gen-favicon.mjs`.

import { writeFileSync } from "node:fs";
import sharp from "sharp";

const SOURCE = "public/icon-512.png";
const OUT = "app/favicon.ico";
const SIZES = [16, 32, 48];

const images = await Promise.all(
  SIZES.map((size) =>
    sharp(SOURCE)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      // ensureAlpha is the whole point: it forces colour type 6 (RGBA), which
      // is what the 32 bpp in the directory entry below actually promises.
      .ensureAlpha()
      .png({ compressionLevel: 9 })
      .toBuffer(),
  ),
);

const HEADER = 6;
const ENTRY = 16;
const header = Buffer.alloc(HEADER);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // 1 = icon
header.writeUInt16LE(SIZES.length, 4);

let offset = HEADER + ENTRY * SIZES.length;
const entries = SIZES.map((size, i) => {
  const entry = Buffer.alloc(ENTRY);
  entry[0] = size === 256 ? 0 : size; // 0 means 256 in this format
  entry[1] = size === 256 ? 0 : size;
  entry[2] = 0; // palette colours (0 = truecolour)
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel — now honest, the PNG has alpha
  entry.writeUInt32LE(images[i].length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += images[i].length;
  return entry;
});

writeFileSync(OUT, Buffer.concat([header, ...entries, ...images]));
console.log(`${OUT}: ${SIZES.join("/")} px, ${offset} bytes`);
