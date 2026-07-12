"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/i18n/locales/en";
import { downloadBlob } from "@/lib/audio/mp3-encoder";
import { formatBytes } from "@/lib/files/image";
import { FileDrop } from "./FileDrop";
import {
  VIDEO_IOS_WARN_BYTES,
  VIDEO_MAX_BYTES,
  VideoDurationError,
  VideoTooLargeError,
  compressToTargetSize,
  compressedName,
  isIos,
  loadFFmpeg,
  probeDuration,
  resetFFmpeg,
} from "@/lib/files/video";

type Status = { title: string; message: string; tone: "neutral" | "success" | "warning" };

export function VideoTool({
  titleKey,
  subtitleKey,
  noteKey,
  targetPresetsMB,
  defaultTargetMB,
}: {
  titleKey: DictKey;
  subtitleKey: DictKey;
  noteKey?: DictKey;
  targetPresetsMB: number[];
  defaultTargetMB: number;
}) {
  const { t } = useI18n();
  const [targetMB, setTargetMB] = useState(defaultTargetMB);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [result, setResult] = useState<{ name: string; blob: Blob; beforeBytes: number } | null>(null);

  // Pre-warm the 31MB engine after the first user gesture — same discipline
  // as the analyzer's WASM warm-up (never on load, skipped on data-saver).
  const warmedRef = useRef(false);
  useEffect(() => {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    if (nav.connection?.saveData) return;
    const kick = () => {
      if (warmedRef.current) return;
      warmedRef.current = true;
      void loadFFmpeg().catch(() => {
        warmedRef.current = false;
      });
    };
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, kick, { once: true, passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, kick));
  }, []);

  const process = async (files: File[]) => {
    const file = files.find((f) => f.type.startsWith("video/") || /\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(f.name));
    if (!file) return;
    if (file.size > VIDEO_MAX_BYTES) {
      setStatus({ title: t("files.tooLarge"), message: formatBytes(VIDEO_MAX_BYTES), tone: "warning" });
      return;
    }
    if (isIos() && file.size > VIDEO_IOS_WARN_BYTES) {
      setStatus({ title: t("vidtool.iosWarning"), message: file.name, tone: "warning" });
    }

    setWorking(true);
    setResult(null);
    setProgress(null);
    setStatus({ title: t("vidtool.loadingEngine"), message: file.name, tone: "neutral" });

    try {
      const duration = await probeDuration(file);
      await loadFFmpeg();
      setStatus({ title: t("vidtool.encoding"), message: file.name, tone: "neutral" });
      const blob = await compressToTargetSize(file, targetMB, duration, ({ ratio }) => {
        setProgress(ratio);
      });
      const name = compressedName(file.name, targetMB);
      setResult({ name, blob, beforeBytes: file.size });
      setStatus({
        title: t("files.done"),
        message: `${formatBytes(file.size)} → ${formatBytes(blob.size)}`,
        tone: "success",
      });
      downloadBlob(blob, name);
    } catch (error) {
      if (error instanceof VideoDurationError) {
        setStatus({ title: t("vidtool.durationFail"), message: file.name, tone: "warning" });
      } else if (error instanceof VideoTooLargeError) {
        setStatus({ title: t("files.tooLarge"), message: file.name, tone: "warning" });
      } else {
        // OOM or engine crash: the worker is unusable — reset so retry works.
        resetFFmpeg();
        setStatus({ title: t("vidtool.memoryFail"), message: file.name, tone: "warning" });
      }
    } finally {
      setWorking(false);
      setProgress(null);
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
        <fieldset className="quality-field">
          <legend>{t("vidtool.target")}</legend>
          <div className="quality-options">
            {targetPresetsMB.map((mb) => (
              <button
                key={mb}
                className={`quality-button${targetMB === mb ? " active" : ""}`}
                type="button"
                disabled={working}
                onClick={() => setTargetMB(mb)}
              >
                <strong>{mb}</strong>
                <span>MB</span>
              </button>
            ))}
          </div>
        </fieldset>

        {noteKey ? <p className="vidtool-note">{t(noteKey)}</p> : null}

        <FileDrop
          accept="video/*,.mp4,.mov,.webm,.mkv,.avi,.m4v"
          disabled={working}
          onFiles={process}
          hint={t("vidtool.dropVideo", { size: formatBytes(VIDEO_MAX_BYTES) })}
        />

        {working && progress !== null ? (
          <div className="vidtool-progress">
            <div className="stat-meter" aria-hidden="true">
              <span style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <span className="vidtool-progress-label">{Math.round(progress * 100)}%</span>
          </div>
        ) : null}

        {result ? (
          <p className="imgtool-single-result">
            {result.name}: {formatBytes(result.beforeBytes)} → {formatBytes(result.blob.size)}{" "}
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

      {/* ffmpeg.wasm core attribution: GPL build, unmodified, from
          https://github.com/ffmpegwasm/ffmpeg.wasm */}
      <p className="vidtool-attribution">
        Powered by <a href="https://github.com/ffmpegwasm/ffmpeg.wasm" rel="noopener noreferrer" target="_blank">ffmpeg.wasm</a>
      </p>
    </article>
  );
}
