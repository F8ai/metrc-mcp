---
title: Setup with GitHub and Vercel
layout: default
---

# Setup with GitHub and Vercel

Use **GitHub** for the repo and Pages (chat UI), and **Vercel** for the API (chat + MCP). All steps can be done with `gh` and `vercel` CLIs.

---

## Prerequisites

- [GitHub CLI](https://cli.github.com/) (`gh`) — `brew install gh` then `gh auth login`
- [Vercel CLI](https://vercel.com/docs/cli) — `npm i -g vercel` then `vercel login`
- METRC sandbox keys (vendor + user API key)
- [OpenRouter](https://openrouter.ai/) API key (for chat)

---

## 1. GitHub

### Clone (or fork) the repo

```bash
gh repo clone F8ai/metrc-mcp
cd metrc-mcp
```

If you forked:

```bash
gh repo clone YOUR_USER/metrc-mcp
cd metrc-mcp
```

### Enable GitHub Pages (docs → site)

Pages serves the `docs/` folder (including the chat UI at `/chat/`).

**Option A – GitHub CLI**

```bash
# From repo root; replace OWNER with your GitHub user/org
gh api repos/OWNER/metrc-mcp/pages -X PUT -f source='{"branch":"main","path":"/docs"}'
```

**Option B – In the browser**

1. **Settings → Pages**
2. **Source:** Deploy from a branch
3. **Branch:** `main` → **Folder:** `/docs` → Save

Your site will be:

- **F8ai repo:** `https://f8ai.github.io/metrc-mcp/`
- **Fork:** `https://<YOUR_USER>.github.io/metrc-mcp/`

Chat UI: **https://&lt;YOUR_USER&gt;.github.io/metrc-mcp/chat/**

---

## 2. Vercel (API)

### Deploy from GitHub

**Option A – Vercel CLI (link existing repo)**

```bash
cd metrc-mcp
vercel
# Follow prompts: link to existing project or create new one, connect to GitHub
```

**Option B – Dashboard**

1. Go to [vercel.com/new](https://vercel.com/new)
2. **Import** the GitHub repo (e.g. `F8ai/metrc-mcp` or your fork)
3. Leave **Root Directory** and **Framework Preset** as default; deploy.

You’ll get a URL like `https://metrc-mcp.vercel.app` (or `https://metrc-mcp-*.vercel.app`).

### Set environment variables

**Option A – Vercel CLI**

From the repo root (with `vercel` already linked):

```bash
# Required for /api/chat — paste key when prompted, then select Production (and Preview if desired)
vercel env add OPENROUTER_API_KEY

# Required for METRC tools (chat + MCP / Load facilities)
vercel env add METRC_VENDOR_API_KEY
vercel env add METRC_USER_API_KEY

# Optional
vercel env add OPENROUTER_MODEL
vercel env add METRC_API_URL
```

Redeploy so new env vars are used:

```bash
vercel --prod
```

To list vars: `vercel env ls`. To pull into a local file: `vercel env pull .env.local`.

**Option B – Dashboard**

1. **Project → Settings → Environment Variables**
2. Add:

| Name | Value | Environments |
|------|--------|--------------|
| `OPENROUTER_API_KEY` | your OpenRouter key | Production, Preview |
| `METRC_VENDOR_API_KEY` | your METRC vendor key | Production, Preview |
| `METRC_USER_API_KEY` | your METRC user key | Production, Preview |
| `OPENROUTER_MODEL` | e.g. `openai/gpt-4o` | optional |
| `METRC_API_URL` | `https://sandbox-api-co.metrc.com` | optional |

3. **Redeploy** (Deployments → ⋮ → Redeploy).

---

## 3. Use the chat UI

1. Open the Pages chat URL (e.g. **https://f8ai.github.io/metrc-mcp/chat/**).
2. In **API URL**, enter your Vercel URL (e.g. `https://metrc-mcp.vercel.app`) with no trailing slash.
3. Click **Load facilities**, then choose a facility (e.g. **SF-SBX-CO-1-8002**).
4. Send messages; the model will use the selected facility for METRC tools.

---

## 4. CORS and custom GitHub Pages URL

The API allows requests from **https://f8ai.github.io**. If your Pages site is on a different host (e.g. a fork at `https://YOUR_USER.github.io`), you have two options:

**A. Keep using F8ai’s Pages**

Use **https://f8ai.github.io/metrc-mcp/chat/** and only your Vercel API URL in the chat UI.

**B. Allow your fork’s origin in the API**

In `api/chat.js` and `api/mcp.js`, set:

```js
'Access-Control-Allow-Origin': 'https://YOUR_USER.github.io'
```

(or add logic to allow multiple origins). Commit, push, and redeploy on Vercel.

---

## Quick reference

| Item | Where |
|------|--------|
| Chat UI | GitHub Pages → `https://<owner>.github.io/metrc-mcp/chat/` |
| API (chat + MCP) | Vercel → `https://<project>.vercel.app/api/chat` and `/api/mcp` |
| Env vars | Vercel project → Settings → Environment Variables |
| Repo | GitHub → `F8ai/metrc-mcp` (or your fork) |
