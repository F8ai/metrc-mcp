# METRC MCP Server

MCP (Model Context Protocol) server that exposes METRC cannabis tracking API tools for LLMs. Uses Basic Auth with the Colorado sandbox.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure credentials** in `.env`:
   ```
   METRC_API_URL=https://sandbox-api-co.metrc.com
   METRC_VENDOR_API_KEY=your-vendor-key
   METRC_USER_API_KEY=your-user-key
   ```

3. **Add to Cursor MCP config** (`.cursor/mcp.json` or Cursor Settings → MCP):

   ```json
   "metrc": {
     "command": "node",
     "args": ["/path/to/metrc-mcp/server.js"],
     "cwd": "/path/to/metrc-mcp"
   }
   ```

   Or pass keys in `env`:
   ```json
   "metrc": {
     "command": "node",
     "args": ["/path/to/metrc-mcp/server.js"],
     "cwd": "/path/to/metrc-mcp",
     "env": {
       "METRC_VENDOR_API_KEY": "your-vendor-key",
       "METRC_USER_API_KEY": "your-user-key"
     }
   }
   ```

## Tools

| Tool | Description |
|------|-------------|
| `metrc_get_facilities` | List facilities and license numbers |
| `metrc_get_strains` | Active strains (requires license_number) |
| `metrc_get_items` | Active items/products |
| `metrc_get_locations` | Active locations |
| `metrc_get_packages` | Active packages |
| `metrc_get_harvests` | Active harvests |
| `metrc_get_plant_batches` | Active plant batches |
| `metrc_get_units_of_measure` | Units of measure |
| `metrc_get_waste_methods` | Waste methods |
| `metrc_get_employees` | Employees |
| `metrc_get_plants_flowering` | Flowering plants (for harvest) |
| `metrc_get_plants_vegetative` | Vegetative plants |
| `metrc_harvest_plants` | Create harvest from flowering plants |
| `metrc_get_location_types` | Location types (for creating locations) |
| `metrc_create_location` | Create a location |
| `metrc_get_tags_plant_available` | Available plant tags |
| `metrc_get_plant_batch_types` | Plant batch types (Seed, Clone, etc.) |
| `metrc_create_plant_batch_plantings` | Create plant batch and plantings |
| `metrc_change_plants_growth_phase` | Change plant phase (e.g. to Flowering) |

### Creating flowering plants

**Restart the MCP server** after pulling so Cursor sees the new tools. Then:

1. **`metrc_get_location_types`** (license_number) – pick a `LocationTypeId` where the type allows plants (e.g. grow room).
2. **`metrc_create_location`** (license_number, name, location_type_id) – create a location that can hold plants (your only current location is “Centralized Processing Hub” and does not allow plants).
3. **`metrc_get_tags_plant_available`** (license_number) – get available plant tag labels.
4. **`metrc_create_plant_batch_plantings`** (license_number, plant_batch_name, strain_id, location_id, type, count, planting_date, plant_labels) – create a batch and individual plants (use strain Id from `metrc_get_strains`, location Id from step 2, type e.g. `"Clone"`, and one tag label per plant from step 3).
5. **`metrc_get_plants_vegetative`** (license_number) – list vegetative plants (new plantings may start here).
6. **`metrc_change_plants_growth_phase`** (license_number, growth_phase: `"Flowering"`, change_date, plant_ids or plant_labels) – move those plants to Flowering.

Then use **`metrc_get_plants_flowering`** to confirm, and **`metrc_harvest_plants`** when ready to create a harvest.

## Skills (Cursor)

Higher-level analysis patterns live in **`skills/`** and are installed as **Cursor rules** in **`.cursor/rules/`**. When this repo is open in Cursor and the METRC MCP is connected, the AI will use these skills to answer analytical questions.

| Skill | Trigger | Rule file |
|-------|---------|-----------|
| **Needs attention** | "What needs attention?", compliance, expiring tags | `metrc-skill-needs-attention.mdc` |
| **Facility summary** | "Summarize the facility", overview | `metrc-skill-facility-summary.mdc` |
| **Traceability** | "Where did this package come from?", harvest outputs | `metrc-skill-traceability.mdc` |
| **Inventory summary** | "What's in inventory?", by location/strain | `metrc-skill-inventory-summary.mdc` |
| **Audit-ready snapshot** | "Audit in a week — check risk areas" | `metrc-skill-audit-ready-snapshot.mdc` |
| **FIFO / aging pull** | "What to pull for samples/vendor days/discounting?" | `metrc-skill-fifo-aging-pull.mdc` |

