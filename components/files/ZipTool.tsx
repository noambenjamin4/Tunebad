"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { downloadBlob } from "@/lib/files/download";
import { formatBytes } from "@/lib/files/image";
import { FileDrop } from "./FileDrop";
import {
  ZIP_MAX_BYTES,
  ZIP_MAX_EXPANDED_BYTES,
  ZipTooLargeError,
  createZip,
  extractZip,
  type ZipEntry,
} from "@/lib/files/zip";
import { createTarGz, extractTarArchive, isTarFileName } from "@/lib/files/tar";

type Status = { title: string; message: string; tone: "neutral" | "success" | "warning" };
type Tab = "extract" | "create";
type ArchiveFormat = "zip" | "targz";

const ARCHIVE_ACCEPT =
  "application/zip,application/x-zip-compressed,application/x-tar,application/gzip,.zip,.tar,.tar.gz,.tgz";

/** An entry's download filename: last path segment of the sanitized name. */
function entryFileName(name: string): string {
  return name.split("/").pop() || name;
}

export function ZipTool() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("extract");
  const [format, setFormat] = useState<ArchiveFormat>("zip");
  const [entries, setEntries] = useState<ZipEntry[]>([]);
  const [createFiles, setCreateFiles] = useState<File[]>([]);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  const switchTab = (next: Tab) => {
    if (working) return;
    setTab(next);
    setStatus(null);
  };

  const extract = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (file.size > ZIP_MAX_BYTES) {
      setStatus({ title: t("files.tooLarge"), message: file.name, tone: "warning" });
      return;
    }
    setWorking(true);
    setEntries([]);
    setStatus({ title: t("files.processing"), message: file.name, tone: "neutral" });
    try {
      const out = isTarFileName(file.name) ? await extractTarArchive(file) : await extractZip(file);
      setEntries(out);
      setStatus({
        title: t("files.done"),
        message: t("ziptool.entries", { count: out.length }),
        tone: "success",
      });
    } catch (error) {
      if (error instanceof ZipTooLargeError) {
        setStatus({
          title: t("ziptool.tooLargeExpanded", { size: formatBytes(ZIP_MAX_EXPANDED_BYTES) }),
          message: file.name,
          tone: "warning",
        });
      } else {
        setStatus({ title: t("ziptool.invalidArchive"), message: file.name, tone: "warning" });
      }
    } finally {
      setWorking(false);
    }
  };

  // Sequential with a small gap so browsers don't swallow the extra downloads.
  const extractAll = async () => {
    setWorking(true);
    for (const entry of entries) {
      downloadBlob(new Blob([entry.data as BlobPart]), entryFileName(entry.name));
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    setWorking(false);
  };

  const addCreateFiles = (incoming: File[]) => {
    const next = [...createFiles];
    let totalBytes = next.reduce((sum, file) => sum + file.size, 0);
    let warned: Status | null = null;
    for (const file of incoming) {
      if (next.some((f) => f.name === file.name && f.size === file.size)) continue;
      if (totalBytes + file.size > ZIP_MAX_BYTES) {
        warned = { title: t("files.tooLarge"), message: file.name, tone: "warning" };
        continue;
      }
      next.push(file);
      totalBytes += file.size;
    }
    setCreateFiles(next);
    setStatus(warned);
  };

  const buildArchive = async () => {
    if (!createFiles.length) return;
    setWorking(true);
    setStatus({ title: t("files.processing"), message: createFiles[0].name, tone: "neutral" });
    try {
      const blob = format === "targz" ? await createTarGz(createFiles) : await createZip(createFiles);
      const fileName = format === "targz" ? "archive.tar.gz" : "archive.zip";
      downloadBlob(blob, fileName);
      setStatus({ title: t("files.done"), message: `${fileName} · ${formatBytes(blob.size)}`, tone: "success" });
    } catch {
      setStatus({ title: t("files.failed"), message: "", tone: "warning" });
    } finally {
      setWorking(false);
    }
  };

  return (
    <article className="panel hero-tool">
      <div className="panel-heading hero-heading">
        <div>
          <h1>{t("ziptool.title")}</h1>
          <p>{t("ziptool.subtitle")}</p>
        </div>
      </div>

      <article className="utility-card">
        <div className="quality-options" role="group" aria-label={t("ziptool.title")}>
          <button
            className={`quality-button${tab === "extract" ? " active" : ""}`}
            type="button"
            aria-pressed={tab === "extract"}
            disabled={working}
            onClick={() => switchTab("extract")}
          >
            <strong>{t("ziptool.extractTab")}</strong>
          </button>
          <button
            className={`quality-button${tab === "create" ? " active" : ""}`}
            type="button"
            aria-pressed={tab === "create"}
            disabled={working}
            onClick={() => switchTab("create")}
          >
            <strong>{t("ziptool.createTab")}</strong>
          </button>
        </div>

        {tab === "extract" ? (
          <>
            <FileDrop
              accept={ARCHIVE_ACCEPT}
              disabled={working}
              onFiles={(files) => void extract(files)}
              hint={t("ziptool.dropZip", { size: formatBytes(ZIP_MAX_BYTES) })}
            />

            {entries.length ? (
              <>
                <ul className="imgtool-results">
                  {entries.map((entry, index) => (
                    <li key={`${entry.name}-${index}`}>
                      <span className="imgtool-result-name">{entry.name}</span>
                      <span className="imgtool-result-meta">{formatBytes(entry.data.length)}</span>
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={working}
                        onClick={() => downloadBlob(new Blob([entry.data as BlobPart]), entryFileName(entry.name))}
                      >
                        {t("files.download")}
                      </button>
                    </li>
                  ))}
                </ul>
                <button className="convert-button" type="button" disabled={working} onClick={() => void extractAll()}>
                  {t("ziptool.extractAll")}
                </button>
              </>
            ) : null}
          </>
        ) : (
          <>
            <FileDrop
              accept="*/*"
              multiple
              disabled={working}
              onFiles={addCreateFiles}
              hint={t("ziptool.dropFiles")}
            />

            <div className="quality-options format-options" role="group" aria-label={t("ziptool.formatLabel")}>
              <button
                className={`quality-button${format === "zip" ? " active" : ""}`}
                type="button"
                aria-pressed={format === "zip"}
                disabled={working}
                onClick={() => setFormat("zip")}
              >
                <strong>ZIP</strong>
              </button>
              <button
                className={`quality-button${format === "targz" ? " active" : ""}`}
                type="button"
                aria-pressed={format === "targz"}
                disabled={working}
                onClick={() => setFormat("targz")}
              >
                <strong>TAR.GZ</strong>
              </button>
            </div>

            {createFiles.length ? (
              <ul className="imgtool-results">
                {createFiles.map((file, index) => (
                  <li key={`${file.name}-${file.size}`}>
                    <span className="imgtool-result-name">{file.name}</span>
                    <span className="imgtool-result-meta">{formatBytes(file.size)}</span>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={working}
                      onClick={() => setCreateFiles((prev) => prev.filter((_, i) => i !== index))}
                    >
                      {t("pdftool.remove")}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <button
              className="convert-button"
              type="button"
              disabled={working || !createFiles.length}
              onClick={() => void buildArchive()}
            >
              {t("ziptool.create", { format: format === "targz" ? "TAR.GZ" : "ZIP" })}
            </button>
          </>
        )}
      </article>

      <div className="status-box" data-tone={(status ?? { tone: "neutral" }).tone} role="status">
        <strong>{status ? status.title : t("files.idle")}</strong>
        <span>{status ? status.message : t("files.localNote")}</span>
      </div>
    </article>
  );
}
