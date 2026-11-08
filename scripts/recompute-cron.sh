#!/usr/bin/env bash
#
# Cron worker for 6dtrust: recompute all roots and ship accept_set DIFFs to the
# SERVING database (Neon — what Vercel reads), then exit. Runs on an always-on
# machine on a schedule, which is the bootstrap compute tier until a real
# worker exists. The apply-diff write in recomputeRoot means an unchanged run
# writes zero accept_set rows, so frequent refresh is cheap.
#
# TARGET: this deliberately does NOT use the project's local .env (that points at
# the local docker Postgres). It reads its connection string from .env.cron
# (gitignored), which you must create with the NEON connection string:
#
#     DATABASE_URL=postgres://<neon pooled connection string>
#
# Copy that value from the Vercel project's env. Until .env.cron exists, this
# script no-ops (logs a note and exits 0) — so the cron entry is harmless to
# install before the secret is in place.
#
# INSTALL (every 5 minutes):
#   */5 * * * * /path/to/6dtrust/scripts/recompute-cron.sh
#
# LOG: ~/Library/Logs/6dt-recompute.log (override with LOG=/path/to/log)
set -euo pipefail

# Self-locate the project (scripts/ -> project root) so this survives a move.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
# Absolute path preferred: cron runs with a minimal PATH that won't find bun.
# Override with BUN=/path/to/bun if yours lives somewhere unusual.
BUN="${BUN:-bun}"
LOG="${LOG:-$HOME/Library/Logs/6dt-recompute.log}"

ts() { date '+%Y-%m-%dT%H:%M:%S'; }

if [ ! -f "$PROJECT_DIR/.env.cron" ]; then
	echo "$(ts) [recompute-cron] .env.cron missing — set DATABASE_URL (Neon) to activate; skipping" >> "$LOG"
	exit 0
fi

# Load DATABASE_URL from .env.cron via bun's dotenv parser (NOT shell sourcing).
# Sourcing with `. file` executes the file as shell, so a Neon connection string
# containing `&` (e.g. `?sslmode=require&channel_binding=require`) hits a shell
# parse error and DATABASE_URL silently never gets set. `--env-file` parses it the
# dotenv way, so the value needs no quoting and any pasted connection string
# survives. Run from a neutral cwd ($HOME) so bun can't also auto-load the
# project's local .env (which points at local Postgres) and clobber our target.
cd "$HOME"

echo "$(ts) [recompute-cron] start" >> "$LOG"
if "$BUN" --env-file="$PROJECT_DIR/.env.cron" "$PROJECT_DIR/scripts/recompute.ts" >> "$LOG" 2>&1; then
	echo "$(ts) [recompute-cron] done" >> "$LOG"
else
	# Capture the exit code BEFORE the next `$(ts)` runs `date` and clobbers $?.
	rc=$?
	echo "$(ts) [recompute-cron] FAILED (exit $rc)" >> "$LOG"
fi
