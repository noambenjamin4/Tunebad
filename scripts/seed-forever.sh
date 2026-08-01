#!/bin/bash
# DISABLED 2026-07-31 — do not re-enable as-is. See "Why it's off" below.
#
# Perpetual catalog growth: run the Deezer seeder back to back, forever.
# Installed as the com.tunebad.seeder launchd agent (KeepAlive), so it
# survives reboots and restarts itself if it ever dies. Each cycle:
#   1. waits for any already-running seeder to finish (never two at once —
#      that would double-hit Deezer's API),
#   2. runs one 50k-cap pass (the script itself skips cached songs and, with
#      shuffled frontier sampling, explores a different slice each time),
#   3. rests 5 minutes, then goes again.
# Logs rotate per cycle under logs/seed/ and only the last 20 are kept.
#
# ---------------------------------------------------------------------------
# WHY IT'S OFF (2026-07-31)
#
# This loop cannot run continuously on Supabase's free plan. Before each pass
# seed-songs.mjs downloads the ENTIRE id list to skip cached tracks — measured
# at 25,132 bytes per 1,000 ids, so ~5.5 MB per cycle at 217k songs, and it
# grows with the catalog. Resting only 5 minutes between cycles, that is
# roughly 4 GB/month at hourly cycles and ~8 GB at half-hourly, against a
# 5 GB/month egress limit. Exceeding it doesn't bill Noam (there's no card on
# file) — it PAUSES the project, i.e. the site goes down.
#
# Disabled via `launchctl disable gui/$UID/com.tunebad.seeder` and by renaming
# ~/Library/LaunchAgents/com.tunebad.seeder.plist to .disabled. `launchctl
# bootout` alone is NOT enough: the plist sets RunAtLoad + KeepAlive, so it
# comes back at the next login.
#
# TO RE-ENABLE SAFELY: run it bounded (e.g. one capped pass a week via
# StartCalendarInterval), not as this perpetual loop. A weekly pass costs
# ~5.5 MB of preload instead of ~4-8 GB/month. Better still, replace the
# full-catalog preload with a per-track existence check before removing the
# cap on frequency.
# ---------------------------------------------------------------------------
set -u

cd "$(dirname "$0")/.." || exit 1
mkdir -p logs/seed

while true; do
  # One seeder at a time, ever. Covers both a manually-started run and the
  # previous cycle somehow still winding down.
  while pgrep -f "node scripts/seed-songs.mjs" > /dev/null 2>&1; do
    sleep 60
  done

  STAMP=$(date +%Y%m%d-%H%M%S)
  LOG="logs/seed/run-$STAMP.log"
  echo "[seed-forever] starting cycle $STAMP" >> logs/seed/forever.log
  node scripts/seed-songs.mjs 50000 > "$LOG" 2>&1
  echo "[seed-forever] cycle $STAMP exited $? — $(tail -1 "$LOG" 2>/dev/null)" >> logs/seed/forever.log

  # Keep the 20 most recent cycle logs.
  ls -t logs/seed/run-*.log 2>/dev/null | tail -n +21 | xargs rm -f 2>/dev/null

  sleep 300
done
