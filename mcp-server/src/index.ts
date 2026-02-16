#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosInstance } from "axios";
import * as https from "https";

// ============================================================================
// CONFIGURATION VALIDATION
// ============================================================================

class ConfigValidator {
  static validate(): { url: string; token: string } {
    const url = process.env.SNIPEIT_URL || "";
    const token = process.env.SNIPEIT_API_TOKEN || "";

    if (!url || !token) {
      throw new Error("SNIPEIT_URL and SNIPEIT_API_TOKEN environment variables are required");
    }

    // Validate URL format
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("SNIPEIT_URL is not a valid URL");
    }

    // Enforce HTTPS (allow localhost for development)
    if (parsed.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(parsed.hostname)) {
      throw new Error("SNIPEIT_URL must use HTTPS protocol for security (localhost is exempt)");
    }

    // Basic token validation
    if (token.length < 20) {
      console.warn("Warning: API token appears unusually short");
    }

    return { url, token };
  }
}

const config = ConfigValidator.validate();

// ============================================================================
// INPUT VALIDATORS
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
      throw new Error("Offset must be a non-negative integer");
    }
    return num;
  }

  static validateSearchQuery(query: any): string {
    if (query === undefined) return "";
    if (typeof query !== "string") {
      throw new Error("Search query must be a string");
    }
    if (query.length > 500) {
      throw new Error("Search query too long (max 500 characters)");
    }
    // Sanitize potentially problematic characters
    return query.trim();
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
    // Basic date format validation
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new Error(`${fieldName} must be in YYYY-MM-DD format`);
    }
    return value;
  }

  static validateCreateAssetInput(data: any): {
    asset_tag?: string;
    model_id: number;
    status_id: number;
    name?: string;
    serial?: string;
    purchase_date?: string;
    purchase_cost?: string;
    supplier_id?: number;
    notes?: string;
  } {
    return {
      model_id: this.validateId(data.model_id, "model_id"),
      status_id: this.validateId(data.status_id, "status_id"),
      asset_tag: data.asset_tag ? this.validateString(data.asset_tag, "asset_tag") : undefined,
      name: data.name ? this.validateString(data.name, "name") : undefined,
      serial: data.serial ? this.validateString(data.serial, "serial") : undefined,
      purchase_date: this.validateDate(data.purchase_date, "purchase_date"),
      purchase_cost: data.purchase_cost ? this.validateString(data.purchase_cost, "purchase_cost", 50) : undefined,
      supplier_id: data.supplier_id ? this.validateId(data.supplier_id, "supplier_id") : undefined,
      notes: data.notes ? this.validateString(data.notes, "notes", 2000) : undefined,
    };
  }

  static validateCheckoutInput(data: any): {
    checkout_to_type: "user" | "asset" | "location";
    assigned_user?: number;
    assigned_asset?: number;
    assigned_location?: number;
    note?: string;
  } {
    const checkout_to_type = this.validateEnum(
      data.checkout_to_type,
      ["user", "asset", "location"],
      "checkout_to_type"
    );

    const result: any = { checkout_to_type };

    if (checkout_to_type === "user" && data.assigned_user) {
      result.assigned_user = this.validateId(data.assigned_user, "assigned_user");
    } else if (checkout_to_type === "asset" && data.assigned_asset) {
      result.assigned_asset = this.validateId(data.assigned_asset, "assigned_asset");
    } else if (checkout_to_type === "location" && data.assigned_location) {
      result.assigned_location = this.validateId(data.assigned_location, "assigned_location");
    }

    if (data.note) {
      result.note = this.validateString(data.note, "note", 1000);
    }

    return result;
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
      timeout: 30000, // 30 second timeout
      httpsAgent: new https.Agent({
        rejectUnauthorized: true, // Enforce valid SSL certificates
      }),
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "snipeit-mcp-server/1.0.0",
      },
    });
  }

  // Assets
  async listAssets(params?: { limit?: any; offset?: any; search?: any; status?: any }) {
    const validatedParams = {
      limit: InputValidator.validateLimit(params?.limit),
      offset: InputValidator.validateOffset(params?.offset),
      search: InputValidator.validateSearchQuery(params?.search),
      status: params?.status ? InputValidator.validateString(params.status, "status", 50) : undefined,
    };
    const response = await this.client.get("/api/v1/hardware", { params: validatedParams });
    return response.data;
  }

  async getAsset(id: any) {
    const assetId = InputValidator.validateId(id, "asset_id");
    const response = await this.client.get(`/api/v1/hardware/${assetId}`);
    return response.data;
  }

  async createAsset(data: any) {
    const validatedData = InputValidator.validateCreateAssetInput(data);
    const response = await this.client.post("/api/v1/hardware", validatedData);
    return response.data;
  }

  async checkoutAsset(assetId: any, data: any) {
    const validatedId = InputValidator.validateId(assetId, "asset_id");
    const validatedData = InputValidator.validateCheckoutInput(data);
    const response = await this.client.post(`/api/v1/hardware/${validatedId}/checkout`, validatedData);
    return response.data;
  }

  async checkinAsset(assetId: any, data?: any) {
    const validatedId = InputValidator.validateId(assetId, "asset_id");
    const validatedData: any = {};
    if (data?.note) {
      validatedData.note = InputValidator.validateString(data.note, "note", 1000);
    }
    if (data?.location_id) {
      validatedData.location_id = InputValidator.validateId(data.location_id, "location_id");
    }
    const response = await this.client.post(`/api/v1/hardware/${validatedId}/checkin`, validatedData);
    return response.data;
  }

  // Users
  async listUsers(params?: { limit?: any; offset?: any; search?: any }) {
    const validatedParams = {
      limit: InputValidator.validateLimit(params?.limit),
      offset: InputValidator.validateOffset(params?.offset),
      search: InputValidator.validateSearchQuery(params?.search),
    };
    const response = await this.client.get("/api/v1/users", { params: validatedParams });
    return response.data;
  }

  async getUser(id: any) {
    const userId = InputValidator.validateId(id, "user_id");
    const response = await this.client.get(`/api/v1/users/${userId}`);
    return response.data;
  }

  // Models
  async listModels(params?: { limit?: any; offset?: any; search?: any }) {
    const validatedParams = {
      limit: InputValidator.validateLimit(params?.limit),
      offset: InputValidator.validateOffset(params?.offset),
      search: InputValidator.validateSearchQuery(params?.search),
    };
    const response = await this.client.get("/api/v1/models", { params: validatedParams });
    return response.data;
  }

  // Categories
  async listCategories(params?: { limit?: any; offset?: any }) {
    const validatedParams = {
      limit: InputValidator.validateLimit(params?.limit),
      offset: InputValidator.validateOffset(params?.offset),
    };
    const response = await this.client.get("/api/v1/categories", { params: validatedParams });
    return response.data;
  }

  // Locations
  async listLocations(params?: { limit?: any; offset?: any; search?: any }) {
    const validatedParams = {
      limit: InputValidator.validateLimit(params?.limit),
      offset: InputValidator.validateOffset(params?.offset),
      search: InputValidator.validateSearchQuery(params?.search),
    };
    const response = await this.client.get("/api/v1/locations", { params: validatedParams });
    return response.data;
  }

  // Status Labels
  async listStatusLabels() {
    const response = await this.client.get("/api/v1/statuslabels");
    return response.data;
  }

  // Manufacturers
  async listManufacturers(params?: { limit?: any; offset?: any }) {
    const validatedParams = {
      limit: InputValidator.validateLimit(params?.limit),
      offset: InputValidator.validateOffset(params?.offset),
    };
    const response = await this.client.get("/api/v1/manufacturers", { params: validatedParams });
    return response.data;
  }

  // Suppliers
  async listSuppliers(params?: { limit?: any; offset?: any }) {
    const validatedParams = {
      limit: InputValidator.validateLimit(params?.limit),
      offset: InputValidator.validateOffset(params?.offset),
    };
    const response = await this.client.get("/api/v1/suppliers", { params: validatedParams });
    return response.data;
  }
}

