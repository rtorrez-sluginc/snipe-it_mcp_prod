#!/usr/bin/env node
/**
 * Snipe-IT MCP Server - Streamable HTTP Version
 *
 * This version uses the Streamable HTTP transport (MCP spec recommended)
 * instead of the deprecated SSE transport, compatible with Cloudflare Tunnel.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
import axios, { AxiosInstance } from "axios";
import express, { Request, Response, NextFunction } from "express";
import https from "https";

// ============================================================================
// CONFIGURATION
// ============================================================================

const SNIPEIT_URL = process.env.SNIPEIT_URL || "";
const SNIPEIT_API_TOKEN = process.env.SNIPEIT_API_TOKEN || "";
const PORT = parseInt(process.env.PORT || "3000");
const MCP_BEARER_TOKEN = process.env.MCP_BEARER_TOKEN || "";
const SESSION_TIMEOUT_MS = parseInt(process.env.SESSION_TIMEOUT_MS || "3600000"); // 1 hour

if (!SNIPEIT_URL || !SNIPEIT_API_TOKEN) {
  console.error("Error: SNIPEIT_URL and SNIPEIT_API_TOKEN environment variables are required");
  process.exit(1);
}

// Enforce HTTPS (allow localhost and private/internal hostnames for Docker)
const parsedUrl = new URL(SNIPEIT_URL);
const isPrivateHost = ["localhost", "127.0.0.1"].includes(parsedUrl.hostname) ||
  parsedUrl.hostname.endsWith(".local") ||
  /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(parsedUrl.hostname) ||
  process.env.ALLOW_HTTP === "true";
if (parsedUrl.protocol !== "https:" && !isPrivateHost) {
  console.error("Error: SNIPEIT_URL must use HTTPS protocol (localhost and private networks are exempt, or set ALLOW_HTTP=true)");
  process.exit(1);
}

// ============================================================================
// INPUT VALIDATION
// ============================================================================

class InputValidator {
  static validateId(id: any, fieldName: string = "id"): number {
    const num = Number(id);
    if (!Number.isInteger(num) || num < 1) {
      throw new Error(`${fieldName} must be a positive integer`);
    }
    return num;
  }

  static validateLimit(limit: any): number {
    if (limit === undefined) return 50;
    const num = Number(limit);
    if (!Number.isInteger(num) || num < 1 || num > 500) {
      throw new Error("Limit must be between 1 and 500");
    }
    return num;
  }

  static validateOffset(offset: any): number {
    if (offset === undefined) return 0;
    const num = Number(offset);
    if (!Number.isInteger(num) || num < 0) {
      throw new Error("Offset must be non-negative");
    }
    return num;
  }

  static validateString(value: any, fieldName: string, maxLength: number = 255): string {
    if (value === undefined) return "";
    if (typeof value !== "string") {
      throw new Error(`${fieldName} must be a string`);
    }
    if (value.length > maxLength) {
      throw new Error(`${fieldName} too long (max ${maxLength} characters)`);
    }
    return value.trim();
  }

  static validateEnum<T extends string>(value: any, allowedValues: T[], fieldName: string): T {
    if (!allowedValues.includes(value)) {
      throw new Error(`${fieldName} must be one of: ${allowedValues.join(", ")}`);
    }
    return value as T;
  }

  static validateDate(value: any, fieldName: string): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== "string") {
      throw new Error(`${fieldName} must be a string in YYYY-MM-DD format`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new Error(`${fieldName} must be in YYYY-MM-DD format`);
    }
    return value;
  }
}

// ============================================================================
// ERROR HANDLER
// ============================================================================

class ErrorHandler {
  static sanitizeError(error: any): string {
    // Log full error server-side for debugging
    console.error("API Error:", {
      message: error.message,
      status: error.response?.status,
      timestamp: new Date().toISOString(),
    });

    // Return user-friendly messages without sensitive details
    if (error.response?.status === 401) {
      return "Authentication failed. Please check your API token configuration.";
    }
    if (error.response?.status === 403) {
      return "Permission denied. You may not have access to perform this operation.";
    }
    if (error.response?.status === 404) {
      return "Resource not found. The requested item may not exist.";
    }
    if (error.response?.status === 422) {
      return "Validation error. Please check your input parameters.";
    }
    if (error.response?.status === 429) {
      return "Rate limit exceeded. Please try again in a few moments.";
    }
    if (error.response?.status >= 500) {
      return "Snipe-IT server error. Please try again later or contact your administrator.";
    }
    if (error.code === "ECONNREFUSED") {
      return "Cannot connect to Snipe-IT server. Please check the server URL.";
    }
    if (error.code === "ETIMEDOUT") {
      return "Request timed out. The server may be slow or unreachable.";
    }

    // Validation errors from our validators
    if (error.message && !error.response) {
      return `Validation error: ${error.message}`;
    }

    // Generic error for anything else
    return "An unexpected error occurred while communicating with Snipe-IT.";
  }
}

// ============================================================================
// SNIPE-IT CLIENT
// ============================================================================

class SnipeITClient {
  private client: AxiosInstance;

  constructor(url: string, token: string) {
    this.client = axios.create({
      baseURL: url,
      timeout: 10000,
      httpsAgent: new https.Agent({
        rejectUnauthorized: true,
      }),
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "snipeit-mcp-server-http/1.0.0",
      },
    });
  }

  async listAssets(args: any) {
    const params = new URLSearchParams({
      limit: String(InputValidator.validateLimit(args.limit)),
      offset: String(InputValidator.validateOffset(args.offset)),
    });
    if (args.search) params.append("search", InputValidator.validateString(args.search, "search", 500));
    if (args.status) params.append("status", InputValidator.validateString(args.status, "status", 50));
    const response = await this.client.get(`/api/v1/hardware?${params}`);
    return response.data;
  }

  async getAsset(args: any) {
    const id = InputValidator.validateId(args.asset_id, "asset_id");
    const response = await this.client.get(`/api/v1/hardware/${id}`);
    return response.data;
  }

  async createAsset(args: any) {
    const data: Record<string, any> = {
      model_id: InputValidator.validateId(args.model_id, "model_id"),
      status_id: InputValidator.validateId(args.status_id, "status_id"),
    };
    if (args.asset_tag) data["asset_tag"] = InputValidator.validateString(args.asset_tag, "asset_tag");
    if (args.name) data["name"] = InputValidator.validateString(args.name, "name");
    if (args.serial) data["serial"] = InputValidator.validateString(args.serial, "serial");
    if (args.purchase_date) data["purchase_date"] = InputValidator.validateDate(args.purchase_date, "purchase_date");
    if (args.purchase_cost) data["purchase_cost"] = InputValidator.validateString(args.purchase_cost, "purchase_cost", 50);
    if (args.supplier_id) data["supplier_id"] = InputValidator.validateId(args.supplier_id, "supplier_id");
    if (args.notes) data["notes"] = InputValidator.validateString(args.notes, "notes", 2000);
    const response = await this.client.post("/api/v1/hardware", data);
    return response.data;
  }

  async checkoutAsset(args: any) {
    const assetId = InputValidator.validateId(args.asset_id, "asset_id");
    const checkoutType = InputValidator.validateEnum(args.checkout_to_type, ["user", "asset", "location"], "checkout_to_type");
    const data: any = { checkout_to_type: checkoutType };
    if (checkoutType === "user" && args.assigned_user) {
      data.assigned_user = InputValidator.validateId(args.assigned_user, "assigned_user");
    } else if (checkoutType === "asset" && args.assigned_asset) {
      data.assigned_asset = InputValidator.validateId(args.assigned_asset, "assigned_asset");
    } else if (checkoutType === "location" && args.assigned_location) {
      data.assigned_location = InputValidator.validateId(args.assigned_location, "assigned_location");
    }
    if (args.note) data.note = InputValidator.validateString(args.note, "note", 1000);
    const response = await this.client.post(`/api/v1/hardware/${assetId}/checkout`, data);
    return response.data;
  }

  async checkinAsset(args: any) {
    const assetId = InputValidator.validateId(args.asset_id, "asset_id");
    const data: any = {};
    if (args.note) data.note = InputValidator.validateString(args.note, "note", 1000);
    if (args.location_id) data.location_id = InputValidator.validateId(args.location_id, "location_id");
    const response = await this.client.post(`/api/v1/hardware/${assetId}/checkin`, data);
    return response.data;
  }

  async listUsers(args: any) {
    const params = new URLSearchParams({
      limit: String(InputValidator.validateLimit(args.limit)),
      offset: String(InputValidator.validateOffset(args.offset)),
    });
    if (args.search) params.append("search", InputValidator.validateString(args.search, "search", 500));
    const response = await this.client.get(`/api/v1/users?${params}`);
    return response.data;
  }

  async getUser(args: any) {
    const id = InputValidator.validateId(args.user_id, "user_id");
    const response = await this.client.get(`/api/v1/users/${id}`);
    return response.data;
  }

  async listModels(args: any) {
    const params = new URLSearchParams({
      limit: String(InputValidator.validateLimit(args.limit)),
      offset: String(InputValidator.validateOffset(args.offset)),
    });
    if (args.search) params.append("search", InputValidator.validateString(args.search, "search", 500));
    const response = await this.client.get(`/api/v1/models?${params}`);
    return response.data;
  }

  async listCategories(args: any) {
    const params = new URLSearchParams({
      limit: String(InputValidator.validateLimit(args.limit)),
      offset: String(InputValidator.validateOffset(args.offset)),
    });
    const response = await this.client.get(`/api/v1/categories?${params}`);
    return response.data;
  }

  async listLocations(args: any) {
    const params = new URLSearchParams({
      limit: String(InputValidator.validateLimit(args.limit)),
      offset: String(InputValidator.validateOffset(args.offset)),
    });
    if (args.search) params.append("search", InputValidator.validateString(args.search, "search", 500));
    const response = await this.client.get(`/api/v1/locations?${params}`);
    return response.data;
  }

  async listStatusLabels() {
    const response = await this.client.get("/api/v1/statuslabels");
    return response.data;
  }

  async listManufacturers(args: any) {
    const params = new URLSearchParams({
      limit: String(InputValidator.validateLimit(args.limit)),
      offset: String(InputValidator.validateOffset(args.offset)),
    });
    const response = await this.client.get(`/api/v1/manufacturers?${params}`);
    return response.data;
  }

  async listSuppliers(args: any) {
    const params = new URLSearchParams({
      limit: String(InputValidator.validateLimit(args.limit)),
      offset: String(InputValidator.validateOffset(args.offset)),
    });
    const response = await this.client.get(`/api/v1/suppliers?${params}`);
    return response.data;
  }
}

const snipeit = new SnipeITClient(SNIPEIT_URL, SNIPEIT_API_TOKEN);

// ============================================================================
// TOOL DEFINITIONS (same as stdio version)
// ============================================================================

const tools: Tool[] = [
  {
    name: "list_assets",
    description: "List all assets in Snipe-IT with optional filtering",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of results to return (1-500, default: 50)" },
        offset: { type: "number", description: "Offset for pagination (must be >= 0)" },
        search: { type: "string", description: "Search query to filter assets" },
        status: { type: "string", description: "Filter by status (e.g., 'RTD', 'Deployed', 'Pending')" },
      },
    },
  },
  {
    name: "get_asset",
    description: "Get detailed information about a specific asset",
    inputSchema: {
      type: "object",
      properties: {
        asset_id: { type: "number", description: "The ID of the asset (must be positive integer)" },
      },
      required: ["asset_id"],
    },
  },
  {
    name: "create_asset",
    description: "Create a new asset in Snipe-IT",
    inputSchema: {
      type: "object",
      properties: {
        asset_tag: { type: "string", description: "Unique asset tag" },
        model_id: { type: "number", description: "Model ID (required)" },
        status_id: { type: "number", description: "Status label ID (required)" },
        name: { type: "string", description: "Asset name" },
        serial: { type: "string", description: "Serial number" },
        notes: { type: "string", description: "Notes about the asset" },
      },
      required: ["model_id", "status_id"],
    },
  },
  {
    name: "checkout_asset",
    description: "Check out an asset to a user, asset, or location",
    inputSchema: {
      type: "object",
      properties: {
        asset_id: { type: "number", description: "The ID of the asset to check out" },
        checkout_to_type: { type: "string", description: "Type: 'user', 'asset', or 'location'", enum: ["user", "asset", "location"] },
        assigned_user: { type: "number", description: "User ID (required if checking out to user)" },
        assigned_asset: { type: "number", description: "Asset ID (required if checking out to asset)" },
        assigned_location: { type: "number", description: "Location ID (required if checking out to location)" },
        note: { type: "string", description: "Checkout note" },
      },
      required: ["asset_id", "checkout_to_type"],
    },
  },
  {
    name: "checkin_asset",
    description: "Check in an asset",
    inputSchema: {
      type: "object",
      properties: {
        asset_id: { type: "number", description: "The ID of the asset to check in" },
        note: { type: "string", description: "Check-in note" },
        location_id: { type: "number", description: "Location ID to check in to" },
      },
      required: ["asset_id"],
    },
  },
  // ... (other tools same as stdio version)
  {
    name: "list_users",
    description: "List all users in Snipe-IT",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number" },
        offset: { type: "number" },
        search: { type: "string" },
      },
    },
  },
  {
    name: "get_user",
    description: "Get detailed information about a specific user",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "number" },
      },
      required: ["user_id"],
    },
  },
  {
    name: "list_models",
    description: "List all asset models",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number" },
        search: { type: "string" },
      },
    },
  },
  {
    name: "list_categories",
    description: "List all categories",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number" },
      },
    },
  },
  {
    name: "list_locations",
    description: "List all locations",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number" },
        search: { type: "string" },
      },
    },
  },
  {
    name: "list_status_labels",
    description: "List all status labels",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "list_manufacturers",
    description: "List all manufacturers",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number" },
      },
    },
  },
  {
    name: "list_suppliers",
    description: "List all suppliers",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number" },
      },
    },
  },
];

// ============================================================================
// RATE LIMITER
// ============================================================================

class RateLimiter {
  private requests = new Map<string, number[]>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60_000, maxRequests: number = 30) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    // Clean up stale entries every minute
    setInterval(() => this.cleanup(), 60_000);
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(key) ?? [];
    const recent = timestamps.filter((t) => now - t < this.windowMs);
    if (recent.length >= this.maxRequests) {
      this.requests.set(key, recent);
      return false;
    }
    recent.push(now);
    this.requests.set(key, recent);
    return true;
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of this.requests) {
      const recent = timestamps.filter((t) => now - t < this.windowMs);
      if (recent.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, recent);
      }
    }
    // Evict oldest entries if map grows too large (DoS protection)
    const maxEntries = 10000;
    if (this.requests.size > maxEntries) {
      const keysToDelete = Array.from(this.requests.keys()).slice(0, this.requests.size - maxEntries);
      for (const key of keysToDelete) {
        this.requests.delete(key);
      }
    }
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function getClientIp(req: Request): string {
  // Prefer Cloudflare header, then X-Forwarded-For, then req.ip
  const cfIp = req.headers["cf-connecting-ip"];
  if (typeof cfIp === "string") return cfIp;
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string") return xff.split(",")[0].trim();
  return req.ip || "unknown";
}

function authenticateBearer(req: Request, res: Response, next: NextFunction): void {
  // Health endpoint is public
  if (!MCP_BEARER_TOKEN) {
    // No token configured — allow all (dev mode)
    next();
    return;
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: Bearer token required" });
    return;
  }
  const token = authHeader.slice(7);
  if (token !== MCP_BEARER_TOKEN) {
    res.status(403).json({ error: "Forbidden: Invalid token" });
    return;
  }
  next();
}

// 60 requests per minute per IP
const rateLimiter = new RateLimiter(60_000, 60);

// ============================================================================
// EXPRESS APP & STREAMABLE HTTP SETUP
// ============================================================================

const app = express();

// Trust proxy (Cloudflare Tunnel)
app.set("trust proxy", 1);

// Security headers
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// Health check endpoint (public, no auth)
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "2.0.0",
  });
});

// Track active sessions with metadata
interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  server: Server;
  createdAt: number;
  lastActivity: number;
  clientIp: string;
}
const sessions = new Map<string, SessionEntry>();

// Clean up expired sessions every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActivity > SESSION_TIMEOUT_MS) {
      console.log(`Session expired: ${id} (idle ${Math.round((now - session.lastActivity) / 1000)}s)`);
      session.transport.close();
      sessions.delete(id);
    }
  }
}, 60_000);

/**
 * Create a new MCP Server instance with tool handlers wired up.
 */
