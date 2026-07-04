# Tuner — UX Walkthrough Report

Drove every major path in the browser (desktop + mobile, light + dark). Overall the product is coherent, fast, and the monochrome design reads as intentional and premium. Findings are prioritized; quick wins are marked.

## What works well
- **Empty states are honest** — Loudness, Slowed+Reverb, and Analysis show only a dropzone until you add a file (no fake demo data). First-time users aren't confused by placeholder numbers.
- **The auto-analyze chain is the standout** — paste a link → it downloads → analyzes → shows BPM/key + delay/reverb numbers → the Delay tool is pre-filled. This removes the exact manual busywork the tool exists to kill.
- **Seekable waveform** now behaves like every DAW/player users know: full-width, click/drag to scrub, visible playhead — in both Analysis and Slowed+Reverb.
- **Numbers are legible** — mono font on every readout (BPM, ms, Hz, LUFS, dB) makes them scannable; the delay table matches a reference calculator to the cent.

## Friction points & recommendations

1. **"MP3 Converter" undersells the tab** (low). The tab also outputs WAV and (locally) pulls from 6 platforms; on Vercel it's a local file→MP3/WAV converter. The subtitle clarifies, and a `titleLocalOnly` variant already adjusts copy when the downloader is hidden. *Optional:* rename the nav label to "Converter". Left as-is to avoid churning all 8 locales for a minor gain.
2. **Each tool has its own upload** (low, inherent). Loudness, Analysis, and Slowed+Reverb each need their own file drop. This is normal for a multi-tool utility, but a power user analyzing then remixing the same track re-uploads it. *Future idea:* a shared "current track" that any tool can pick up (the analyzer→delay BPM sync already hints at this pattern).
3. **BPM half/double ("or 74")** (info, not a bug). The BPM card shows an alternate tempo. This is correct and useful for producers, but a first-timer might wonder what "or 74" means. The `Detected` sublabel and mono styling keep it unobtrusive; consider a tooltip later.
4. **History detail when synced** (low). Cloud-synced history rows show name + BPM + key but not energy/danceability (schema is lean by design). Fine for "remember previous tracks"; noted in AUDIT.md if richer sync is ever wanted.

## Mobile
- No horizontal overflow at 375/414px; the delay table scrolls within its card rather than pushing the page; the waveform stays full-width and scrubs on touch (pointer events).
- Hamburger nav + inline language list work; every control is ≥44px tall.

## Accessibility
- The seek waveform is a `role="slider"` with arrow-key/Home/End support and aria-value labels.
- Icons are `aria-hidden`; theme follows `prefers-color-scheme` with sufficient contrast in both modes.
- Language menu uses `role="listbox"`/`option` with `aria-selected` and Escape/click-outside close.

## Verdict
Ship-ready. The remaining items are polish ideas, not blockers.
