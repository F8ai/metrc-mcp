---
title: METRC MCP
layout: default
---

# METRC MCP

MCP (Model Context Protocol) server that exposes **METRC** cannabis tracking API tools and **analysis skills** for LLMs. Use it from Cursor, Claude Desktop, or any MCP client to query and act on facilities, harvests, packages, plants, transfers, and more.

---

## Documentation

| Page | Description |
|------|-------------|
| [**Getting started**](getting-started) | Setup, credentials, Cursor MCP config |
| [**Setup (GitHub + Vercel)**](setup-gh-vercel) | Deploy with `gh` and `vercel` CLIs — Pages + API |
| [**Tools**](tools) | All MCP tools (50+) by category |
| [**Skills**](skills) | Analysis skills (needs-attention, facility summary, audit snapshot, FIFO, etc.) and MCP resource URIs |
| [**Master Framework**](framework) | Product/feature framework mapped to MCP capabilities (bulk, aging, compliance, yield, reports, etc.) |
| [**Framework Q&A**](framework-qa) | Example questions and expected answers for each framework item (demos, testing) |
| [**Sandbox view**](sandbox-view) | Colorado sandbox: everything referenced and cross-linked (entities, lifecycle, tools, skills) |
| [**Chat**](chat/) | Chat UI with facility dropdown (GitHub Pages; point API URL at your Vercel deployment) |

---

## What’s included

- **Tools:** Read and write METRC data (facilities, strains, items, locations, packages, harvests, plants, transfers, lab tests, waste, processing). Colorado sandbox; Basic Auth.
- **Resources:** Skills are exposed as MCP resources (`metrc://skills/<name>`). Any client can call `resources/list` and `resources/read` to load skill text and pass it to the LLM.
- **Cursor:** Project rules in `.cursor/rules/` route questions to the right skill when this repo is open.
- **Framework:** [Master Function & Feature Framework](framework) maps 14 feature areas (bulk, aging, compliance, yield, tolling, reports, etc.) to what to build in MCP/skills vs in your app.

---

## Quick start

1. Clone the repo, run `npm install`, add `.env` with `METRC_VENDOR_API_KEY` and `METRC_USER_API_KEY`.
2. Add the server to your MCP config (e.g. Cursor) with `command: node`, `args: ["/path/to/metrc-mcp/server.js"]`, `cwd: "/path/to/metrc-mcp"`.
3. Use tools (e.g. `metrc_get_facilities`, `metrc_get_packages`) or ask in natural language; with Cursor rules, questions like “What needs attention?” or “Audit readiness” trigger the right skill.

See [Getting started](getting-started) for full setup.
