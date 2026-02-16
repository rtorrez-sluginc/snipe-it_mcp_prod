# Security Review — Snipe-IT MCP Server

**Reviewer:** Claude Opus 4.6 (automated)
**Scope:** `src/index.ts` (stdio), `src-http/index.ts` (HTTP/SSE), `.mcp.json`, `.env.example`, `.gitignore`, `package.json`
**Overall Rating:** 8.5 / 10 — Production-ready with minor recommendations

---

## 1. Credential & Secret Management

| Check | Status | Notes |
|-------|--------|-------|
| API token loaded from env vars only | PASS | Both transports read `SNIPEIT_API_TOKEN` from `process.env` |
| `.env` excluded from git | PASS | `.gitignore` blocks `.env` and `.env.*` |
| `.env.example` contains no real secrets | PASS | Uses placeholder values only |
| `.mcp.json` uses env passthrough | PASS | Token passed via MCP `env` block (`${SNIPEIT_API_TOKEN}`), not in `args` |
| Token not logged or exposed | PASS | `console.error` calls log status codes and messages, never the token |
| Token length warning | PASS | `src/index.ts` warns if token < 20 chars (stdio only) |

**Finding — INFO:** The HTTP transport logs the Snipe-IT hostname at startup. This is acceptable for local dev logging but should be reviewed if stdout is captured by a log aggregator in production.

---

## 2. Transport Security

| Check | Status | Notes |
|-------|--------|-------|
| HTTPS enforcement | PASS | Both transports reject non-HTTPS URLs (localhost/127.0.0.1 exempt) |
| TLS certificate validation | PASS | `rejectUnauthorized: true` on both `https.Agent` instances |
| Request timeout | PASS | 30-second timeout on all Axios requests |
| User-Agent header | PASS | Identifies as `snipeit-mcp-server/1.0.0` |

---

## 3. Input Validation

| Check | Status | Notes |
|-------|--------|-------|
| ID validation (positive integer) | PASS | `validateId()` rejects non-integers and values < 1 |
| Limit bounds (1-500) | PASS | `validateLimit()` enforces range |
| Offset bounds (non-negative) | PASS | `validateOffset()` rejects negatives |
| String length caps | PASS | All string inputs capped (255 default, 500 for search, 2000 for notes) |
| Enum validation | PASS | `checkout_to_type` validated against allowlist |
| Date format validation | PASS | Regex enforces `YYYY-MM-DD` pattern (stdio) |
| Search query sanitization | PASS | Trimmed and length-limited |

---

## 4. Error Handling & Information Disclosure

| Check | Status | Notes |
|-------|--------|-------|
| Sanitized error responses (stdio) | PASS | `ErrorHandler.sanitizeError()` returns generic messages for all HTTP status codes |
| No stack traces to clients | PASS | Full errors logged server-side only |
| Health endpoint info leak | PASS | URL removed from health response |
| 401/403 handling | PASS | Generic auth failure messages, no token hints |

---

## 5. HTTP Transport Security (SSE)

| Check | Status | Notes |
|-------|--------|-------|
| Bearer authentication on SSE endpoint | PASS | Implemented via `authenticateBearer` middleware |
| CORS not configured | PASS | No `cors()` middleware = browser same-origin policy applies (default deny) |
| Rate limiting | PASS | 30 SSE conn/min, 60 msg/min per IP |
| Request body parsing | PASS | `express.json({ limit: "10kb" })` on `/message` route |

---

## 6. Dependency Security

| Check | Status | Notes |
|-------|--------|-------|
| `npm audit` | PASS | 0 vulnerabilities |
| Dependency count | PASS | 3 runtime deps: `@modelcontextprotocol/sdk`, `axios`, `express` |
| Lock file committed | PASS | `package-lock.json` in repo |
| No unnecessary deps | PASS | Minimal dependency tree |

---

## 7. Git & Repository Security

| Check | Status | Notes |
|-------|--------|-------|
| `.env` gitignored | PASS | `.env` and `.env.*` patterns |
| `node_modules/` gitignored | PASS | |
| `build/` output gitignored | PASS | Both `build/` and `build-http/` |
| No secrets in committed files | PASS | Verified all tracked files |

---

## 8. Code Quality & Security Patterns

| Check | Status | Notes |
|-------|--------|-------|
| No `eval()` or `Function()` | PASS | |
| No dynamic `require()` | PASS | ES modules with static imports |
| No shell command execution | PASS | No `child_process` usage |
| No file system access | PASS | No `fs` module usage |
| API paths use validated IDs only | PASS | Template literals use validated integers — no injection possible |
| No prototype pollution vectors | PASS | Input objects destructured safely |

---

## Conclusion

The Snipe-IT MCP server demonstrates strong security practices:
- Proper credential handling via environment variables and MCP env passthrough
- Comprehensive input validation preventing injection attacks
- TLS enforcement with certificate validation
- Sanitized error messages that don't leak internals
- Clean dependency tree with zero known vulnerabilities
- Proper `.gitignore` protecting secrets and build artifacts
- Bearer token authentication on HTTP endpoints
- Rate limiting and session management
