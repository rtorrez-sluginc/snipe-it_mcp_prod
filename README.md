# Snipe-IT MCP Server

Connect Claude Desktop to your Snipe-IT asset management instance via the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/).

This project provides a production-ready MCP server that lets Claude interact with your Snipe-IT instance — listing assets, users, models, checking out/in equipment, and more — through natural language.

---

## Architecture

```
Claude Desktop / Claude Code
        |
   mcp-remote (stdio proxy)
        |
   Cloudflare Tunnel (TLS)
        |
   MCP Server (Express + SSE)
        |
   Snipe-IT API (Laravel/PHP)
```

**Security layers:** Cloudflare Edge (TLS/DDoS) → Cloudflare Tunnel (encrypted) → Bearer Token Auth → Input Validation + Rate Limiting → Container Isolation

---

## Quick Start

### Option A: Local (stdio) — Fastest setup

```bash
# 1. Clone and install
git clone https://github.com/YOUR_ORG/snipe-it_mcp_prod.git
cd snipe-it_mcp_prod/mcp-server
npm install

# 2. Configure
cp .env.example .env
# Edit .env with your Snipe-IT URL and API token

# 3. Build
npm run build

# 4. Add to Claude Desktop config (%APPDATA%\Claude\claude_desktop_config.json)
```

```json
{
  "mcpServers": {
    "snipeit": {
      "command": "node",
      "args": ["/FULL/PATH/TO/snipe-it_mcp_prod/mcp-server/build/index.js"],
      "env": {
        "SNIPEIT_URL": "https://your-snipeit-instance.com",
        "SNIPEIT_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

### Option B: Remote (Docker + Cloudflare Tunnel)

```bash
# 1. Clone
git clone https://github.com/YOUR_ORG/snipe-it_mcp_prod.git
cd snipe-it_mcp_prod

# 2. Configure deployment
cp deployment/.env.example deployment/.env
# Edit deployment/.env with your tokens

# 3. Build and start
cd deployment
docker build -t cloudflared:latest .
docker compose up -d --build

# 4. Verify
curl http://localhost:3100/health
curl https://mcp.yourdomain.com/health
```

Then configure Claude Desktop with the `mcp-remote` proxy:

```json
{
  "mcpServers": {
    "snipeit-production": {
      "command": "npx",
      "args": [
        "mcp-remote@latest",
        "--sse",
        "https://mcp.yourdomain.com/sse",
        "--header",
        "Authorization: Bearer <your-mcp-bearer-token>"
      ]
    }
  }
}
```

---

## Available MCP Tools

| Tool | Description |
|------|-------------|
| `list_assets` | List/search assets with pagination and status filtering |
| `get_asset` | Get detailed asset information by ID |
| `create_asset` | Create a new asset |
| `checkout_asset` | Check out an asset to a user, asset, or location |
| `checkin_asset` | Check in an asset |
| `list_users` | List/search users |
| `get_user` | Get user details by ID |
| `list_models` | List asset models |
| `list_categories` | List categories |
| `list_locations` | List/search locations |
| `list_status_labels` | List all status labels |
| `list_manufacturers` | List manufacturers |
| `list_suppliers` | List suppliers |

---

## Project Structure

```
snipe-it_mcp_prod/
├── mcp-server/              # MCP server source code
│   ├── src/index.ts          # stdio transport (local use)
│   ├── src-http/index.ts     # HTTP/SSE transport (remote use)
│   ├── Dockerfile            # Multi-stage production build
│   ├── package.json
│   ├── tsconfig.json         # TypeScript config (stdio)
│   ├── tsconfig.http.json    # TypeScript config (HTTP)
│   ├── .env.example          # Configuration template
│   └── .mcp.json             # Claude Code MCP config
├── deployment/               # Docker deployment
│   ├── Dockerfile            # Cloudflared tunnel image
│   ├── docker-compose.yml    # Full stack: MCP server + tunnel
│   └── .env.example          # Deployment secrets template
├── examples/                 # Test scripts
│   ├── test-auth.mjs         # Authenticated asset listing
│   ├── test-users.mjs        # User listing through tunnel
│   ├── checkin-asset.mjs     # Multi-step check-in workflow
│   └── asset-history.mjs     # Direct Snipe-IT API history export
├── docs/                     # Reference documentation
├── README.md                 # This file
├── .gitignore
└── LICENSE
```

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SNIPEIT_URL` | Yes | Your Snipe-IT instance URL (HTTPS required, localhost exempt) |
| `SNIPEIT_API_TOKEN` | Yes | API token from Snipe-IT Settings > API |
| `MCP_BEARER_TOKEN` | For HTTP | Token for authenticating MCP clients (generate with `openssl rand -hex 32`) |
| `PORT` | No | HTTP server port (default: 3000) |
| `ALLOW_HTTP` | No | Set `true` for internal Docker HTTP traffic |
| `SESSION_TIMEOUT_MS` | No | SSE session idle timeout in ms (default: 3600000 = 1 hour) |
| `CF_TUNNEL_TOKEN` | For tunnel | Cloudflare Tunnel token |

### Docker Network

The `docker-compose.yml` expects your Snipe-IT containers to be on an existing Docker network. Find your network name:

```bash
docker network ls | grep snipeit
```

Then update `deployment/docker-compose.yml` with the correct network name.

---

## Security

- Bearer token authentication on all HTTP endpoints
- HTTPS enforcement (localhost exempt for development)
- TLS certificate validation
- Input validation on all tool parameters
- Rate limiting (30 SSE connections/min, 60 messages/min per IP)
- Session timeout (1 hour idle)
- Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
- Non-root Docker containers
- Multi-stage Docker builds
- Sanitized error responses (no internal details leaked)
- Audit logging on all tool calls

See `mcp-server/SECURITY-REVIEW.md` and `mcp-server/SECURITY-REVIEW-2026-02-15.md` for full security audit details.

---

## Documentation

| Document | Description |
|----------|-------------|
| [INSTALL-PLAYBOOK.md](mcp-server/INSTALL-PLAYBOOK.md) | Step-by-step installation guide |
| [PROJECT-OVERVIEW.md](mcp-server/PROJECT-OVERVIEW.md) | Architecture, build, deployment, and testing guide |
| [docs/API-REFERENCE.md](docs/API-REFERENCE.md) | Complete API reference |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture details |
| [docs/SECURITY.md](docs/SECURITY.md) | Security implementation guide |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common issues and fixes |
| [docs/DEPLOYMENT-CHECKLIST.md](docs/DEPLOYMENT-CHECKLIST.md) | Pre-deployment checklist |

---

## License

MIT