function createMcpServer(clientIp: string): Server {
  const server = new Server(
    {
      name: "snipeit-mcp-server-http",
      version: "2.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const startTime = Date.now();

    try {
      let result: any;

      switch (name) {
        case "list_assets":
          result = await snipeit.listAssets(args);
          break;
        case "get_asset":
          result = await snipeit.getAsset(args);
          break;
        case "create_asset":
          result = await snipeit.createAsset(args);
          break;
        case "checkout_asset":
          result = await snipeit.checkoutAsset(args);
          break;
        case "checkin_asset":
          result = await snipeit.checkinAsset(args);
          break;
        case "list_users":
          result = await snipeit.listUsers(args);
          break;
        case "get_user":
          result = await snipeit.getUser(args);
          break;
        case "list_models":
          result = await snipeit.listModels(args);
          break;
        case "list_categories":
          result = await snipeit.listCategories(args);
          break;
        case "list_locations":
          result = await snipeit.listLocations(args);
          break;
        case "list_status_labels":
          result = await snipeit.listStatusLabels();
          break;
        case "list_manufacturers":
          result = await snipeit.listManufacturers(args);
          break;
        case "list_suppliers":
          result = await snipeit.listSuppliers(args);
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      console.log(`AUDIT: tool=${name} ip=${clientIp} duration=${Date.now() - startTime}ms status=ok`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      console.log(`AUDIT: tool=${name} ip=${clientIp} duration=${Date.now() - startTime}ms status=error`);
      const sanitizedError = ErrorHandler.sanitizeError(error);
      return {
        content: [
          {
            type: "text",
            text: sanitizedError,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

// MCP endpoint - handles POST (messages), GET (SSE stream), DELETE (session close)
app.post("/mcp", authenticateBearer, express.json({ limit: "10kb" }), async (req: Request, res: Response) => {
  const clientIp = getClientIp(req);
  if (!rateLimiter.isAllowed(clientIp)) {
    res.status(429).json({ error: "Too many requests. Please try again later." });
    return;
  }

  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  const existingSession = sessionId ? sessions.get(sessionId) : undefined;

  if (existingSession) {
    // Existing session — route to its transport
    existingSession.lastActivity = Date.now();
    try {
      await existingSession.transport.handleRequest(req, res, req.body);
    } catch (error: any) {
      console.error("Error handling message:", error.message);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
    return;
  }

  // New session — create transport + server
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (newSessionId: string) => {
      console.log(`New MCP session: ${newSessionId} from ${clientIp}`);
      const now = Date.now();
      sessions.set(newSessionId, {
        transport,
        server,
        createdAt: now,
        lastActivity: now,
        clientIp,
      });
    },
    onsessionclosed: (closedSessionId: string) => {
      console.log(`MCP session closed: ${closedSessionId}`);
      sessions.delete(closedSessionId);
    },
  });

  const server = createMcpServer(clientIp);

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error: any) {
    console.error("Error initializing session:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

app.get("/mcp", authenticateBearer, async (req: Request, res: Response) => {
  const clientIp = getClientIp(req);
  if (!rateLimiter.isAllowed(clientIp)) {
    res.status(429).json({ error: "Too many requests. Please try again later." });
    return;
  }

  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  const session = sessionId ? sessions.get(sessionId) : undefined;

  if (!session) {
    res.status(400).json({ error: "Invalid or missing session ID" });
    return;
  }

  session.lastActivity = Date.now();
  try {
    await session.transport.handleRequest(req, res);
  } catch (error: any) {
    console.error("Error handling SSE stream:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

app.delete("/mcp", authenticateBearer, async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  const session = sessionId ? sessions.get(sessionId) : undefined;

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  try {
    await session.transport.handleRequest(req, res);
  } catch (error: any) {
    console.error("Error closing session:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// Start server
app.listen(PORT, () => {
  const host = new URL(SNIPEIT_URL).hostname;
  console.log(`Snipe-IT MCP Server (Streamable HTTP) listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`Connected to Snipe-IT: ${host}`);
  console.log(`Authentication: ${MCP_BEARER_TOKEN ? "enabled" : "DISABLED (no MCP_BEARER_TOKEN set)"}`);
});