const snipeit = new SnipeITClient(config.url, config.token);

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

const tools: Tool[] = [
  {
    name: "list_assets",
    description: "List all assets in Snipe-IT with optional filtering",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of results to return (1-500, default: 50)",
        },
        offset: {
          type: "number",
          description: "Offset for pagination (must be >= 0)",
        },
        search: {
          type: "string",
          description: "Search query to filter assets",
        },
        status: {
          type: "string",
          description: "Filter by status (e.g., 'RTD', 'Deployed', 'Pending')",
        },
      },
    },
  },
  {
    name: "get_asset",
    description: "Get detailed information about a specific asset",
    inputSchema: {
      type: "object",
      properties: {
        asset_id: {
          type: "number",
          description: "The ID of the asset (must be positive integer)",
        },
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
        asset_tag: {
          type: "string",
          description: "Unique asset tag",
        },
        model_id: {
          type: "number",
          description: "Model ID (required)",
        },
        status_id: {
          type: "number",
          description: "Status label ID (required)",
        },
        name: {
          type: "string",
          description: "Asset name",
        },
        serial: {
          type: "string",
          description: "Serial number",
        },
        purchase_date: {
          type: "string",
          description: "Purchase date (YYYY-MM-DD format)",
        },
        purchase_cost: {
          type: "string",
          description: "Purchase cost",
        },
        supplier_id: {
          type: "number",
          description: "Supplier ID",
        },
        notes: {
          type: "string",
          description: "Notes about the asset",
        },
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
        asset_id: {
          type: "number",
          description: "The ID of the asset to check out",
        },
        checkout_to_type: {
          type: "string",
          description: "Type: 'user', 'asset', or 'location'",
          enum: ["user", "asset", "location"],
        },
        assigned_user: {
          type: "number",
          description: "User ID (required if checking out to user)",
        },
        assigned_asset: {
          type: "number",
          description: "Asset ID (required if checking out to asset)",
        },
        assigned_location: {
          type: "number",
          description: "Location ID (required if checking out to location)",
        },
        note: {
          type: "string",
          description: "Checkout note",
        },
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
        asset_id: {
          type: "number",
          description: "The ID of the asset to check in",
        },
        note: {
          type: "string",
          description: "Check-in note",
        },
        location_id: {
          type: "number",
          description: "Location ID to check in to",
        },
      },
      required: ["asset_id"],
    },
  },
  {
    name: "list_users",
    description: "List all users in Snipe-IT",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of results to return (1-500)",
        },
        offset: {
          type: "number",
          description: "Offset for pagination",
        },
        search: {
          type: "string",
          description: "Search query to filter users",
        },
      },
    },
  },
  {
    name: "get_user",
    description: "Get detailed information about a specific user",
    inputSchema: {
      type: "object",
      properties: {
        user_id: {
          type: "number",
          description: "The ID of the user",
        },
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
        limit: {
          type: "number",
          description: "Number of results to return (1-500)",
        },
        search: {
          type: "string",
          description: "Search query to filter models",
        },
      },
    },
  },
  {
    name: "list_categories",
    description: "List all categories",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of results to return (1-500)",
        },
      },
    },
  },
  {
    name: "list_locations",
    description: "List all locations",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of results to return (1-500)",
        },
        search: {
          type: "string",
          description: "Search query to filter locations",
        },
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
        limit: {
          type: "number",
          description: "Number of results to return (1-500)",
        },
      },
    },
  },
  {
    name: "list_suppliers",
    description: "List all suppliers",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of results to return (1-500)",
        },
      },
    },
  },
];

// ============================================================================
// SERVER SETUP
// ============================================================================

const server = new Server(
  {
    name: "snipeit-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_assets": {
        const result = await snipeit.listAssets(args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_asset": {
        const result = await snipeit.getAsset(args!.asset_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "create_asset": {
        const result = await snipeit.createAsset(args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "checkout_asset": {
        const { asset_id, ...checkoutData } = args as any;
        const result = await snipeit.checkoutAsset(asset_id, checkoutData);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "checkin_asset": {
        const { asset_id, ...checkinData } = args as any;
        const result = await snipeit.checkinAsset(asset_id, checkinData);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "list_users": {
        const result = await snipeit.listUsers(args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_user": {
        const result = await snipeit.getUser(args!.user_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "list_models": {
        const result = await snipeit.listModels(args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "list_categories": {
        const result = await snipeit.listCategories(args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "list_locations": {
        const result = await snipeit.listLocations(args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "list_status_labels": {
        const result = await snipeit.listStatusLabels();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "list_manufacturers": {
        const result = await snipeit.listManufacturers(args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "list_suppliers": {
        const result = await snipeit.listSuppliers(args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
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

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Snipe-IT MCP Server (Hardened) running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
