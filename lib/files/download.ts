// Dependency-free browser download helper. Lives on its own (not in
// lib/audio/mp3-encoder.ts) so the image/PDF/zip/video tools that only need
// to save a Blob don't pull the wasm MP3 encoder into their bundle.
export function downloadBlob(blob: Blob, fileName: string): void {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
