---
title: Getting started
layout: default
---

# Getting started

## 1. Install

```bash
git clone https://github.com/YOUR_ORG/metrc-mcp.git
cd metrc-mcp
npm install
```

## 2. Credentials

Create a `.env` file in the repo root:

```
METRC_API_URL=https://sandbox-api-co.metrc.com
METRC_VENDOR_API_KEY=your-vendor-key
METRC_USER_API_KEY=your-user-key
```

For production, point `METRC_API_URL` to the appropriate state METRC API and use production keys.

## 3. Add to MCP (e.g. Cursor)

In Cursor: **Settings → MCP** (or `.cursor/mcp.json`):

```json
{
  "metrc": {
    "command": "node",
    "args": ["/absolute/path/to/metrc-mcp/server.js"],
    "cwd": "/absolute/path/to/metrc-mcp"
  }
}
```

To pass keys via config instead of `.env`, add an `env` block to the server entry. **Scripts** (e.g. `npm run populate-simulated-year`) also read from MCP config: they try `.env` first, then `.cursor/mcp.json` in the repo, then `~/.cursor/mcp.json`.

```json
{
  "metrc": {
    "command": "node",
    "args": ["/path/to/metrc-mcp/server.js"],
    "cwd": "/path/to/metrc-mcp",
    "env": {
      "METRC_VENDOR_API_KEY": "your-vendor-key",
      "METRC_USER_API_KEY": "your-user-key"
    }
  }
}
```

Restart the MCP server (or Cursor) after pulling new tools.

## 4. Use tools and skills

- **Tools:** In Cursor or any MCP client, call tools by name (e.g. `metrc_get_facilities`, `metrc_get_packages`). See [Tools](tools).
- **Skills:** In Cursor with this repo open, ask “What needs attention?”, “Summarize the facility”, “Audit in a week — check risk areas”, “What to pull for samples?” — the rules route to the right skill. See [Skills](skills).
- **External LLMs:** Call `resources/list` and `resources/read` with URIs like `metrc://skills/needs-attention` to load skill text into context, then call the METRC tools as described in the skill.

## 5. Test

```bash
npm test
```

Runs an integration test (initialize, list tools, call a few tools). Requires no credentials for structure checks; with valid `.env`, API calls are exercised.
