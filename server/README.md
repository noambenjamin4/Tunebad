# Tuner remote downloader

Tiny standalone yt-dlp server so the Vercel-hosted Next.js app (which can't
shell out) can still power the link downloader. Zero npm dependencies.

Deploy via the Render Blueprint: connect this repo, Render reads
`render.yaml` at the repo root, and builds `server/Dockerfile`.

Env vars (set in Render dashboard, not committed):
- `API_KEY` — required; the Next.js app sends it as `x-api-key`.
- `YTDLP_COOKIES` — optional, base64-encoded `cookies.txt`; decoded to
  `/tmp/cookies.txt` at startup and passed via `--cookies` to yt-dlp. Helps
  when YouTube blocks Render's datacenter IPs with a bot check.

`PORT` is injected automatically by Render.
