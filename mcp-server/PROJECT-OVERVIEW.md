# Snipe-IT MCP Server - Project Overview

## Build, Deployment & Testing Guide

**Project:** Snipe-IT MCP Server with Cloudflare Tunnel
**Repository:** https://github.com/YOUR_ORG/snipe-it_mcp_prod
**Portal URL:** https://mcp.yourdomain.com

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [MCP Server Build & Changes](#mcp-server-build--changes)
3. [Cloudflare Tunnel Build](#cloudflare-tunnel-build)
4. [Security Implementation](#security-implementation)
5. [MCP Portal - Securing Local MCP Over Internet](#mcp-portal---securing-local-mcp-over-internet)
6. [Claude Desktop Configuration](#claude-desktop-configuration)
7. [Testing Overview](#testing-overview)
8. [Production Readiness Checklist](#production-readiness-checklist)
9. [Troubleshooting](#troubleshooting)

---

## 1. Architecture Overview

```
                         Internet
                            |
                   +-----------------+
                   | Cloudflare Edge |
                   | mcp.yourdomain.com |
                   +-----------------+
                            |
                   Cloudflare Tunnel
                     (encrypted)
                            |
              +----------------------------+
              |  Docker: cloudflared-tunnel |
              |  (debian:bookworm-slim)     |
              +----------------------------+
                            |
                    Docker Network
                            |
              +----------------------------+
              |  Docker: mcp-server        |
              |  (node:20-slim)            |
              |  Express + SSE Transport   |
              |  Port 3000 (internal)      |
              |  Port 3100 (host mapped)   |
              +----------------------------+
                            |
                    Docker Network
                            |
              +----------------------------+
              |  Docker: snipeit-app       |
              |  Snipe-IT (Laravel/PHP)    |
              |  Port 80 (internal)        |
              +----------------------------+
```

**Traffic Flow:**
1. Claude Desktop connects via `mcp-remote` proxy to `https://mcp.yourdomain.com/sse`
2. Cloudflare terminates TLS and routes through the tunnel to `cloudflared-tunnel` container
3. `cloudflared-tunnel` forwards to `mcp-server:3000` on the shared Docker network
4. MCP server authenticates the Bearer token, establishes SSE session
5. Tool calls are forwarded as REST API requests to `snipeit-app:80`
6. Responses flow back through SSE to the client

---

## 2. MCP Server Build & Changes

### Original State
- Stdio-only MCP server (`src/index.ts`) — required local execution
- No HTTP transport, no containerization
- No authentication on any endpoint

### Changes Made

#### Fix SSE Transport
**Problem:** The `/message` POST endpoint returned `200 OK` without routing messages to the SSE transport. All tool calls silently failed.

**Fix:**
- Added `sessions` Map to track active SSE connections by `sessionId`
- `/message` POST handler now calls `transport.handlePostMessage(req, res, req.body)` to properly route JSON-RPC messages to the correct SSE session
- The third argument (`req.body`) is critical — without it, the SDK attempts to re-read the raw body, which fails when `express.json()` middleware has already parsed it

**Files Changed:** `src-http/index.ts`

#### HTTP & Dockerfile Fixes
**Problem:** Container-to-container traffic uses HTTP (not HTTPS), but the server enforced HTTPS. The `npm run start:http` script tried to source `.env` which doesn't exist in the container.

**Fixes:**
- Added `ALLOW_HTTP=true` environment variable support for internal Docker networks
- Added private hostname detection (localhost, 10.x, 172.16-31.x, 192.168.x)
- Changed Dockerfile `CMD` from `npm run start:http` to `node build-http/index.js`

**Files Changed:** `src-http/index.ts`, `Dockerfile`

#### Security Hardening
Full security implementation (see [Section 4](#security-implementation)).

**Files Changed:** `src-http/index.ts`, `Dockerfile`, `docker-compose.yml`

### Building the MCP Server

```bash
# From the mcp-server directory
cd mcp-server

# Install dependencies and build
npm install
npm run build:http

# Output goes to build-http/index.js
```

### MCP Server Dockerfile (Multi-Stage)

```dockerfile
FROM node:20-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.http.json ./
COPY src-http ./src-http
RUN npm run build:http

FROM node:20-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/build-http ./build-http
RUN useradd -m -u 1001 appuser && \
    chown -R appuser:appuser /app
USER appuser
EXPOSE 3000
CMD ["node", "build-http/index.js"]
```

**Key Details:**
- Multi-stage build keeps dev dependencies out of production image
- Non-root user (`appuser`, UID 1001)
- Only production dependencies installed in final image
- Runs `node` directly, not `npm` (avoids .env sourcing issues)

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `list_assets` | List/search assets with pagination |
| `get_asset` | Get asset details by ID |
| `create_asset` | Create new asset |
| `checkout_asset` | Check out asset to user/asset/location |
| `checkin_asset` | Check in an asset |
| `list_users` | List/search users |
| `get_user` | Get user details by ID |
| `list_models` | List asset models |
| `list_categories` | List categories |
| `list_locations` | List/search locations |
| `list_status_labels` | List status labels |
| `list_manufacturers` | List manufacturers |
| `list_suppliers` | List suppliers |

---

## 3. Cloudflare Tunnel Build

### Cloudflared Dockerfile

```dockerfile
FROM debian:bookworm-slim
ARG CLOUDFLARED_VERSION=2026.2.0

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    curl -L https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-linux-amd64.deb \
      -o /tmp/cloudflared.deb && \
    dpkg -i /tmp/cloudflared.deb && \
    rm /tmp/cloudflared.deb && \
    apt-get purge -y curl && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1001 cloudflared
USER cloudflared
ENTRYPOINT ["cloudflared"]
```

**Key Details:**
- Version-pinned cloudflared binary (`2026.2.0`)
- curl removed after download to minimize attack surface
- Non-root user (`cloudflared`, UID 1001)
- Clean apt lists for smaller image

### Building the Tunnel Image

```bash
cd deployment
docker build -t cloudflared:latest .
```

### Cloudflare Dashboard Configuration

The tunnel route must be configured in the Cloudflare Zero Trust dashboard:
- **Public Hostname:** `mcp.yourdomain.com`
- **Service:** `http://mcp-server:3000`
- **Type:** HTTP

This routes all traffic arriving at your public hostname through the tunnel to the MCP server container.

---

## 4. Security Implementation

### Security Review Findings (18 total)

A full security review was conducted. All critical and high findings were remediated.

| Severity | Found | Fixed |
|----------|-------|-------|
| Critical | 4 | 4 |
| High | 3 | 3 |
| Medium | 5 | 5 |
| Low | 4 | 4 |
| Info | 2 | 1 (version pinning is design choice) |

### Fixes Implemented

#### Authentication (Critical)
- Bearer token authentication on `/sse` and `/message` endpoints
- Token configured via `MCP_BEARER_TOKEN` environment variable
- 401 for missing token, 403 for invalid token
- `/health` endpoint remains public for monitoring

#### Secrets Management (Critical)
- All secrets moved to `.env` file (gitignored)
- `.env.example` provided with placeholder values
- Tokens removed from `docker-compose.yml` — uses `${VAR}` interpolation
- Three secrets managed: `SNIPEIT_API_TOKEN`, `CF_TUNNEL_TOKEN`, `MCP_BEARER_TOKEN`

#### Security Headers (Medium)
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
X-XSS-Protection: 1; mode=block
Cache-Control: no-store
```

#### Rate Limiting (High)
- SSE connections: 30/minute per IP
- Message requests: 60/minute per IP
- Client IP extracted from `cf-connecting-ip` > `x-forwarded-for` > `req.ip`
- `trust proxy` enabled for Cloudflare
- Bounded Map with max 10,000 entries (DoS protection)

#### Session Management (Medium)
- Session timeout: 1 hour idle (configurable via `SESSION_TIMEOUT_MS`)
- Cleanup runs every 60 seconds
- Sessions removed on SSE disconnect
- 403 returned for invalid session IDs (prevents enumeration)

#### Container Security (Medium)
- Both containers run as non-root users
- Multi-stage Docker build for MCP server
- Minimal base images (`debian:bookworm-slim`, `node:20-slim`)

#### Audit Logging (Low)
- All tool calls logged: `AUDIT: tool=X ip=X duration=Xms status=X`
- SSE connections and disconnections logged with client IP
- Startup log redacts sensitive URLs

#### Other Fixes
- Request body size limit: 10KB (`express.json({ limit: "10kb" })`)
- Axios timeout reduced from 30s to 10s
- Sanitized error responses (no internal details leaked to clients)

---

## 5. MCP Portal - Securing Local MCP Over Internet

### How It Works

The MCP server runs on a private Docker network alongside Snipe-IT. It is **not** directly exposed to the internet. Instead, a Cloudflare Tunnel provides secure, authenticated access.

### Security Layers

```
Layer 1: Cloudflare Edge
  - TLS termination (HTTPS)
  - DDoS protection
  - WAF (if configured)

Layer 2: Cloudflare Tunnel
  - Encrypted tunnel from edge to container
  - No open inbound ports required
  - No public IP needed

Layer 3: MCP Bearer Token Auth
  - Every /sse and /message request must include:
    Authorization: Bearer <token>
  - Token validated server-side before any processing

Layer 4: Application Security
  - Input validation on all tool parameters
  - Rate limiting per client IP
  - Session timeout (1 hour idle)
  - Security headers
  - Sanitized error responses

Layer 5: Container Security
  - Non-root processes
  - Minimal base images
  - Internal Docker network (not exposed to host)
  - Multi-stage builds (no dev tools in production)
```

### Docker Compose Deployment

See `deployment/docker-compose.yml` for the full configuration.

### Environment File (.env)

```bash
# .env (never commit this file)
SNIPEIT_API_TOKEN=<your-snipeit-api-token>
CF_TUNNEL_TOKEN=<your-cloudflare-tunnel-token>
MCP_BEARER_TOKEN=<generate-with: openssl rand -hex 32>
```

### Starting the Stack

```bash
cd deployment
docker compose up -d --build
```

### Verifying the Deployment

```bash
# Check containers are running
docker ps --filter "name=mcp-server" --filter "name=cloudflared"

# Check health endpoint (local)
curl http://localhost:3100/health

# Check health endpoint (through tunnel)
curl https://mcp.yourdomain.com/health

# Check MCP server logs
docker logs mcp-server

# Check tunnel connectivity
docker logs cloudflared-tunnel
```

---

## 6. Claude Desktop Configuration

### Known Issue: Auth Header Bug

Claude Desktop ignores the `Authorization` header when using SSE transport directly. It falls back to OAuth Dynamic Client Registration and sends `POST /register`, which fails.

### Workaround: mcp-remote Proxy

Use `mcp-remote` as a local stdio proxy that properly forwards auth headers:

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

**Config location:** `%APPDATA%\Claude\claude_desktop_config.json`

After updating, fully quit and restart Claude Desktop (close from system tray).

---

## 7. Testing Overview

### Test 1: Health Check (Local)

```bash
curl http://localhost:3100/health
```

**Expected:**
```json
{ "status": "healthy", "timestamp": "...", "version": "1.0.0" }
```

### Test 2: Health Check (Tunnel)

```bash
curl https://mcp.yourdomain.com/health
```

**Expected:** Same healthy response, confirms tunnel is routing correctly.

### Test 3: Authentication - No Token

```bash
curl https://mcp.yourdomain.com/sse
```

**Expected:** `401 Unauthorized: Bearer token required`

### Test 4: Authentication - Invalid Token

```bash
curl -H "Authorization: Bearer invalid-token" https://mcp.yourdomain.com/sse
```

**Expected:** `403 Forbidden: Invalid token`

### Test 5: Full MCP Handshake (Authenticated)

**Script:** `examples/test-auth.mjs`

Tests the complete MCP lifecycle through the tunnel:
1. Open SSE connection with Bearer token
2. Receive `endpoint` event with session URL
3. Send `initialize` request (JSON-RPC)
4. Receive capabilities response
5. Send `notifications/initialized`
6. Call `list_assets` tool
7. Receive and parse asset data

```bash
export MCP_BASE_URL=https://mcp.yourdomain.com
export MCP_BEARER_TOKEN=your-token
node examples/test-auth.mjs
```

**Expected:**
```
SUCCESS: 1 asset(s) retrieved through authenticated tunnel
  - ASSET-001 | Laptop Model | SN-001 | Your Name
```

### Test 6: User Listing (Through Tunnel)

```bash
node examples/test-users.mjs
```

**Expected:** List of users from Snipe-IT returned through the tunnel.

### Test 7: Status Labels (Through Tunnel)

Tested `list_status_labels` tool through the authenticated tunnel.

### Test 8: Claude Desktop Integration

1. Updated `claude_desktop_config.json` with `mcp-remote` proxy config
2. Restarted Claude Desktop
3. Asked Claude to "pull asset list"
4. Claude successfully called `list_assets` and displayed results

### Test Matrix Summary

| Test | Transport | Auth | Result |
|------|-----------|------|--------|
| Health check (local) | HTTP localhost:3100 | None (public) | PASS |
| Health check (tunnel) | HTTPS mcp.yourdomain.com | None (public) | PASS |
| SSE without token | HTTPS tunnel | Missing | 401 PASS |
| SSE with bad token | HTTPS tunnel | Invalid | 403 PASS |
| Full handshake | HTTPS tunnel | Valid Bearer | PASS |
| list_assets | HTTPS tunnel | Valid Bearer | PASS |
| list_users | HTTPS tunnel | Valid Bearer | PASS |
| list_status_labels | HTTPS tunnel | Valid Bearer | PASS |
| Claude Desktop (direct SSE) | HTTPS tunnel | Header ignored | FAIL (known bug) |
| Claude Desktop (mcp-remote) | HTTPS tunnel | Valid Bearer | PASS |

---

## 8. Production Readiness Checklist

| Item | Status |
|------|--------|
| MCP SSE transport working end-to-end | Done |
| Bearer token authentication on all endpoints | Done |
| Secrets in .env (gitignored) | Done |
| .env.example with placeholders | Done |
| Security headers | Done |
| Rate limiting with correct client IP | Done |
| Session timeout cleanup | Done |
| Non-root containers | Done |
| Multi-stage Docker build | Done |
| Request size limits | Done |
| Audit logging | Done |
| Sanitized error responses | Done |
| Input validation on all tools | Done |
| Cloudflare Tunnel with TLS | Done |
| Claude Desktop config with mcp-remote | Done |
| Containers restart on failure (`unless-stopped`) | Done |
| Container health monitoring | Recommended |
| Log aggregation / alerting | Recommended |
| Docker secrets (instead of env vars) | Recommended |
| Dependency version pinning (exact) | Optional |

**Verdict: Production Ready** with the recommended items as future enhancements.

---

## 9. Troubleshooting

### "Cannot POST /register"
Claude Desktop is ignoring your auth header and trying OAuth. Use the `mcp-remote` proxy config (see [Section 6](#claude-desktop-configuration)).

### Port 3000 conflict
WSL's `wslrelay.exe` may occupy port 3000. The MCP server is mapped to host port 3100 (`3100:3000`). For local testing, use `localhost:3100`.

### Tunnel not connecting
Check `docker logs cloudflared-tunnel`. Verify the tunnel token in `.env` matches the token in Cloudflare Zero Trust dashboard.

### "Cannot connect to Snipe-IT server"
Ensure all containers are on the same Docker network. Verify with:
```bash
docker network inspect your-snipeit-network
```

### Session expired errors
Sessions timeout after 1 hour of inactivity. Reconnect by establishing a new SSE connection.

### Rebuilding after code changes
```bash
cd deployment
docker compose up -d --build
```
