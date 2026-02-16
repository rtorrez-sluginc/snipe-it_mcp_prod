# Architecture Overview

**Technical architecture of the Snipe-IT MCP Server**

---

## High-Level Architecture

### System Components

```
+-------------------------------------------------------------+
|                        User Layer                            |
|  +--------------+              +--------------+             |
|  |Claude Desktop|              |  Web Browser |             |
|  |   (stdio)    |              |   (HTTP)     |             |
|  +------+-------+              +------+-------+             |
+---------+------------------------------+--------------------+
          |                              |
          | stdio                        | HTTPS
          |                              |
+---------+------------------------------+--------------------+
|         |     Application Layer        |                     |
|  +------v-------+            +---------v---------+          |
|  | stdio Server |            |   HTTP Server     |          |
|  |  (Local)     |            |   (SSE/Express)   |          |
|  +------+-------+            +---------+---------+          |
|         |                              |                     |
|         | MCP Protocol                 | MCP Protocol        |
|         |                              |                     |
|  +------v-------------------------------v---------+          |
|  |         MCP Server Core                       |          |
|  |  - Input Validation                           |          |
|  |  - Error Handling                             |          |
|  |  - Request Processing                         |          |
|  +------+--------------------------------------------+          |
+---------+---------------------------------------------------+
          |
          | HTTPS + API Token
          |
+---------v---------------------------------------------------+
|                    Integration Layer                         |
|  +----------------------------------------------+            |
|  |         Snipe-IT Client (Axios)              |            |
|  |  - HTTP Client                               |            |
|  |  - SSL Validation                            |            |
|  |  - Request Timeout                           |            |
|  |  - Authentication                            |            |
|  +------+---------------------------------------+            |
+---------+--------------------------------------------------+
          |
          | HTTPS REST API
          |
+---------v--------------------------------------------------+
|                    External Services                        |
|  +----------------------------------------------+           |
|  |           Snipe-IT API                       |           |
|  |  - Asset Management                          |           |
|  |  - User Management                           |           |
|  |  - Reference Data                            |           |
|  +----------------------------------------------+           |
+------------------------------------------------------------+
```

---

## Component Details

### 1. stdio Server (`src/index.ts`)

**Purpose:** Local development, personal use

**Technology:**
- Node.js + TypeScript
- MCP SDK (stdio transport)
- Axios for HTTP client

**Communication:**
- Input: stdin (from Claude Desktop)
- Output: stdout (to Claude Desktop)
- Protocol: JSON-RPC over stdio

**Usage:**
```bash
node build/index.js
```

**Pros:**
- Simple setup
- No network exposure
- Fast (no network overhead)

**Cons:**
- Single user only
- Must run locally
- No remote access

---

### 2. HTTP Server (`src-http/index.ts`)

**Purpose:** Production deployment, team access

**Technology:**
- Node.js + TypeScript
- Express.js (HTTP framework)
- MCP SDK (SSE transport)
- Axios for HTTP client

**Communication:**
- Input: HTTP POST to `/message`
- Output: Server-Sent Events (SSE) on `/sse`
- Protocol: MCP over HTTP/SSE

**Endpoints:**
```
GET  /health        - Health check
GET  /sse           - SSE endpoint (MCP)
POST /message       - Message endpoint (MCP)
```

**Usage:**
```bash
npm run start:http
# Listens on http://localhost:3000
```

**Pros:**
- Multiple users
- Remote access
- Compatible with Cloudflare Tunnel

**Cons:**
- Requires port 3000 open (locally)
- More complex setup

---

### 3. MCP Server Core

**Shared between stdio and HTTP versions**

**Components:**

#### a. Configuration Validation
```typescript
class ConfigValidator {
  static validate(): { url: string; token: string }
  // Validates environment variables
  // Enforces HTTPS
  // Validates URL format
}
```

#### b. Input Validators
```typescript
class InputValidator {
  static validateId(id: any): number
  static validateLimit(limit: any): number
  static validateOffset(offset: any): number
  static validateString(value: any): string
  static validateEnum(value: any): T
  static validateDate(value: any): string
}
```

**Validation Rules:**
- IDs: Must be positive integers
- Limits: 1-500
- Offsets: >= 0
- Strings: Max 500 characters
- Enums: Strict type checking
- Dates: YYYY-MM-DD format

#### c. Error Handler
```typescript
class ErrorHandler {
  static sanitizeError(error: any): string
  // Sanitizes error messages
  // Prevents information disclosure
  // Returns user-friendly messages
}
```