Details: see **`skills/README.md`** and the `.mdc` files in **`.cursor/rules/`**. No extra install step: open this repo in Cursor and the rules apply.

### External LLMs (any MCP client)

The server exposes skills as **MCP resources** so any client (Claude Desktop, custom app, etc.) can load them:

1. **`resources/list`** — returns URIs like `metrc://skills/needs-attention`, `metrc://skills/facility-summary`, etc.
2. **`resources/read`** with `uri: "metrc://skills/needs-attention"` — returns the skill markdown.

The client can pass that text to the LLM as context, then the LLM calls the METRC tools as described in the skill. See **`skills/README.md`** for the full list of URIs.

### Product / feature roadmap

**`docs/MASTER_FRAMEWORK.md`** maps a full product/feature framework (bulk actions, aging, compliance, yield, etc.) to what can be built in this repo (MCP tools + skills) vs in an app (UI, rules engine, external data). Use it to prioritize new skills or tools.

## Chat and MCP on Vercel Edge

The repo includes **Vercel Edge** endpoints so you can host a chat UI and the METRC MCP over HTTP:

| Endpoint | Description |
|----------|-------------|
| **`POST /api/chat`** | Chat with OpenRouter (default model: `openai/gpt-4o`). The model has access to all METRC tools; when it calls a tool, the Edge runs it and returns the result. Body: `{ "message": "List my facilities" }` or `{ "messages": [...] }`. |
| **`POST /api/mcp`** | MCP-over-HTTP: JSON-RPC `tools/list` and `tools/call` so any client can list and invoke METRC tools. |

**Deploy:** Connect the repo to Vercel; the `api/` and `lib/` files deploy as Edge (see `export const config = { runtime: 'edge' }` in `api/chat.js` and `api/mcp.js`).

**Environment variables (Vercel project settings or `.env`):**

- **Chat (OpenRouter):** `OPENROUTER_API_KEY` (required for `/api/chat`). Optional: `OPENROUTER_MODEL` (e.g. `openai/gpt-4o` or `openai/gpt-oss-120b` if available on OpenRouter).
- **METRC (same as stdio server):** `METRC_API_URL` (default `https://sandbox-api-co.metrc.com`), `METRC_VENDOR_API_KEY`, `METRC_USER_API_KEY`.

Example chat request:

```bash
curl -X POST https://your-project.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What facilities do I have?"}'
```

Example MCP tools/call (after getting tools via `tools/list`):

```bash
curl -X POST https://your-project.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"metrc_get_facilities","arguments":{}}}'
```

## Sandbox view

**[Sandbox view](https://f8ai.github.io/metrc-mcp/sandbox-view)** (in the docs) maps the Colorado sandbox: facilities, strains, locations, plants, harvests, packages, items, and transfers, with cross-links to the [tools](https://f8ai.github.io/metrc-mcp/tools), [skills](https://f8ai.github.io/metrc-mcp/skills), and [framework](https://f8ai.github.io/metrc-mcp/framework). Use it to see what to query and how the lifecycle (seed → sale) ties together.

## Documentation (GitHub Pages)

Full documentation is published as **GitHub Pages** from the `docs/` folder:

- **Live site:** [https://f8ai.github.io/metrc-mcp/](https://f8ai.github.io/metrc-mcp/)
- **Enable (already done via `gh api`):** Source is branch **main**, folder **/docs**. To re-enable or change: **Settings → Pages**, or `gh api repos/OWNER/REPO/pages -X PUT --input -` with `{"source":{"branch":"main","path":"/docs"}}`.
- **Pages map to the framework:** The [Framework](docs/framework.md) page is the Master Function & Feature Framework with each section linked to [Tools](docs/tools.md) and [Skills](docs/skills.md). Use the docs site as the single place for MCP + framework reference.

## Populate sandbox (full lifecycle)

To seed the Colorado sandbox with 12 strains and a full seed-to-sale flow (plantings → flowering → harvest → packages → finish):

```bash
npm run populate-sandbox
```

Requires `.env` with `METRC_VENDOR_API_KEY` and `METRC_USER_API_KEY`. The script will create strains (SBX Strain 1–12), run sandbox setup, create a plant-capable location if the sandbox offers one, create plantings and move them to flowering, create harvests, create items and packages, and finish packages. If the sandbox has no location type with `ForPlants: true`, plantings are skipped; you still get strains and can create standalone packages if the API allows.

## Test

```bash
node server.js
# Server runs on stdio; Cursor/other MCP clients connect to it
```
