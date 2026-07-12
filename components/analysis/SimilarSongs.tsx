"use client";

// "Mixes well with this" — real songs from TuneBad's community catalog that
// are harmonically compatible (Camelot wheel) and beatmatchable with the
// track the user just analyzed. Strictly a bonus: any fetch error or empty
// match list renders nothing at all.
import { useEffect, useState } from "react";
import type { AnalysisResult } from "@/types/analysis";
import { useI18n } from "@/lib/i18n";

type SimilarSong = {
  slug: string;
  title: string;
  artist: string | null;
  key: string;
  bpm: number;
  camelot: string | null;
};

export function SimilarSongs({ result }: { result: AnalysisResult }) {
  const { t } = useI18n();
  const [songs, setSongs] = useState<SimilarSong[]>([]);

  // result.camelot is the display label ("Camelot 8A"); the API wants the code.
  const camelotCode = result.camelot.match(/(1[0-2]|[1-9])[AB]/)?.[0] ?? null;
  const bpm = result.bpm ? Math.round(result.bpm) : null;

  useEffect(() => {
    setSongs([]);
    if (!camelotCode || !bpm) return;
    const controller = new AbortController();
    void fetch(`/api/similar?camelot=${camelotCode}&bpm=${bpm}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { similar?: SimilarSong[] } | null) => {
        if (data?.similar?.length) setSongs(data.similar);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [camelotCode, bpm]);

  if (!songs.length) return null;
  return (
    <div className="similar-songs">
      <span className="similar-songs-label">{t("analysis.mixesWith")}</span>
      <ul className="similar-songs-list">
        {songs.map((s) => (
          <li key={s.slug}>
            <a className="similar-songs-pill" href={`/song/${s.slug}`}>
              <span className="similar-songs-title">
                {s.artist ? `${s.artist} - ` : ""}
                {s.title}
              </span>
              <span className="similar-songs-stats">
                {s.key} · {Math.round(s.bpm)} BPM{s.camelot ? ` · ${s.camelot}` : ""}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
