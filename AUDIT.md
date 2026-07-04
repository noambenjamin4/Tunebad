# Tuner — Code Audit

Full read-through of `components/`, `hooks/`, `lib/`, `workers/`, `app/`. The codebase has been through several refactor passes and is in good shape; findings below are minor.

## Architecture (healthy)

- **Clean separation**: pure DSP/logic in `lib/audio/*` (decode, waveform, delay, pitch, remix, lufs, mp3-encoder, fallback-analysis) and `lib/format.ts`; React state in `hooks/*`; server-only code isolated in `lib/server/*`; UI in `components/*`. No server code leaks into client bundles.
- **Workers reused, not recreated**: `hooks/useAnalyzer.ts` and the loudness panel keep a single `Worker` in a ref and transfer sample buffers (`postMessage(req, [samples.buffer])`) — correct and efficient.
- **Shared helpers deduped**: `computeWaveformBars` (`lib/audio/waveform.ts`) is used by both the analyzer and the remix studio; MP3/WAV encoding is centralized in `lib/audio/mp3-encoder.ts` (`encodeMp3FromChannels`/`encodeWavFromChannels`) and reused by the converter and remix export.
- **No dead code**: `app/tuner-runtime.tsx`, the old static `index.html`/`script.js`/`styles.css`, Turnstile, and the legacy Supabase routes were all removed. No `TODO`/`FIXME`/stray `console.log`. All 8 npm dependencies are in use.
- **i18n**: 214 keys, TypeScript-enforced parity across 8 locales; server-originated error strings intentionally pass through untranslated.

## Minor findings (low priority — not applied to avoid late-stage risk)

1. **History limit mismatch** — `hooks/useHistory.ts` caps localStorage at `HISTORY_LIMIT = 24` but reads `REMOTE_LIMIT = 50` from Supabase. When Supabase is configured, the in-memory list can show 50 while the local mirror is trimmed to 24. Harmless (the UI just shows what's loaded), but the two constants could be unified to 50 for consistency.
2. **Remote history rows are lean** — `entryFromRemoteRow` sets `scale:""`, `confidence:0`, `energy/danceability/loudness:null` because the `analysis_history` table only stores name/bpm/key/camelot/duration. History entries reloaded from Supabase therefore show less detail than freshly-analyzed ones. If richer synced history matters later, extend the schema + mapping; for "remember previous tracks" it's fine.
3. **`globals.css` is 1,900 lines** — coherent and sectioned, but a future pass could split per-feature blocks into CSS modules if it keeps growing. Not worth doing now.
4. **`analysis.worker.ts` centered-window** — BPM/key run on a centered 150s window for very long files; documented and intentional.

## Performance notes (already good)

- Analysis downsamples to 16 kHz mono before the worker (matches Tunebat, ~3× less data).
- Waveform bars computed once per file and reused; playhead updates via `clip-path` width (compositor-friendly, no reflow).
- Remix live parameter changes update existing audio nodes in place; only pitch-lock triggers a re-stretch (debounced 400 ms).
- Offline render for export uses `OfflineAudioContext` (faster than realtime).

## Verified

`npx tsc --noEmit` clean; production build succeeds with and without env config; no console errors across all 8 tabs.
