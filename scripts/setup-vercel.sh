#!/usr/bin/env sh
# Deploy metrc-mcp to Vercel (assumes env vars already set in project).
# Run from repo root: ./scripts/setup-vercel.sh
# To add env vars: vercel env add OPENROUTER_API_KEY production; same for METRC_*.
set -e
cd "$(dirname "$0")/.."

echo "=== Link (if needed) ==="
vercel link --yes 2>/dev/null || true

echo ""
echo "=== Deploy to production ==="
vercel --prod --yes

echo ""
echo "Done. Chat: https://metrc-mcp.vercel.app/chat"
