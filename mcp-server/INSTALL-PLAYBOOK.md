# Snipe-IT MCP Server — Installation Playbook

**From zero to running in 30 minutes.**

---

## Prerequisites

| Requirement | Minimum | Check |
|-------------|---------|-------|
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Git | 2.x | `git --version` |
| Snipe-IT instance | Running, API enabled | Accessible via browser |
| Snipe-IT API token | Generated | Settings > API > Personal Access Tokens |

---

## Phase 1: Clone & Install (5 min)

### 1.1 Clone the repository

```bash
git clone https://github.com/YOUR_ORG/snipe-it_mcp_prod.git
cd snipe-it_mcp_prod/mcp-server
```

### 1.2 Install dependencies

```bash
npm install
```

Expected: `added ~50 packages` with 0 vulnerabilities.

### 1.3 Verify security

```bash
npm audit
```

Expected: `found 0 vulnerabilities`

---

## Phase 2: Configure (5 min)

### 2.1 Create your .env file

```bash
cp .env.example .env
```

### 2.2 Edit .env with your values

```bash
nano .env
```

```env
# Your Snipe-IT instance URL
# Use HTTPS in production (localhost exempt for development)
SNIPEIT_URL=https://your-snipeit-instance.com

# Your API token from Snipe-IT (Settings > API > Personal Access Tokens)
SNIPEIT_API_TOKEN=your-token-here

# Port for HTTP transport (optional, default 3000)
PORT=3000
```

### 2.3 Verify API connectivity

```bash
export $(grep -v '^#' .env | grep -v '^$' | xargs)
curl -s -H "Authorization: Bearer $SNIPEIT_API_TOKEN" \
  -H "Accept: application/json" \
  "$SNIPEIT_URL/api/v1/statuslabels" | head -c 200
```

Expected: JSON response with your status labels. If you get `401`, your token is wrong. If connection refused, check your URL.

---

## Phase 3: Build (2 min)

### 3.1 Build both transports

```bash
npm run build && npm run build:http
```

Expected: No errors, no output. This compiles TypeScript to:
- `build/index.js` — stdio transport (for Claude Desktop / Claude Code)
- `build-http/index.js` — HTTP/SSE transport (for remote/tunnel access)

### 3.2 Verify build output

```bash
ls build/index.js build-http/index.js
```

Both files should exist.

---

## Phase 4: Choose Your Transport

You have two options. Pick the one that fits your use case.

### Option A: stdio transport (recommended for local use)

Best for: Claude Desktop, Claude Code, or any MCP client on the same machine.

**How it works:** The MCP client spawns the server as a subprocess and communicates over stdin/stdout. No network port, no authentication needed.

