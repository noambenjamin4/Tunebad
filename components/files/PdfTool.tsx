"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { downloadBlob } from "@/lib/files/download";
import { formatBytes } from "@/lib/files/image";
import { FileDrop } from "./FileDrop";
import {
  PDF_MAX_FILE_BYTES,
  PDF_MAX_IMAGE_FILES,
  PDF_MAX_PDF_FILES,
  PDF_MAX_TOTAL_BYTES,
  PdfEncryptedError,
  PdfParseError,
  imagesToPdf,
  mergePdfs,
} from "@/lib/files/pdf";

export type PdfToolMode = "merge" | "images";

type Status = { title: string; message: string; tone: "neutral" | "success" | "warning" };

const PDF_ACCEPT = "application/pdf,.pdf";
const IMAGE_ACCEPT = "image/png,image/jpeg,.png,.jpg,.jpeg";

export function PdfTool({ mode }: { mode: PdfToolMode }) {
  const { t } = useI18n();
  const [files, setFiles] = useState<File[]>([]);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  const maxFiles = mode === "merge" ? PDF_MAX_PDF_FILES : PDF_MAX_IMAGE_FILES;
  // Merging needs at least two documents to mean anything; images need one.
  const canRun = !working && files.length >= (mode === "merge" ? 2 : 1);

  const addFiles = (incoming: File[]) => {
    const next = [...files];
    let totalBytes = next.reduce((sum, file) => sum + file.size, 0);
    let warned: Status | null = null;

    for (const file of incoming) {
      if (next.some((f) => f.name === file.name && f.size === file.size)) continue;
      if (next.length >= maxFiles) {
        warned = { title: t("pdftool.tooMany", { max: maxFiles }), message: file.name, tone: "warning" };
        break;
      }
      if (file.size > PDF_MAX_FILE_BYTES || totalBytes + file.size > PDF_MAX_TOTAL_BYTES) {
        warned = { title: t("files.tooLarge"), message: file.name, tone: "warning" };
        continue;
      }
      next.push(file);
      totalBytes += file.size;
    }

    setFiles(next);
    setResult(null);
    setStatus(warned);
  };

  const move = (index: number, delta: -1 | 1) => {
    setFiles((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const remove = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setResult(null);
  };

  const run = async () => {
    if (!canRun) return;
    setWorking(true);
    setResult(null);
    setStatus({ title: t("files.processing"), message: files[0].name, tone: "neutral" });
    try {
      const blob = mode === "merge" ? await mergePdfs(files) : await imagesToPdf(files);
      const name = mode === "merge" ? "merged.pdf" : "images.pdf";
      downloadBlob(blob, name);
      setResult({ blob, name });
      setStatus({ title: t("files.done"), message: `${name} · ${formatBytes(blob.size)}`, tone: "success" });
    } catch (error) {
      if (error instanceof PdfEncryptedError) {
        setStatus({ title: t("pdftool.encrypted"), message: error.fileName, tone: "warning" });
      } else if (error instanceof PdfParseError) {
        setStatus({ title: t("files.failed"), message: error.fileName, tone: "warning" });
      } else {
        setStatus({ title: t("files.failed"), message: "", tone: "warning" });
      }
    } finally {
      setWorking(false);
    }
  };

  return (
    <article className="panel hero-tool">
      <div className="panel-heading hero-heading">
        <div>
          <h1>{t(mode === "merge" ? "pdftool.titleMerge" : "pdftool.titleImages")}</h1>
          <p>{t(mode === "merge" ? "pdftool.subtitleMerge" : "pdftool.subtitleImages")}</p>
        </div>
      </div>

      <article className="utility-card">
        <FileDrop
          accept={mode === "merge" ? PDF_ACCEPT : IMAGE_ACCEPT}
          multiple
          disabled={working}
          onFiles={addFiles}
          hint={
            mode === "merge"
              ? t("pdftool.dropPdfs", { max: maxFiles, size: formatBytes(PDF_MAX_FILE_BYTES) })
              : t("files.dropImages", { max: maxFiles, size: formatBytes(PDF_MAX_FILE_BYTES) })
          }
        />

        {files.length ? (
          <ul className="imgtool-results">
            {files.map((file, index) => (
              <li key={`${file.name}-${file.size}`}>
                <span className="imgtool-result-name">{file.name}</span>
                <span className="imgtool-result-meta">{formatBytes(file.size)}</span>
                <span className="pdftool-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={working || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    {t("pdftool.moveUp")}
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={working || index === files.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    {t("pdftool.moveDown")}
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={working}
                    onClick={() => remove(index)}
                  >
                    {t("pdftool.remove")}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <button className="convert-button" type="button" disabled={!canRun} onClick={() => void run()}>
          {t(mode === "merge" ? "pdftool.merge" : "pdftool.create")}
        </button>

        {result ? (
          <p className="imgtool-single-result">
            {result.name}: {formatBytes(result.blob.size)}{" "}
            <button
              className="secondary-button"
              type="button"
              onClick={() => downloadBlob(result.blob, result.name)}
            >
              {t("files.downloadAgain")}
            </button>
          </p>
        ) : null}
      </article>

      <div className="status-box" data-tone={(status ?? { tone: "neutral" }).tone} role="status">
        <strong>{status ? status.title : t("files.idle")}</strong>
        <span>{status ? status.message : t("files.localNote")}</span>
      </div>
    </article>
  );
}
