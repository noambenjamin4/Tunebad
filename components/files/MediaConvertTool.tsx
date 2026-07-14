"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { DictKey } from "@/lib/i18n/locales/en";
import { downloadBlob } from "@/lib/audio/mp3-encoder";
import { formatBytes } from "@/lib/files/image";
import { FileDrop } from "./FileDrop";
import { VIDEO_IOS_WARN_BYTES, VIDEO_MAX_BYTES, isIos, loadFFmpeg, resetFFmpeg } from "@/lib/files/video";
import { useUnloadGuard } from "@/hooks/useUnloadGuard";
import {
  CONVERT_AUDIO_MAX_BYTES,
  ConvertError,
  convertMedia,
  convertedName,
  type AudioFormat,
  type MediaFormat,
  type VideoFormat,
} from "@/lib/files/convert-media";

type Status = { title: string; message: string; tone: "neutral" | "success" | "warning" };

// Every format listed here is E2E-verified against the vendored ffmpeg core
// (see lib/files/convert-media.ts) — never add a pill without a passing test.
const VIDEO_FORMATS: VideoFormat[] = ["mp4", "webm", "mkv", "mov", "avi", "flv", "wmv"];
const AUDIO_FORMATS: AudioFormat[] = ["mp3", "wav", "flac", "ogg", "m4a"];
const MP3_BITRATES = [128, 192, 320];

const VIDEO_ACCEPT =
  "video/*,.mp4,.m4v,.mov,.webm,.mkv,.avi,.flv,.wmv,.3gp,.mpg,.mpeg,.ts,.mts,.ogv";
const AUDIO_ACCEPT =
  "audio/*,.mp3,.wav,.flac,.ogg,.oga,.m4a,.aac,.opus,.wma,.aiff,.aif,.amr,.mid,.weba";

const VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv|avi|flv|wmv|3gp|mpg|mpeg|ts|mts|ogv)$/i;
const AUDIO_EXT = /\.(mp3|wav|flac|ogg|oga|m4a|aac|opus|wma|aiff|aif|amr|weba)$/i;

export function MediaConvertTool({
  mode,
  titleKey,
  subtitleKey,
}: {
  mode: "video" | "audio";
  titleKey: DictKey;
  subtitleKey: DictKey;
}) {
  const { t } = useI18n();
  const [format, setFormat] = useState<MediaFormat>(mode === "video" ? "mp4" : "mp3");
  const [mp3Kbps, setMp3Kbps] = useState(320);
  const [working, setWorking] = useState(false);
  useUnloadGuard(working);
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [result, setResult] = useState<{ name: string; blob: Blob; beforeBytes: number } | null>(null);

  const maxBytes = mode === "video" ? VIDEO_MAX_BYTES : CONVERT_AUDIO_MAX_BYTES;
  const formats: readonly MediaFormat[] = mode === "video" ? VIDEO_FORMATS : AUDIO_FORMATS;

  // Pre-warm the 31MB engine after the first user gesture — same discipline
  // as VideoTool (never on load, skipped on data-saver).
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
    const file = files.find((f) =>
      mode === "video"
        ? f.type.startsWith("video/") || VIDEO_EXT.test(f.name)
        : f.type.startsWith("audio/") || AUDIO_EXT.test(f.name),
    );
    if (!file) return;
    if (file.size > maxBytes) {
      setStatus({ title: t("files.tooLarge"), message: formatBytes(maxBytes), tone: "warning" });
      return;
    }
    if (mode === "video" && isIos() && file.size > VIDEO_IOS_WARN_BYTES) {
      setStatus({ title: t("vidtool.iosWarning"), message: file.name, tone: "warning" });
    }

    setWorking(true);
    setResult(null);
    setProgress(null);
    setStatus({ title: t("vidtool.loadingEngine"), message: file.name, tone: "neutral" });

    try {
      await loadFFmpeg();
      setStatus({ title: t("mediatool.converting"), message: `${file.name} → ${format.toUpperCase()}`, tone: "neutral" });
      const blob = await convertMedia(file, format, {
        mp3Kbps,
        onProgress: ({ ratio }) => setProgress(ratio),
      });
      const name = convertedName(file.name, format);
      setResult({ name, blob, beforeBytes: file.size });
      setStatus({
        title: t("files.done"),
        message: `${formatBytes(file.size)} → ${formatBytes(blob.size)}`,
        tone: "success",
      });
      downloadBlob(blob, name);
    } catch (error) {
      // A clean encoder failure leaves the worker healthy; anything else
      // (OOM, crash) makes it unusable — reset so retry works.
      if (!(error instanceof ConvertError)) resetFFmpeg();
      setStatus({ title: t("mediatool.convertFail"), message: file.name, tone: "warning" });
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
          <legend>{t("imgtool.formatOut")}</legend>
          <div className="quality-options media-format-options">
            {formats.map((f) => (
              <button
                key={f}
                className={`quality-button${format === f ? " active" : ""}`}
                type="button"
                disabled={working}
                onClick={() => setFormat(f)}
              >
                <strong>{f.toUpperCase()}</strong>
              </button>
            ))}
          </div>
        </fieldset>

        {mode === "audio" && format === "mp3" ? (
          <fieldset className="quality-field">
            <legend>{t("mediatool.bitrate")}</legend>
            <div className="quality-options">
              {MP3_BITRATES.map((kbps) => (
                <button
                  key={kbps}
                  className={`quality-button${mp3Kbps === kbps ? " active" : ""}`}
                  type="button"
                  disabled={working}
                  onClick={() => setMp3Kbps(kbps)}
                >
                  <strong>{kbps}</strong>
                  <span>kbps</span>
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}

        <FileDrop
          accept={mode === "video" ? VIDEO_ACCEPT : AUDIO_ACCEPT}
          disabled={working}
          onFiles={process}
          hint={
            mode === "video"
              ? t("vidtool.dropVideo", { size: formatBytes(maxBytes) })
              : t("mediatool.dropAudio", { size: formatBytes(maxBytes) })
          }
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