**HTTP Status Code Mapping:**
- 401 -> "Authentication failed"
- 403 -> "Permission denied"
- 404 -> "Resource not found"
- 422 -> "Validation error"
- 429 -> "Rate limit exceeded"
- 500+ -> "Server error"

#### d. Snipe-IT Client
```typescript
class SnipeITClient {
  private client: AxiosInstance

  // Asset operations
  async listAssets(params): Promise<any>
  async getAsset(id): Promise<any>
  async createAsset(data): Promise<any>
  async checkoutAsset(id, data): Promise<any>
  async checkinAsset(id, data): Promise<any>

  // User operations
  async listUsers(params): Promise<any>
  async getUser(id): Promise<any>

  // Reference data
  async listModels(params): Promise<any>
  async listCategories(params): Promise<any>
  async listLocations(params): Promise<any>
  async listStatusLabels(): Promise<any>
  async listManufacturers(params): Promise<any>
  async listSuppliers(params): Promise<any>
}
```

**Configuration:**
```typescript
{
  baseURL: process.env.SNIPEIT_URL,
  timeout: 30000,  // 30 seconds
  httpsAgent: new https.Agent({
    rejectUnauthorized: true  // Enforce SSL
  }),
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json"
  }
}
```

---

## Cloudflare Architecture

### Production Deployment with Cloudflare

```
+--------------+
|Claude Desktop|
+------+-------+
       | HTTPS
       |
+------v--------------------------------------------------+
|         Cloudflare Edge Network                          |
|                                                          |
|  +------------------------------------------+           |
|  |     Cloudflare Access (SSO/MFA)          |           |
|  |  - Authentication                        |           |
|  |  - Authorization                         |           |
|  |  - Session Management                    |           |
|  +------+-----------------------------------+           |
|         |                                               |
|  +------v-----------------------------------+           |
|  |     Cloudflare WAF + DDoS                |           |
|  |  - Attack Prevention                     |           |
|  |  - Rate Limiting                         |           |
|  |  - Bot Detection                         |           |
|  +------+-----------------------------------+           |
|         |                                               |
|  +------v-----------------------------------+           |
|  |     Cloudflare Tunnel                    |           |
|  |  - Encrypted Connection                  |           |
|  |  - No Open Ports                         |           |
|  +------+-----------------------------------+           |
+---------+-----------------------------------------------+
          | Encrypted Tunnel
          |
+---------v----------------------------------------------+
|  Your Infrastructure (On-Prem or Cloud)                |
|                                                         |
|  +----------------------------------------+            |
|  |  cloudflared (Tunnel Client)           |            |
|  +--------+-------------------------------+            |
|           | localhost:3000                               |
|  +--------v-------------------------------+            |
|  |  MCP Server (HTTP)                     |            |
|  +--------+-------------------------------+            |
|           | HTTPS                                       |
|  +--------v-------------------------------+            |
|  |  Snipe-IT API                          |            |
|  +----------------------------------------+            |
+---------------------------------------------------------+
```

### Security Layers

1. **TLS Encryption** (Edge to Client)
2. **Cloudflare Access** (Authentication)
3. **Encrypted Tunnel** (Edge to Origin)
4. **Local-only Service** (No public ports)
5. **Input Validation** (Application layer)
6. **SSL Verification** (To Snipe-IT)

---

## Request Flow

### stdio Version Flow

```
1. User types query in Claude Desktop
   |
2. Claude Desktop sends MCP request via stdin
   |
3. stdio Server receives JSON-RPC message
   |
4. Server parses request, validates inputs
   |
5. Server calls appropriate tool handler
   |
6. Tool handler makes API call to Snipe-IT
   |
7. Snipe-IT returns JSON response
   |
8. Server formats response, sanitizes errors
   |
9. Server sends MCP response via stdout
   |
10. Claude Desktop displays result to user
```

**Latency:** 100-500ms (depending on Snipe-IT)

---

### HTTP Version Flow

```
1. User visits https://mcp.yourdomain.com
   |
2. Cloudflare Access checks authentication
   | (if authenticated)
3. Request routes through Cloudflare Tunnel
   |
4. cloudflared forwards to localhost:3000
   |
5. Express receives HTTP request on /sse
   |
6. SSE connection established
   |
7. Client sends message via POST /message
   |
8. Server processes request (same as stdio)
   |
9. Server sends response via SSE
   |
10. Client receives and displays result
```

