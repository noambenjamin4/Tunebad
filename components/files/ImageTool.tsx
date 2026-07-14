"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/i18n/locales/en";
import { downloadBlob } from "@/lib/files/download";
import { CheckRow } from "@/components/ui/CheckRow";
import { FileDrop } from "./FileDrop";
import {
  IMAGE_MAX_BYTES,
  IMAGE_MAX_FILES,
  ImageTooLargeError,
  canEncodeWebp,
  compressToTarget,
  decodeImage,
  drawResized,
  encodeCanvas,
  formatBytes,
  releaseSource,
  replaceExtension,
  sourceSize,
  type ImageOutputFormat,
} from "@/lib/files/image";

export type ImageToolMode = "convert" | "resize" | "compress";
export type SizePreset = { labelKey: DictKey; width: number; height: number };

type Status = { title: string; message: string; tone: "neutral" | "success" | "warning" };
type ResultRow = { name: string; blob: Blob; beforeBytes: number; note: string };

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/bmp,.png,.jpg,.jpeg,.webp,.gif,.bmp";

// The visual language of FormatPicker (quality-button pills) with image types.
function ImageFormatPicker({
  value,
  onChange,
  disabled,
}: {
  value: ImageOutputFormat;
  onChange: (format: ImageOutputFormat) => void;
  disabled: boolean;
}) {
  const { t } = useI18n();
  const options = useMemo(() => {
    const base: { value: ImageOutputFormat; label: string }[] = [
      { value: "jpeg", label: "JPG" },
      { value: "png", label: "PNG" },
    ];
    if (canEncodeWebp()) base.push({ value: "webp", label: "WebP" });
    return base;
  }, []);

  return (
    <fieldset className="quality-field">
      <legend>{t("imgtool.formatOut")}</legend>
      <div className="quality-options format-options">
        {options.map((option) => (
          <button
            key={option.value}
            className={`quality-button${value === option.value ? " active" : ""}`}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            <strong>{option.label}</strong>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function ImageTool({
  mode,
  titleKey,
  subtitleKey,
  sizePresets,
  targetKbOptions,
  defaultTargetKb,
}: {
  mode: ImageToolMode;
  titleKey: DictKey;
  subtitleKey: DictKey;
  sizePresets?: SizePreset[];
  targetKbOptions?: number[];
  defaultTargetKb?: number;
}) {
  const { t } = useI18n();
  const [format, setFormat] = useState<ImageOutputFormat>("jpeg");
  const [quality, setQuality] = useState(0.85);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [lockAspect, setLockAspect] = useState(true);
  const [presetIndex, setPresetIndex] = useState(0);
  const [targetKb, setTargetKb] = useState(defaultTargetKb ?? 100);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);

  const busy = working;

  const process = async (files: File[]) => {
    const images = files.slice(0, IMAGE_MAX_FILES);
    if (!images.length) return;
    setWorking(true);
    setResults([]);
    setStatus({ title: t("files.processing"), message: images[0].name, tone: "neutral" });

    const out: ResultRow[] = [];
    let failed = 0;

    for (const file of images) {
      if (/\.heic$|\.heif$/i.test(file.name)) {
        failed += 1;
        setStatus({ title: t("imgtool.heicUnsupported"), message: file.name, tone: "warning" });
        continue;
      }
      let source: Awaited<ReturnType<typeof decodeImage>> | null = null;
      try {
        source = await decodeImage(file);
        const original = sourceSize(source);

        if (mode === "compress") {
          const encFormat = format === "png" ? "jpeg" : (format as "jpeg" | "webp");
          if (targetKbOptions) {
            const result = await compressToTarget(source, targetKb * 1024, encFormat);
            out.push({
              name: replaceExtension(file.name, encFormat),
              blob: result.blob,
              beforeBytes: file.size,
              note: `${result.width}×${result.height}`,
            });
          } else {
            const canvas = drawResized(source, original.width, original.height, "cover", encFormat);
            const blob = await encodeCanvas(canvas, encFormat, quality);
            out.push({
              name: replaceExtension(file.name, encFormat),
              blob,
              beforeBytes: file.size,
              note: `${original.width}×${original.height}`,
            });
          }
        } else if (mode === "resize") {
          let targetW: number;
          let targetH: number;
          let fit: "cover" | "contain";
          if (sizePresets) {
            targetW = sizePresets[presetIndex].width;
            targetH = sizePresets[presetIndex].height;
            fit = "cover";
          } else {
            const w = Number.parseInt(width, 10);
            const h = Number.parseInt(height, 10);
            if (!w && !h) throw new ImageDimensionError();
            if (lockAspect || !w || !h) {
              const scale = w ? w / original.width : h / original.height;
              targetW = Math.max(1, Math.round(w || original.width * scale));
              targetH = Math.max(1, Math.round(h || original.height * scale));
              fit = "contain";
              // contain against exact box keeps aspect without cropping
              targetW = w || Math.round(original.width * (targetH / original.height));
              targetH = h || Math.round(original.height * (targetW / original.width));
            } else {
              targetW = w;
              targetH = h;
              fit = "cover";
            }
          }
          const canvas = drawResized(source, targetW, targetH, fit, format);
          const blob = await encodeCanvas(canvas, format, format === "png" ? undefined : quality);
          out.push({
            name: replaceExtension(file.name, format),
            blob,
            beforeBytes: file.size,
            note: `${canvas.width}×${canvas.height}`,
          });
        } else {
          const canvas = drawResized(source, original.width, original.height, "cover", format);
          const blob = await encodeCanvas(canvas, format, format === "png" ? undefined : quality);
          out.push({
            name: replaceExtension(file.name, format),
            blob,
            beforeBytes: file.size,
            note: `${original.width}×${original.height}`,
          });
        }
      } catch (error) {
        failed += 1;
        const key: DictKey =
          error instanceof ImageTooLargeError ? "files.tooLarge" : "files.failed";
        setStatus({ title: t(key), message: file.name, tone: "warning" });
      } finally {
        if (source) releaseSource(source);
      }
    }

    setResults(out);
    setWorking(false);
    if (out.length) {
      setStatus({
        title: t("files.done"),
        message: failed ? t("files.someFailed", { count: failed }) : `${out.length}`,
        tone: failed ? "warning" : "success",
      });
      // Single file: download immediately — the common case should be one click.
      if (out.length === 1) downloadBlob(out[0].blob, out[0].name);
    } else if (!failed) {
      setStatus(null);
    }
  };

  return (
    <article className="panel hero-tool">
      <div className="panel-heading hero-heading">
        <div>
          <h1>{t(titleKey)}</h1>
          <p>{t(subtitleKey)}</p>
        </div>
      </div>

      <article className="utility-card">
        {mode !== "compress" || !targetKbOptions ? (
          <ImageFormatPicker value={format} onChange={setFormat} disabled={busy} />
        ) : null}

        {mode === "compress" && targetKbOptions ? (
          <fieldset className="quality-field">
            <legend>{t("imgtool.targetSize")}</legend>
            <div className="quality-options">
              {targetKbOptions.map((kb) => (
                <button
                  key={kb}
                  className={`quality-button${targetKb === kb ? " active" : ""}`}
                  type="button"
                  disabled={busy}
                  onClick={() => setTargetKb(kb)}
                >
                  <strong>{kb}</strong>
                  <span>KB</span>
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}

        {mode === "compress" && !targetKbOptions ? (
          <label className="field-label imgtool-quality">
            {t("imgtool.quality")} ({Math.round(quality * 100)}%)
            <input
              type="range"
              min={30}
              max={95}
              value={Math.round(quality * 100)}
              disabled={busy}
              onChange={(event) => setQuality(Number(event.target.value) / 100)}
            />
          </label>
        ) : null}

        {mode === "resize" && sizePresets ? (
          <fieldset className="quality-field">
            <legend>{t("imgtool.presetLegend")}</legend>
            <div className="quality-options">
              {sizePresets.map((preset, index) => (
                <button
                  key={preset.labelKey}
                  className={`quality-button${presetIndex === index ? " active" : ""}`}
                  type="button"
                  disabled={busy}
                  onClick={() => setPresetIndex(index)}
                >
                  <strong>{t(preset.labelKey)}</strong>
                  <span>
                    {preset.width}×{preset.height}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}

        {mode === "resize" && !sizePresets ? (
          <div className="imgtool-dimensions">
            <label className="field-label">
              {t("imgtool.width")}
              <input
                className="imgtool-number"
                type="number"
                min={1}
                max={20000}
                value={width}
                placeholder="1920"
                disabled={busy}
                onChange={(event) => setWidth(event.target.value)}
              />
            </label>
            <label className="field-label">
              {t("imgtool.height")}
              <input
                className="imgtool-number"
                type="number"
                min={1}
                max={20000}
                value={height}
                placeholder="1080"
                disabled={busy}
                onChange={(event) => setHeight(event.target.value)}
              />
            </label>
            <CheckRow checked={lockAspect} onChange={setLockAspect} disabled={busy}>
              {t("imgtool.lockAspect")}
            </CheckRow>
          </div>
        ) : null}

        <FileDropSection busy={busy} onFiles={process} />

        {results.length > 1 ? (
          <ul className="imgtool-results">
            {results.map((row) => (
              <li key={row.name}>
                <span className="imgtool-result-name">{row.name}</span>
                <span className="imgtool-result-meta">
                  {formatBytes(row.beforeBytes)} → {formatBytes(row.blob.size)} · {row.note}
                </span>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => downloadBlob(row.blob, row.name)}
                >
                  {t("files.download")}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {results.length === 1 ? (
          <p className="imgtool-single-result">
            {results[0].name}: {formatBytes(results[0].beforeBytes)} → {formatBytes(results[0].blob.size)} ·{" "}
            {results[0].note}{" "}
            <button
              className="secondary-button"
              type="button"
              onClick={() => downloadBlob(results[0].blob, results[0].name)}
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

class ImageDimensionError extends Error {}

function FileDropSection({ busy, onFiles }: { busy: boolean; onFiles: (files: File[]) => void }) {
  const { t } = useI18n();
  return (
    <FileDrop
      accept={ACCEPT}
      multiple
      disabled={busy}
      onFiles={onFiles}
      hint={t("files.dropImages", { max: IMAGE_MAX_FILES, size: formatBytes(IMAGE_MAX_BYTES) })}
    />
  );
}
