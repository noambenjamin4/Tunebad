"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTuner } from "../TunerApp";
import { useYouTubeJob } from "@/hooks/useYouTubeJob";
import { validateMediaUrl } from "@/lib/media-url";
import { delayDivisions } from "@/lib/audio/delay";
import { useI18n } from "@/lib/i18n";
import { CheckRow } from "@/components/ui/CheckRow";
import { SetupNotice } from "./SetupNotice";
import { QualityPicker, FormatPicker, type Quality, type OutputFormat } from "./QualityPicker";

export function YouTubeDownloader() {
  const { requestAnalysis, lastAnalysis, showView } = useTuner();
  const { state, start, reset } = useYouTubeJob();
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  const [quality, setQuality] = useState<Quality>("320");
  const [format, setFormat] = useState<OutputFormat>("mp3");
  const [trimSilence, setTrimSilence] = useState(true);
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [inputError, setInputError] = useState<string | null>(null);
  const [handingOff, setHandingOff] = useState(false);
  const [autoAnalyzedName, setAutoAnalyzedName] = useState<string | null>(null);
  const autoAnalyzedJobRef = useRef<string | null>(null);

  const busy = state.phase === "starting" || state.phase === "working";

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const validated = validateMediaUrl(url);
    if (!validated) {
      setInputError(t("ytDownloader.linkError"));
      return;
    }
    setInputError(null);
    autoAnalyzedJobRef.current = null;
    setAutoAnalyzedName(null);
    void start(validated.url, quality, format, trimSilence);
  };

  const analyzeDownloaded = async (jobId: string, title: string | null) => {
    setHandingOff(true);
    try {
      const response = await fetch(`/api/youtube/${jobId}/file`);
      if (!response.ok) throw new Error(t("ytDownloader.couldNotFetchAudio"));
      const blob = await response.blob();
      const type = blob.type || (format === "wav" ? "audio/wav" : "audio/mpeg");
      const ext = type === "audio/wav" ? "wav" : "mp3";
      const name = `${title || "tuner-download"}.${ext}`;
      const file = new File([blob], name, { type });
      requestAnalysis([file], { switchView: false });
      return name;
    } catch (error) {
      console.error(error);
      return null;
    } finally {
      setHandingOff(false);
    }
  };

  const manualAnalyze = async (jobId: string, title: string | null) => {
    setHandingOff(true);
    try {
      const response = await fetch(`/api/youtube/${jobId}/file`);
      if (!response.ok) throw new Error(t("ytDownloader.couldNotFetchAudio"));
      const blob = await response.blob();
      const type = blob.type || (format === "wav" ? "audio/wav" : "audio/mpeg");
      const ext = type === "audio/wav" ? "wav" : "mp3";
      const file = new File([blob], `${title || "tuner-download"}.${ext}`, { type });
      requestAnalysis([file]);
    } catch (error) {
      console.error(error);
    } finally {
      setHandingOff(false);
    }
  };

  useEffect(() => {
    if (state.phase !== "done") return;
    if (!autoAnalyze) return;
    if (autoAnalyzedJobRef.current === state.jobId) return;
    autoAnalyzedJobRef.current = state.jobId;
    void analyzeDownloaded(state.jobId, state.title).then((name) => {
      if (name) setAutoAnalyzedName(name);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, autoAnalyze]);

  const analysisReady = Boolean(autoAnalyzedName) && lastAnalysis?.name === autoAnalyzedName;
  const analysisPending = Boolean(autoAnalyzedName) && !analysisReady;

  // Wakes a sleeping Render free-tier remote downloader as soon as this card
  // is visible, so it's warm by the time the user submits a link. No-op if
  // no remote downloader is configured (the route returns 204 either way).
  useEffect(() => {
    void fetch("/api/youtube/wake").catch(() => {});
  }, []);

  return (
    <article className="utility-card converter-card">
      <div className="tool-heading">
        <div>
          <h3>{t("ytDownloader.title")}</h3>
          <p>{t("ytDownloader.subtitle")}</p>
        </div>
      </div>

      <form className="converter-form" onSubmit={onSubmit}>
        <label>
          {t("ytDownloader.trackUrl")}
          <input
            type="url"
            placeholder={t("ytDownloader.urlPlaceholder")}
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setInputError(null);
            }}
            disabled={busy}
          />
        </label>
        <FormatPicker value={format} onChange={setFormat} />
        {format === "mp3" ? <QualityPicker value={quality} onChange={setQuality} /> : null}
        <CheckRow checked={trimSilence} onChange={setTrimSilence} disabled={busy}>
          {t("converter.autoTrim")}
        </CheckRow>
        <CheckRow checked={autoAnalyze} onChange={setAutoAnalyze} disabled={busy}>
          {t("ytDownloader.autoAnalyze")}
        </CheckRow>
        <button className="convert-button" type="submit" disabled={busy || !url.trim()}>
          {busy ? t("ytDownloader.loading") : t("converter.convertTo", { format: format.toUpperCase() })}
        </button>
      </form>

      {inputError ? (
        <div className="status-box" data-tone="warning" role="status">
          <strong>{t("ytDownloader.linkErrorTitle")}</strong>
          <span>{inputError}</span>
        </div>
      ) : state.phase === "idle" ? (
        <div className="status-box" role="status">
          <strong>{t("ytDownloader.idleTitle")}</strong>
          <span>{t("ytDownloader.idleMessage")}</span>
        </div>
      ) : state.phase === "starting" ? (
        <div className="status-box" role="status">
          <strong>{t("ytDownloader.startingTitle")}</strong>
          <span>{t("ytDownloader.startingMessage")}</span>
        </div>
      ) : state.phase === "working" ? (
        <div className="status-box" role="status">
          <strong>{state.status === "converting" ? t("ytDownloader.converting") : t("ytDownloader.downloading")}</strong>
          <span>
            {state.title || t("ytDownloader.fetchingAudio")} — {Math.round(state.progress)}%
            <span className="progress-track" aria-hidden="true">
              <span className="progress-fill" style={{ width: `${Math.max(2, state.progress)}%` }}></span>
            </span>
          </span>
        </div>
      ) : state.phase === "done" ? (
        <div className="status-box" data-tone="success" role="status">
          <strong>{t("ytDownloader.readyTitle")}</strong>
          <span>
            {t("ytDownloader.readyMessage", { title: state.title || t("ytDownloader.defaultTitle") })}
            <span className="inline-actions">
              <a className="download-ready-link" href={`/api/youtube/${state.jobId}/file`}>
                {t("ytDownloader.downloadFormat", { format: format.toUpperCase() })}
              </a>
              <button
                className="text-button"
                type="button"
                disabled={handingOff}
                onClick={() => void manualAnalyze(state.jobId, state.title)}
              >
                {handingOff ? t("ytDownloader.loading") : t("ytDownloader.analyzeTrack")}
              </button>
              <button className="text-button" type="button" onClick={reset}>
                {t("ytDownloader.newDownload")}
              </button>
            </span>
          </span>
          {analysisPending ? <span className="autoflow-chip">{t("ytDownloader.analyzing")}</span> : null}
          {analysisReady && lastAnalysis ? (
            <span className="autoflow-chip">
              <span>
                <strong>{Math.round(lastAnalysis.bpm)} BPM</strong> · <strong>{lastAnalysis.key}</strong> ·{" "}
                <strong>{lastAnalysis.camelot}</strong>
              </span>
              {(() => {
                const { divisions, reverbPresets } = delayDivisions(lastAnalysis.bpm);
                const quarter = divisions.find((d) => d.label === "1/4");
                const eighth = divisions.find((d) => d.label === "1/8");
                const smallRoom = reverbPresets.find((p) => p.name === "Small Room");
                return (
                  <span>
                    {quarter ? t("ytDownloader.quarterDelay", { ms: quarter.normal.ms }) : ""}
                    {eighth ? t("ytDownloader.eighthDelay", { ms: eighth.normal.ms }) : ""}
                    {smallRoom
                      ? t("ytDownloader.smallRoomReverb", { pre: smallRoom.preDelayMs, decay: smallRoom.decayMs })
                      : ""}
                  </span>
                );
              })()}
              <span className="inline-actions">
                <button className="text-button" type="button" onClick={() => showView("delay")}>
                  {t("ytDownloader.openDelayTool")}
                </button>
                <button className="text-button" type="button" onClick={() => showView("analysis")}>
                  {t("ytDownloader.fullAnalysis")}
                </button>
              </span>
            </span>
          ) : null}
        </div>
      ) : state.phase === "setup" ? (
        <SetupNotice code={state.code} />
      ) : (
        <div className="status-box" data-tone="warning" role="status">
          <strong>{t("ytDownloader.downloadFailedTitle")}</strong>
          <span>{state.message}</span>
        </div>
      )}
    </article>
  );
}
