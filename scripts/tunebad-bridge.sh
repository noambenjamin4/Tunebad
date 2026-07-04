#!/bin/zsh
# TuneBad Home Bridge: runs the hardened download server on this Mac so the
# live website can route YouTube downloads through this machine's home IP
# (YouTube bot-walls datacenter IPs; a residential IP is not blocked).
#
# Bound to 127.0.0.1 — it is NOT exposed on the LAN. Public reach comes only
# from Tailscale Funnel, which proxies to this loopback port over HTTPS and is
# gated by API_KEY. Started/kept alive by launchd (com.tunebad.bridge).
set -u

DIR="$HOME/Code/Tuner"
export PORT=8080
export HOST=127.0.0.1
export API_KEY="***REMOVED-ROTATED-KEY***"
export YTDLP_PATH="$DIR/bin/yt-dlp"
export FFMPEG_PATH="$DIR/node_modules/ffmpeg-static/ffmpeg"
# Higher job-start ceiling so a 50-track playlist batch doesn't self-throttle
# (the public Render fallback keeps the conservative default).
export YTDLP_MAX_JOB_STARTS=60

cd "$DIR" || exit 1

# First-run provisioning: the yt-dlp binary is gitignored.
[ -x bin/yt-dlp ] || npm run setup:ytdlp >> /tmp/tunebad-bridge.log 2>&1

exec node server/server.js
