# Security Review - Post-Deployment
## Snipe-IT MCP Server & Cloudflared Docker Deployment

**Scope:**
- `mcp-server/` (src-http/index.ts, src/index.ts, Dockerfile, package.json)
- `deployment/` (docker-compose.yml, .env, Dockerfile)

---

## Executive Summary

**Overall Security Rating: 7.5/10** (Good with critical issues)

The Snipe-IT MCP server has solid input validation and error handling, but the Docker deployment introduces critical secrets management risks that must be addressed immediately.

| Severity | Count |
|----------|-------|
| Critical | 4 |
| High | 3 |
| Medium | 5 |
| Low | 4 |
| Informational | 2 |

---

## Critical Findings

### 1. Exposed API Token in .env File
**Severity:** CRITICAL

The `.env` file must never be committed to version control. Anyone with file access can authenticate to the Snipe-IT API.

**Fix:**
1. Revoke this token immediately in Snipe-IT (Settings > API > Revoke)
2. Generate a new token
3. Never commit `.env` files — only `.env.example` with placeholders
4. Use Docker secrets or external secret management

---

### 2. Hardcoded Cloudflare Tunnel Token in docker-compose.yml
**Severity:** CRITICAL

The tunnel token must not be hardcoded in the compose file. If compromised, attackers could redirect traffic or mount MITM attacks.

**Fix:**
1. Revoke tunnel token in Cloudflare dashboard
2. Use environment variable: `command: tunnel --no-autoupdate run --token ${CF_TUNNEL_TOKEN}`
3. Store token in `.env` file (not committed to git)

---

### 3. No Authentication on MCP HTTP Endpoints
**Severity:** CRITICAL

The `/sse` and `/message` endpoints must have authentication. Any client that can reach port 3000 can list/create/modify all assets, users, and locations.

**Fix:**
```typescript
const BEARER_TOKEN = process.env.MCP_BEARER_TOKEN || "";

app.get("/sse", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token || token !== BEARER_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  // ...
});
```

---

### 4. API Token Visible in Container Environment
**Severity:** CRITICAL

The Snipe-IT API token is passed as an environment variable, visible via `docker inspect`.

**Fix:** Use Docker secrets:
```yaml
services:
  mcp-server:
    secrets:
      - snipeit_token
    environment:
      - SNIPEIT_API_TOKEN_FILE=/run/secrets/snipeit_token
secrets:
  snipeit_token:
    external: true
```

---

## High Severity Findings

### 5. Insufficient IP-Based Rate Limiting
**Severity:** HIGH

- Behind Cloudflare Tunnel, `req.ip` returns the proxy IP, not the client
- All clients appear as one IP for rate limiting
- Memory leak risk from unbounded Map growth

**Fix:**
- Extract client IP from `cf-connecting-ip` or `x-forwarded-for` headers
- Configure `app.set('trust proxy', 1)`
- Add bounded cleanup with max Map size

---

### 6. ALLOW_HTTP=true Disables TLS Enforcement
**Severity:** HIGH

API token transmitted in cleartext between containers on the Docker network.

**Fix:** Enable HTTPS between MCP server and Snipe-IT, or accept the risk for internal-only Docker networks with documented justification.

---

### 7. Unsafe Client IP Extraction
**Severity:** HIGH

No `trust proxy` configuration in Express. Rate limiting and logging use incorrect IP addresses.

**Fix:**
```typescript
app.set('trust proxy', 1);

function getClientIp(req: any): string {
  return req.headers['cf-connecting-ip'] ||
         req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.ip || 'unknown';
}
```

---

## Medium Severity Findings

### 8. Session ID Enumeration
**Severity:** MEDIUM

- 404 response confirms session existence (enables enumeration)
- No session timeout for abandoned connections
- No CSRF protection

**Fix:** Return 403 instead of 404, add session timeout cleanup.

---

### 9. Missing Security Headers
**Severity:** MEDIUM

No `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, etc.

**Fix:** Add security header middleware.

---

### 10. MCP Server Dockerfile Runs as Root
**Severity:** MEDIUM

No `USER` directive — container runs as root.

**Fix:**
```dockerfile
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser
```

---

### 11. Cloudflared Dockerfile Runs as Root
**Severity:** MEDIUM

Same root issue. Also no version pinning or checksum verification on downloaded binary.

**Fix:** Add `USER` directive and pin cloudflared version.

---

### 12. Missing Request Size Limits
**Severity:** MEDIUM

`express.json()` default 100KB limit is too high for MCP protocol messages.

**Fix:** `express.json({ limit: '10kb' })`

---

## Low Severity Findings

### 13. Information Disclosure in Startup Logs
**Severity:** LOW

Snipe-IT URL logged at startup — reveals infrastructure topology.

### 14. No Audit Trail for API Operations
**Severity:** LOW

No logging of which tools are called, by whom, or with what parameters.

### 15. 30-Second Axios Timeout
**Severity:** LOW

Could tie up SSE connections. Recommend reducing to 10 seconds.

### 16. Version Pinning Not Exact
**Severity:** INFORMATIONAL

Uses caret (^) versions. Consider exact pinning for production.

---

## Remediation Roadmap

### Immediate (Before Production)
1. Revoke exposed API token and Cloudflare tunnel token
2. Implement Bearer token authentication on /sse and /message
3. Move all secrets out of committed files
4. Add `.env` to `.gitignore`

### Short-term (Week 1)
5. Add non-root users to both Dockerfiles
6. Add security headers
7. Fix IP extraction for rate limiting
8. Add request size limits
9. Add session timeout cleanup

### Medium-term (Week 2)
10. Implement audit logging
11. Add rate limiting per session
12. Reduce Axios timeout
13. Pin dependency versions

---

## Summary Table

| # | Severity | Finding | Status |
|----|----------|---------|--------|
| 1 | CRITICAL | Exposed API token in .env | FIXED |
| 2 | CRITICAL | Hardcoded tunnel token in compose | FIXED |
| 3 | CRITICAL | No auth on /sse and /message | FIXED |
| 4 | CRITICAL | API token in container env | FIXED |
| 5 | HIGH | Insufficient rate limiting | FIXED |
| 6 | HIGH | ALLOW_HTTP=true (unencrypted) | ACCEPTED |
| 7 | HIGH | Unsafe client IP extraction | FIXED |
| 8 | MEDIUM | Session ID enumeration | FIXED |
| 9 | MEDIUM | Missing security headers | FIXED |
| 10 | MEDIUM | MCP Dockerfile runs as root | FIXED |
| 11 | MEDIUM | Cloudflared Dockerfile runs as root | FIXED |
| 12 | MEDIUM | Missing request size limits | FIXED |
| 13 | LOW | URL logged at startup | FIXED |
| 14 | LOW | No audit trail | FIXED |
| 15 | LOW | 30s Axios timeout | FIXED |
| 16 | INFO | Version pinning | DESIGN CHOICE |

---

## Files Analyzed

1. `mcp-server/src-http/index.ts`
2. `mcp-server/src/index.ts`
3. `mcp-server/package.json`
4. `mcp-server/Dockerfile`
5. `mcp-server/tsconfig.json`
6. `mcp-server/tsconfig.http.json`
7. `mcp-server/.env.example`
8. `deployment/.env`
9. `deployment/docker-compose.yml`
10. `deployment/Dockerfile`