Skip to [Phase 5A](#phase-5a-stdio-setup).

### Option B: HTTP/SSE transport (for remote access)

Best for: Cloudflare Tunnel, remote clients, shared team access.

**How it works:** Express server on a port with SSE for MCP protocol. Requires an authentication layer in front (Cloudflare Access, reverse proxy, etc.).

Skip to [Phase 5B](#phase-5b-httpsse-setup).

---

## Phase 5A: stdio Setup (5 min)

### 5A.1 Test the server starts

```bash
export $(grep -v '^#' .env | grep -v '^$' | xargs)
node build/index.js
```

Expected output on stderr:
```
Snipe-IT MCP Server (Hardened) running on stdio
```

Press `Ctrl+C` to stop.

### 5A.2 Configure Claude Desktop

**macOS:**
```bash
nano ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Windows:**
```
notepad %APPDATA%\Claude\claude_desktop_config.json
```

**Linux / WSL:**
```bash
nano ~/.config/Claude/claude_desktop_config.json
```

Add this configuration (replace paths and values):

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

Get your full path:
```bash
echo "$(pwd)/build/index.js"
```

### 5A.3 Configure Claude Code

The `.mcp.json` in the repo is already configured for stdio. Set your token in your shell environment:

```bash
export SNIPEIT_API_TOKEN="your-token-here"
```

Or add it to your shell profile (`~/.bashrc`, `~/.zshrc`):
```bash
echo 'export SNIPEIT_API_TOKEN="your-token-here"' >> ~/.bashrc
source ~/.bashrc
```

### 5A.4 Restart Claude and test

Restart Claude Desktop (or reload Claude Code), then try:
- "List my assets in Snipe-IT"
- "Show me all status labels"
- "Get details for asset ID 1"

Skip to [Phase 6: Verification](#phase-6-verification).

---

## Phase 5B: HTTP/SSE Setup (10 min)

### 5B.1 Start the HTTP server

```bash
npm run start:http
```

Expected output:
```
Snipe-IT MCP Server (HTTP/SSE) listening on port 3000
Health check: http://localhost:3000/health
SSE endpoint: http://localhost:3000/sse
```

### 5B.2 Test health endpoint

In a second terminal:
```bash
curl -s http://localhost:3000/health | python3 -m json.tool
```

Expected:
```json
{
    "status": "healthy",
    "timestamp": "...",
    "version": "1.0.0"
}
```

### 5B.3 Security — authentication is required

The HTTP transport includes built-in Bearer token authentication. Set `MCP_BEARER_TOKEN` in your `.env` file. For production deployments, also deploy behind one of:

| Method | Best for |
|--------|----------|
| **Cloudflare Tunnel + Access** | Production — SSO/MFA before traffic reaches server |
| **Reverse proxy with auth** | nginx/Caddy with basic auth, OAuth, or mTLS |
| **Localhost only** | Development — bind to 127.0.0.1, no external access |

### 5B.4 Rate limiting (built-in)

The HTTP transport includes per-IP rate limiting:
- `/sse`: 30 connections per minute per IP
- `/message`: 60 requests per minute per IP

Clients exceeding limits receive `429 Too Many Requests`.

### 5B.5 Connect an MCP client via SSE

For Claude Desktop with SSE (use mcp-remote proxy for auth header support):
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

## Phase 6: Verification

### 6.1 Test all 13 tools

| # | Tool | Test query | Expected |
|---|------|-----------|----------|
| 1 | `list_assets` | "List all assets" | JSON array of assets |
| 2 | `get_asset` | "Get asset ID 1" | Single asset detail |
| 3 | `create_asset` | "Create asset with model_id 1, status_id 2" | New asset created |
| 4 | `checkout_asset` | "Check out asset 1 to user 1" | Checkout confirmation |
| 5 | `checkin_asset` | "Check in asset 1" | Checkin confirmation |
| 6 | `list_users` | "List all users" | JSON array of users |
| 7 | `get_user` | "Get user ID 1" | Single user detail |
| 8 | `list_models` | "List asset models" | JSON array of models |
| 9 | `list_categories` | "List categories" | JSON array of categories |
| 10 | `list_locations` | "List locations" | JSON array of locations |
| 11 | `list_status_labels` | "List status labels" | JSON array of statuses |
| 12 | `list_manufacturers` | "List manufacturers" | JSON array of manufacturers |
| 13 | `list_suppliers` | "List suppliers" | JSON array of suppliers |

### 6.2 Verify security hardening

```bash
# Confirm .env is not tracked
git status --short .env
# Expected: nothing (gitignored)

# Confirm no secrets in repo
git log --all --diff-filter=A --name-only --format="" | grep -i env
# Expected: only .env.example

# Confirm npm audit clean
npm audit
# Expected: 0 vulnerabilities
```

---

## Phase 7: Running as a Service (optional)

### Linux (systemd)

Create `/etc/systemd/system/snipeit-mcp.service`:

```ini
[Unit]
Description=Snipe-IT MCP Server (HTTP)
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/snipe-it_mcp_prod/mcp-server
EnvironmentFile=/path/to/snipe-it_mcp_prod/mcp-server/.env
ExecStart=/usr/bin/node build-http/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable snipeit-mcp
sudo systemctl start snipeit-mcp
sudo systemctl status snipeit-mcp
```

### WSL (keep-alive with pm2)

```bash
npm install -g pm2
pm2 start build-http/index.js --name snipeit-mcp
pm2 save
pm2 startup
```

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `SNIPEIT_URL and SNIPEIT_API_TOKEN environment variables are required` | Missing .env or env vars not loaded | Check `.env` exists, re-run with `npm run start:http` (loads .env automatically) |
| `SNIPEIT_URL must use HTTPS protocol` | Non-HTTPS URL for non-localhost | Use HTTPS or switch to localhost for dev |
| `SNIPEIT_URL is not a valid URL` | Malformed URL in .env | Check for typos, include `http://` or `https://` |
| `Authentication failed` (401 from Snipe-IT) | Bad API token | Generate a new token in Snipe-IT Settings > API |
| `ECONNREFUSED` | Snipe-IT server not reachable | Check URL, confirm Snipe-IT is running |
| `ETIMEDOUT` | Network/firewall issue | Check firewall rules, DNS resolution |
| Build errors (`tsc` fails) | Missing dependencies | Run `npm install` again |
| `429 Too Many Requests` | Rate limit hit on HTTP transport | Wait 60 seconds, or adjust limits in source |

---

## What's in This Build

### Security Features

- Environment variable credential handling (never in args or logs)
- HTTPS enforcement (localhost exempt for dev)
- TLS certificate validation (`rejectUnauthorized: true`)
- Comprehensive input validation (IDs, strings, dates, enums, limits)
- Sanitized error responses (no stack traces, no internal details)
- Request timeouts
- Per-IP rate limiting on HTTP transport
- Bearer token authentication on HTTP endpoints
- `.gitignore` protecting secrets and build artifacts

### Architecture

```
snipe-it_mcp_prod/
├── mcp-server/
│   ├── src/index.ts          # stdio transport (Claude Desktop / Claude Code)
│   ├── src-http/index.ts     # HTTP/SSE transport (remote / tunnel)
│   ├── build/                # Compiled stdio (gitignored)
│   ├── build-http/           # Compiled HTTP (gitignored)
│   ├── docs/                 # Reference documents
│   ├── .env.example          # Config template
│   ├── .mcp.json             # MCP client config (stdio, env passthrough)
│   ├── SECURITY-REVIEW.md    # Full security audit
│   ├── INSTALL-PLAYBOOK.md   # This file
│   ├── package.json          # Dependencies & scripts
│   ├── tsconfig.json         # TypeScript config (stdio)
│   └── tsconfig.http.json    # TypeScript config (HTTP)
├── deployment/               # Docker deployment
│   ├── docker-compose.yml
│   ├── Dockerfile            # Cloudflared
│   └── .env.example
├── examples/                 # Test scripts
└── README.md                 # Project overview
```
