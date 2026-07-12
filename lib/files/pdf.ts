// Client-side PDF engine for the file tools: merge PDFs and turn JPG/PNG
// images into a PDF, all with pdf-lib. Files never leave the visitor's device.

// pdf-lib is a sizeable dependency only needed once the visitor actually runs
// a PDF tool, so it's loaded dynamically (and cached) the first time an
// operation runs, instead of being part of the main bundle. Same pattern as
// loadSoundTouch in lib/audio/remix.ts.
type PdfLibModule = typeof import("pdf-lib");

let pdfLibPromise: Promise<PdfLibModule> | null = null;

function loadPdfLib(): Promise<PdfLibModule> {
  if (!pdfLibPromise) pdfLibPromise = import("pdf-lib");
  return pdfLibPromise;
}

export const PDF_MAX_FILE_BYTES = 100 * 1024 * 1024;
export const PDF_MAX_TOTAL_BYTES = 250 * 1024 * 1024;
export const PDF_MAX_PDF_FILES = 50;
export const PDF_MAX_IMAGE_FILES = 40;

/** A4 width in PDF points; pages wider than this get scaled down to it. */
const A4_WIDTH_PT = 595.28;

/** The input PDF is password-protected (we deliberately do not decrypt). */
export class PdfEncryptedError extends Error {
  constructor(public readonly fileName: string) {
    super(`Encrypted PDF: ${fileName}`);
  }
}

/** The input file could not be parsed as a PDF (or embedded as an image). */
export class PdfParseError extends Error {
  constructor(public readonly fileName: string) {
    super(`Unreadable file: ${fileName}`);
  }
}

// pdf-lib throws EncryptedPDFError when load() meets a password-protected
// file. Match by constructor name AND message so a minified class name still
// gets caught.
function isEncryptedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.constructor.name === "EncryptedPDFError" || /encrypted/i.test(error.message);
}

/** Merge the given PDFs, in array order, into a single document. */
export async function mergePdfs(files: File[]): Promise<Blob> {
  const { PDFDocument } = await loadPdfLib();
  const merged = await PDFDocument.create();

  for (const file of files) {
    const bytes = await file.arrayBuffer();
    let doc;
    try {
      doc = await PDFDocument.load(bytes);
    } catch (error) {
      if (isEncryptedError(error)) throw new PdfEncryptedError(file.name);
      throw new PdfParseError(file.name);
    }
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    for (const page of pages) merged.addPage(page);
  }

  const out = await merged.save();
  return new Blob([out as BlobPart], { type: "application/pdf" });
}

/** Number of pages in the given PDF (rejects encrypted/unreadable files). */
export async function pdfPageCount(file: File): Promise<number> {
  const { PDFDocument } = await loadPdfLib();
  const bytes = await file.arrayBuffer();
  try {
    const doc = await PDFDocument.load(bytes);
    return doc.getPageCount();
  } catch (error) {
    if (isEncryptedError(error)) throw new PdfEncryptedError(file.name);
    throw new PdfParseError(file.name);
  }
}

/**
 * Extract pages `from`..`to` (1-based, inclusive) into a new PDF. The caller
 * validates the range against the page count; out-of-range values throw.
 */
export async function extractPages(file: File, from: number, to: number): Promise<Blob> {
  const { PDFDocument } = await loadPdfLib();
  const bytes = await file.arrayBuffer();
  let doc;
  try {
    doc = await PDFDocument.load(bytes);
  } catch (error) {
    if (isEncryptedError(error)) throw new PdfEncryptedError(file.name);
    throw new PdfParseError(file.name);
  }
  const count = doc.getPageCount();
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > count || from > to) {
    throw new RangeError(`Invalid page range ${from}-${to} for ${count} pages`);
  }
  const out = await PDFDocument.create();
  const indices = Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i);
  const pages = await out.copyPages(doc, indices);
  for (const page of pages) out.addPage(page);
  const saved = await out.save();
  return new Blob([saved as BlobPart], { type: "application/pdf" });
}

function isPng(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

/**
 * Build a PDF with one page per image, sized to the image (1px = 1pt) but
 * capped at A4 width so phone photos don't produce billboard-sized pages.
 */
export async function imagesToPdf(files: File[]): Promise<Blob> {
  const { PDFDocument } = await loadPdfLib();
  const doc = await PDFDocument.create();

  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let image;
    try {
      image = isPng(bytes) ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    } catch {
      throw new PdfParseError(file.name);
    }
    const scale = Math.min(1, A4_WIDTH_PT / image.width);
    const width = image.width * scale;
    const height = image.height * scale;
    const page = doc.addPage([width, height]);
    page.drawImage(image, { x: 0, y: 0, width, height });
  }

  const out = await doc.save();
  return new Blob([out as BlobPart], { type: "application/pdf" });
}
