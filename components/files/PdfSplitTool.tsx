"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { downloadBlob } from "@/lib/audio/mp3-encoder";
import { formatBytes } from "@/lib/files/image";
import { FileDrop } from "./FileDrop";
import {
  PDF_MAX_FILE_BYTES,
  PdfEncryptedError,
  PdfParseError,
  extractPages,
  pdfPageCount,
} from "@/lib/files/pdf";

// Split/extract tool: one PDF in, a from/to page range, one PDF out. Kept
// separate from PdfTool because that component is built around an ordered
// multi-file list (merge/images), while this one is single-file + range.
type Status = { title: string; message: string; tone: "neutral" | "success" | "warning" };

const PDF_ACCEPT = "application/pdf,.pdf";

export function PdfSplitTool() {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("1");
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  const fromNum = Number.parseInt(from, 10);
  const toNum = Number.parseInt(to, 10);
  const rangeValid =
    pageCount !== null &&
    Number.isInteger(fromNum) &&
    Number.isInteger(toNum) &&
    fromNum >= 1 &&
    toNum <= pageCount &&
    fromNum <= toNum;

  const pick = async (files: File[]) => {
    const next = files.find((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    if (!next) return;
    if (next.size > PDF_MAX_FILE_BYTES) {
      setStatus({ title: t("files.tooLarge"), message: formatBytes(PDF_MAX_FILE_BYTES), tone: "warning" });
      return;
    }
    setWorking(true);
    setResult(null);
    setStatus({ title: t("files.processing"), message: next.name, tone: "neutral" });
    try {
      const count = await pdfPageCount(next);
      setFile(next);
      setPageCount(count);
      setFrom("1");
      setTo(String(count));
      setStatus({
        title: t("pdftool.pageCount", { count }),
        message: `${next.name} · ${formatBytes(next.size)}`,
        tone: "neutral",
      });
    } catch (error) {
      setFile(null);
      setPageCount(null);
      if (error instanceof PdfEncryptedError) {
        setStatus({ title: t("pdftool.encrypted"), message: error.fileName, tone: "warning" });
      } else {
        setStatus({ title: t("files.failed"), message: next.name, tone: "warning" });
      }
    } finally {
      setWorking(false);
    }
  };

  const run = async () => {
    if (!file || working) return;
    if (!rangeValid) {
      setStatus({ title: t("pdftool.rangeInvalid"), message: "", tone: "warning" });
      return;
    }
    setWorking(true);
    setResult(null);
    setStatus({ title: t("files.processing"), message: file.name, tone: "neutral" });
    try {
      const blob = await extractPages(file, fromNum, toNum);
      const base = file.name.replace(/\.pdf$/i, "");
      const name = fromNum === toNum ? `${base}-page-${fromNum}.pdf` : `${base}-pages-${fromNum}-${toNum}.pdf`;
      downloadBlob(blob, name);
      setResult({ blob, name });
      setStatus({ title: t("files.done"), message: `${name} · ${formatBytes(blob.size)}`, tone: "success" });
    } catch (error) {
      if (error instanceof PdfEncryptedError) {
        setStatus({ title: t("pdftool.encrypted"), message: error.fileName, tone: "warning" });
      } else if (error instanceof PdfParseError) {
        setStatus({ title: t("files.failed"), message: error.fileName, tone: "warning" });
      } else {
        setStatus({ title: t("pdftool.rangeInvalid"), message: "", tone: "warning" });
      }
    } finally {
      setWorking(false);
    }
  };

  return (
    <article className="panel hero-tool">
      <div className="panel-heading hero-heading">
        <div>
          <h1>{t("pdftool.titleSplit")}</h1>
          <p>{t("pdftool.subtitleSplit")}</p>
        </div>
      </div>

      <article className="utility-card">
        <FileDrop
          accept={PDF_ACCEPT}
          disabled={working}
          onFiles={pick}
          hint={t("pdftool.dropPdf", { size: formatBytes(PDF_MAX_FILE_BYTES) })}
        />

        {file && pageCount !== null ? (
          <>
            <ul className="imgtool-results">
              <li>
                <span className="imgtool-result-name">{file.name}</span>
                <span className="imgtool-result-meta">
                  {formatBytes(file.size)} · {t("pdftool.pageCount", { count: pageCount })}
                </span>
              </li>
            </ul>
            <div className="imgtool-dimensions">
              <label className="field-label">
                {t("pdftool.fromPage")}
                <input
                  className="imgtool-number"
                  type="number"
                  min={1}
                  max={pageCount}
                  value={from}
                  disabled={working}
                  onChange={(event) => setFrom(event.target.value)}
                />
              </label>
              <label className="field-label">
                {t("pdftool.toPage")}
                <input
                  className="imgtool-number"
                  type="number"
                  min={1}
                  max={pageCount}
                  value={to}
                  disabled={working}
                  onChange={(event) => setTo(event.target.value)}
                />
              </label>
            </div>
          </>
        ) : null}

        <button
          className="convert-button"
          type="button"
          disabled={working || !file || !rangeValid}
          onClick={() => void run()}
        >
          {t("pdftool.extract")}
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
