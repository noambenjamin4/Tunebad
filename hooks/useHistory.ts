"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalysisResult, HistoryEntry } from "@/types/analysis";
import { formatTime } from "@/lib/format";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

const HISTORY_STORAGE_KEY = "tuner-analysis-history";
const HISTORY_LIMIT = 24;
const REMOTE_LIMIT = 50;
const TABLE = "analysis_history";

interface RemoteRow {
  name: string;
  bpm: number | null;
  key: string | null;
  camelot: string | null;
  duration: number | null;
  created_at: string;
}

function readLocal(): HistoryEntry[] {
  try {
    const stored = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function writeLocal(next: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next.slice(0, HISTORY_LIMIT)));
  } catch {
    // Storage full/blocked — in-memory history still works this session.
  }
}

function entryFromResult(result: AnalysisResult): HistoryEntry {
  return {
    name: result.name,
    duration: formatTime(result.duration),
    bpm: result.bpm || 0,
    key: result.key,
    scale: result.scale,
    confidence: result.confidence,
    analyzedAt: result.analyzedAt,
    energy: result.energy,
    danceability: result.danceability,
    loudness: result.loudness,
  };
}

function entryFromRemoteRow(row: RemoteRow): HistoryEntry {
  return {
    name: row.name,
    duration: row.duration != null ? formatTime(row.duration) : "",
    bpm: row.bpm || 0,
    key: row.camelot || row.key || "",
    scale: "",
    confidence: 0,
    analyzedAt: row.created_at,
    energy: null,
    danceability: null,
    loudness: null,
  };
}

async function ensureAnonSession(): Promise<string | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    let userId = data.session?.user?.id ?? null;
    if (!userId) {
      const { data: signInData, error } = await supabase.auth.signInAnonymously();
      if (error) return null;
      userId = signInData.session?.user?.id ?? signInData.user?.id ?? null;
    }
    return userId;
  } catch {
    return null;
  }
}

export function useHistory() {
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const userIdRef = useRef<string | null>(null);
  const remoteReadyRef = useRef(false);

  useEffect(() => {
    // Instant local cache/mirror so the list shows immediately and works offline.
    setItems(readLocal());

    if (!isSupabaseConfigured) return;

    let cancelled = false;
    void (async () => {
      const userId = await ensureAnonSession();
      if (cancelled || !userId) return;
      userIdRef.current = userId;

      try {
        const supabase = await getSupabase();
        if (!supabase) return;
        const { data, error } = await supabase
          .from(TABLE)
          .select("name,bpm,key,camelot,duration,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(REMOTE_LIMIT);
        if (error || !data || cancelled) return;

        remoteReadyRef.current = true;
        const remoteItems = (data as RemoteRow[]).map(entryFromRemoteRow);
        setItems(remoteItems);
        writeLocal(remoteItems);
      } catch {
        // Fall back silently to whatever localStorage already has.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: HistoryEntry[]) => {
    setItems(next);
    writeLocal(next);
  }, []);

  const rememberResult = useCallback((result: AnalysisResult) => {
    const entry = entryFromResult(result);

    setItems((current) => {
      const next = [entry, ...current.filter((existing) => existing.name !== entry.name)].slice(0, HISTORY_LIMIT);
      writeLocal(next);
      return next;
    });

    if (!isSupabaseConfigured) return;

    void (async () => {
      try {
        const supabase = await getSupabase();
        if (!supabase) return;
        let userId = userIdRef.current;
        if (!userId) {
          userId = await ensureAnonSession();
          userIdRef.current = userId;
        }
        if (!userId) return;

        await supabase.from(TABLE).upsert(
          {
            user_id: userId,
            name: result.name,
            bpm: result.bpm || null,
            key: result.key || null,
            camelot: result.camelot || null,
            duration: result.duration || null,
          },
          { onConflict: "user_id,name" },
        );
      } catch {
        // Silently fall back to localStorage-only behavior.
      }
    })();
  }, []);

  const clearHistory = useCallback(() => {
    persist([]);

    if (!isSupabaseConfigured) return;

    void (async () => {
      try {
        const supabase = await getSupabase();
        if (!supabase) return;
        let userId = userIdRef.current;
        if (!userId) {
          userId = await ensureAnonSession();
          userIdRef.current = userId;
        }
        if (!userId) return;
        await supabase.from(TABLE).delete().eq("user_id", userId);
      } catch {
        // Silently fall back to localStorage-only behavior.
      }
    })();
  }, [persist]);

  return { items, rememberResult, clearHistory };
}
