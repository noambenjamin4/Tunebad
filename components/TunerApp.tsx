"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AnalysisResult, HistoryEntry } from "@/types/analysis";
import { clampBpm } from "@/lib/format";
import { useHistory } from "@/hooks/useHistory";
import { I18nProvider } from "@/lib/i18n";
import { TopBar } from "./layout/TopBar";
import { AnalyzerPanel } from "./analysis/AnalyzerPanel";
import { BpmToolsView } from "./bpm/BpmToolsView";
import { DelayCalculator } from "./delay/DelayCalculator";
import { PitchConverter } from "./pitch/PitchConverter";
import { ConverterView } from "./converter/ConverterView";
import { HistoryPanel } from "./history/HistoryPanel";
import { LoudnessPanel } from "./loudness/LoudnessPanel";
import { RemixStudio } from "./remix/RemixStudio";

export type ViewName = "analysis" | "bpm" | "delay" | "pitch" | "converter" | "loudness" | "remix" | "history";

const VIEW_NAMES: ViewName[] = ["analysis", "bpm", "delay", "pitch", "converter", "loudness", "remix", "history"];

interface TunerContextValue {
  view: ViewName;
  showView(view: ViewName): void;
  delayBpm: string;
  setDelayBpmInput(value: string): void;
  setMainBpm(value: number): number;
  metronomeBpm: number;
  setMetronomeBpm(value: number): void;
  lastAnalyzedBpm: number | null;
  setLastAnalyzedBpm(value: number | null): void;
  lastAnalysis: AnalysisResult | null;
  setLastAnalysis(result: AnalysisResult | null): void;
  history: HistoryEntry[];
  rememberResult(result: AnalysisResult): void;
  clearHistory(): void;
  pendingFiles: File[] | null;
  requestAnalysis(files: File[], options?: { switchView?: boolean }): void;
  clearPendingFiles(): void;
}

const TunerContext = createContext<TunerContextValue | null>(null);

export function useTuner(): TunerContextValue {
  const value = useContext(TunerContext);
  if (!value) throw new Error("useTuner must be used inside <TunerApp>");
  return value;
}

export function TunerApp() {
  const [view, setView] = useState<ViewName>("analysis");
  const [delayBpm, setDelayBpm] = useState("124.00");
  const [metronomeBpm, setMetronomeBpmState] = useState(124);
  const [lastAnalyzedBpm, setLastAnalyzedBpm] = useState<number | null>(null);
  const [lastAnalysis, setLastAnalysis] = useState<AnalysisResult | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const { items: history, rememberResult, clearHistory } = useHistory();

  useEffect(() => {
    const initial = window.location.hash.replace("#", "");
    if (VIEW_NAMES.includes(initial as ViewName)) setView(initial as ViewName);
  }, []);

  const showView = useCallback((next: ViewName) => {
    setView(next);
    window.history.replaceState(null, "", `#${next}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const setDelayBpmInput = useCallback((value: string) => {
    setDelayBpm(value);
    setMetronomeBpmState(Math.round(clampBpm(value)));
  }, []);

  const setMainBpm = useCallback((value: number) => {
    const bpm = clampBpm(value);
    setDelayBpm(bpm.toFixed(2));
    setMetronomeBpmState(Math.round(bpm));
    return bpm;
  }, []);

  const setMetronomeBpm = useCallback((value: number) => {
    setMetronomeBpmState(Math.round(clampBpm(value)));
  }, []);

  const requestAnalysis = useCallback(
    (files: File[], options?: { switchView?: boolean }) => {
      setPendingFiles(files);
      if (options?.switchView !== false) showView("analysis");
    },
    [showView],
  );

  const clearPendingFiles = useCallback(() => setPendingFiles(null), []);

  const contextValue = useMemo<TunerContextValue>(
    () => ({
      view,
      showView,
      delayBpm,
      setDelayBpmInput,
      setMainBpm,
      metronomeBpm,
      setMetronomeBpm,
      lastAnalyzedBpm,
      setLastAnalyzedBpm,
      lastAnalysis,
      setLastAnalysis,
      history,
      rememberResult,
      clearHistory,
      pendingFiles,
      requestAnalysis,
      clearPendingFiles,
    }),
    [
      view,
      showView,
      delayBpm,
      setDelayBpmInput,
      setMainBpm,
      metronomeBpm,
      setMetronomeBpm,
      lastAnalyzedBpm,
      lastAnalysis,
      history,
      rememberResult,
      clearHistory,
      pendingFiles,
      requestAnalysis,
      clearPendingFiles,
    ],
  );

  return (
    <TunerContext.Provider value={contextValue}>
      <I18nProvider>
        <div className="app-shell">
          <TopBar />
          <main>
            <section className={`page-view${view === "analysis" ? " active" : ""}`} data-view="analysis">
              <AnalyzerPanel />
            </section>
            <section className={`page-view${view === "bpm" ? " active" : ""}`} data-view="bpm">
              <BpmToolsView />
            </section>
            <section className={`page-view${view === "delay" ? " active" : ""}`} data-view="delay">
              <DelayCalculator />
            </section>
            <section className={`page-view${view === "pitch" ? " active" : ""}`} data-view="pitch">
              <PitchConverter />
            </section>
            <section className={`page-view${view === "converter" ? " active" : ""}`} data-view="converter">
              <ConverterView />
            </section>
            <section className={`page-view${view === "loudness" ? " active" : ""}`} data-view="loudness">
              <LoudnessPanel />
            </section>
            <section className={`page-view${view === "remix" ? " active" : ""}`} data-view="remix">
              <RemixStudio />
            </section>
            <section className={`page-view${view === "history" ? " active" : ""}`} data-view="history">
              <HistoryPanel />
            </section>
          </main>
        </div>
      </I18nProvider>
    </TunerContext.Provider>
  );
}
