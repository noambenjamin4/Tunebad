// Small web assets generated from the canonical logo PNGs:
//   1. 76px WebP logo pair — the header/footer marks render at 24-38 CSS px,
//      and the full 15 KB PNGs were on the LCP path of every cold visit.
//      76px covers 2x DPR at the largest (38px) use.
//   2. 512px maskable icon — Android adaptive icons crop to a central "safe
//      zone"; without purpose:"maskable" the launcher letterboxes the icon in
//      a white circle. The logo is scaled to 66% and centered on an opaque
//      canvas so the crop never clips it.
// Run: node scripts/gen-web-assets.mjs
import sharp from "sharp";

for (const variant of ["light", "dark"]) {
  await sharp(`public/logo-${variant}.png`)
    .resize(76, 76, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90 })
    .toFile(`public/logo-${variant}-76.webp`);
}

const logo = await sharp("public/logo-light.png")
  .resize(338, 338, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
  .toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
  .composite([{ input: logo, gravity: "centre" }])
  .png({ compressionLevel: 9 })
  .toFile("public/icon-512-maskable.png");

console.log("wrote logo-{light,dark}-76.webp + icon-512-maskable.png");
