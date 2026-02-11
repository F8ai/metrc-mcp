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

## Test

```bash
node server.js
# Server runs on stdio; Cursor/other MCP clients connect to it
```
