# padlet-mcp-proxy

Dependency-free Node.js proxy that exposes **Padlet's official hosted MCP server** (`https://mcp.padlet.com`) through a Manufact Cloud deployment.

- MCP endpoint: `/mcp` (or `/`) on your Manufact URL
- Auth: Padlet OAuth 2.1 + PKCE, handled by Padlet — no API key, nothing stored here
- Health check: `/healthz`

## Config (env vars)

| Var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Listen port |
| `PADLET_TOOLSETS` | `core` | Padlet toolsets (`core`, `utility`, `board_admin`, `library`, comma-separated) |
| `PADLET_MCP_UPSTREAM` | `https://mcp.padlet.com` | Upstream MCP server |

Run locally: `npm start`
