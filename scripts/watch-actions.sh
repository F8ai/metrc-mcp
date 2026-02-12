#!/usr/bin/env sh
# Watch the latest GitHub Actions run (e.g. pages build).
# Usage: ./scripts/watch-actions.sh   or   gh run watch $(gh run list --limit 1 --json databaseId -q '.[0].databaseId')
set -e
cd "$(dirname "$0")/.."
RUN_ID=$(gh run list --limit 1 --json databaseId -q '.[0].databaseId')
echo "Watching run $RUN_ID..."
exec gh run watch "$RUN_ID" --exit-status