**Latency:** 200-800ms (adds network + auth overhead)

---

## Security Architecture

### Defense in Depth Layers

```
+------------------------------------------------+
| Layer 1: Network (Cloudflare)                 |
|  - TLS 1.3 encryption                         |
|  - DDoS protection                            |
|  - WAF rules                                  |
+--------+---------------------------------------+
         |
+--------v---------------------------------------+
| Layer 2: Access Control (Cloudflare Access)   |
|  - SSO/SAML authentication                    |
|  - MFA enforcement                            |
|  - Session management                         |
|  - Device posture checks                      |
+--------+---------------------------------------+
         |
+--------v---------------------------------------+
| Layer 3: Application (MCP Server)             |
|  - HTTPS enforcement                          |
|  - Request timeouts                           |
|  - SSL certificate validation                 |
+--------+---------------------------------------+
         |
+--------v---------------------------------------+
| Layer 4: Input Validation                     |
|  - Type checking                              |
|  - Bounds validation                          |
|  - String length limits                       |
|  - Enum validation                            |
+--------+---------------------------------------+
         |
+--------v---------------------------------------+
| Layer 5: Error Handling                       |
|  - Error sanitization                         |
|  - No information disclosure                  |
|  - User-friendly messages                     |
+------------------------------------------------+
```

---

## Data Flow

### Asset Query Example

```
User Query: "List all MacBook Pros"
                 |
                 v
         +--------------+
         |    Claude    |
         |   (LLM)      |
         +------+-------+
                |
                | Interprets as:
                | list_assets(search="MacBook Pro")
                |
                v
         +--------------+
         | MCP Server   |
         |              |
         | 1. Validate  |
         | 2. Sanitize  |
         +------+-------+
                |
                | GET /api/v1/hardware?
                |     search=MacBook%20Pro
                |     limit=50
                v
         +--------------+
         |  Snipe-IT    |
         |   API        |
         +------+-------+
                |
                | Returns:
                | {
                |   "rows": [...],
                |   "total": 15
                | }
                |
                v
         +--------------+
         | MCP Server   |
         |              |
         | 1. Parse     |
         | 2. Format    |
         +------+-------+
                |
                | Returns formatted
                | JSON to Claude
                |
                v
         +--------------+
         |    Claude    |
         |              |
         | Formats as   |
         | natural text |
         +------+-------+
                |
                v
    "I found 15 MacBook Pros:
     1. MacBook Pro 16" (2023) - Assigned to Alice
     2. MacBook Pro 14" (2023) - Available
     ..."
```

---

## Technology Stack

### Core Technologies

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Runtime | Node.js | 20+ | JavaScript execution |
| Language | TypeScript | 5.3+ | Type-safe development |
| MCP SDK | @modelcontextprotocol/sdk | 1.0.4+ | MCP protocol |
| HTTP Framework | Express.js | 4.18+ | HTTP server (HTTP version) |
| HTTP Client | Axios | 1.7.0+ | Snipe-IT API calls |
| SSL/TLS | Node HTTPS | Built-in | Secure connections |

### Development Tools

| Tool | Purpose |
|------|---------|
| npm | Package management |
| tsc | TypeScript compilation |
| Git | Version control |
| VS Code | Development (recommended) |

### Infrastructure

| Component | Technology |
|-----------|-----------|
| Tunnel | Cloudflare Tunnel |
| Auth | Cloudflare Access |
| DNS | Cloudflare DNS |
| WAF | Cloudflare WAF |
| Process Manager | launchd (macOS) / systemd (Linux) |

---

## Scalability

### Current Design

**Capacity:**
- stdio version: 1 user
- HTTP version: 100+ concurrent users (with proper hosting)

**Bottlenecks:**
1. Snipe-IT API rate limits
2. Single Node.js process
3. Network latency

### Scaling Options

**Horizontal Scaling:**
```
          +--------------+
          |  Cloudflare  |
          |    Tunnel    |
          +------+-------+
                 |
      +----------+----------+
      |          |          |
+-----v---+ +---v----+ +--v-----+
| Server 1| |Server 2| |Server 3|
+---------+ +--------+ +--------+
      |          |          |
      +----------+----------+
                 |
           +-----v------+
           |  Snipe-IT  |
           +------------+
```

**Load Balancing:**
- Cloudflare Load Balancer
- Round-robin DNS
- Multiple tunnel instances

**Caching:**
- Redis for frequent queries
- TTL-based invalidation
- Reduce Snipe-IT load

---

## Deployment Models

### Model 1: Developer Laptop (stdio)

```
+--------------------------------+
|  Developer Laptop              |
|  +--------------------------+  |
|  |   Claude Desktop         |  |
|  +----------+---------------+  |
|             | stdio            |
|  +----------v---------------+  |
|  |   MCP Server (stdio)     |  |
|  +----------+---------------+  |
|             | HTTPS            |
|  +----------v---------------+  |
|  |   Internet               |  |
|  +----------+---------------+  |
+-------------+------------------+
              |
     +--------v--------+
     |   Snipe-IT      |
     |   (Cloud)       |
     +-----------------+
```

**Pros:** Simple, free
**Cons:** Single user, local only

---

### Model 2: Local Server + Cloudflare

```
+--------------------------------+
|  Your Office/Home              |
|  +--------------------------+  |
|  |   MCP Server (HTTP)      |  |
|  |   localhost:3000         |  |
|  +----------+---------------+  |
|             |                  |
|  +----------v---------------+  |
|  |   cloudflared            |  |
|  +----------+---------------+  |
+-------------+------------------+
              | Tunnel
     +--------v--------+
     |  Cloudflare     |
     |  Edge Network   |
     +--------+--------+
              | HTTPS
     +--------v--------+
     |  Team Members   |
     |  (Worldwide)    |
     +-----------------+
```

**Pros:** Global access, low cost
**Cons:** Server must stay on

---

### Model 3: Cloud VM + Cloudflare

```
     +-----------------+
     |  AWS/GCP/Azure  |
     |  +-----------+  |
     |  | MCP Server|  |
     |  +-----+-----+  |
     |        |        |
     |  +-----v-----+  |
     |  |cloudflared|  |
     |  +-----+-----+  |
     +--------+--------+
              | Tunnel
     +--------v--------+
     |  Cloudflare     |
     +--------+--------+
              |
     +--------v--------+
     |  Team Members   |
     +-----------------+
```

**Pros:** 24/7 availability, scalable
**Cons:** Monthly costs ($5-10/month)

---

## File Structure

```
mcp-server/
├── src/                    # stdio version source
│   └── index.ts           # Main server (stdio)
├── src-http/              # HTTP version source
│   └── index.ts           # Main server (HTTP/SSE)
├── build/                 # Compiled stdio version
│   └── index.js
├── build-http/            # Compiled HTTP version
│   └── index.js
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript config (stdio)
├── tsconfig.http.json     # TypeScript config (HTTP)
└── .env.example           # Environment template
```

---

## Build Process

```
Source Code (TypeScript)
         |
         v
    TypeScript Compiler (tsc)
         |
         +-->  stdio version
         |    └── build/index.js
         |
         └-->  HTTP version
              └── build-http/index.js
```

**Commands:**
```bash
npm run build        # Build stdio version
npm run build:http   # Build HTTP version
npm run build:all    # Build both
```

---

## Design Decisions

### Why TypeScript?

- **Type safety** - Catch errors at compile time
- **Better IDE support** - Autocomplete, refactoring
- **Maintainability** - Self-documenting code

### Why Two Versions (stdio + HTTP)?

- **stdio** - Simple local use, no network needed
- **HTTP** - Production deployment, team access
- **Shared core** - Same validation and logic

### Why Cloudflare Tunnel?

- **No open ports** - Better security
- **Built-in DDoS** - Protection included
- **Global edge** - Low latency worldwide
- **Managed service** - Less infrastructure to maintain

### Why Axios over Fetch?

- **Timeout support** - Built-in request timeouts
- **Interceptors** - Easy to add auth headers
- **Better error handling** - More detailed errors
- **Node.js compatibility** - Works in all Node versions

---

## Performance Characteristics

### Response Times

| Operation | Average | 95th Percentile |
|-----------|---------|-----------------|
| List assets (50) | 200ms | 400ms |
| Get asset | 100ms | 200ms |
| Create asset | 300ms | 500ms |
| Checkout asset | 250ms | 450ms |

*Measured with local Snipe-IT instance on gigabit network*

### Resource Usage

| Metric | stdio | HTTP |
|--------|-------|------|
| Memory | ~50MB | ~70MB |
| CPU (idle) | <1% | <1% |
| CPU (active) | 5-10% | 10-15% |

*Tested on MacBook Pro M1*

---

**Last Updated:** 2025-02-13
**Version:** 1.0.0
