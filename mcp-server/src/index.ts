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

  // ---- UPDATE & DELETE OPERATIONS ----

  // Assets - Update & Delete
  async updateAsset(id: any, data: any) {
    const assetId = InputValidator.validateId(id, "asset_id");
    const payload: Record<string, any> = {};
    if (data.name !== undefined) payload.name = InputValidator.validateString(data.name, "name");
    if (data.serial !== undefined) payload.serial = InputValidator.validateString(data.serial, "serial");
    if (data.asset_tag !== undefined) payload.asset_tag = InputValidator.validateString(data.asset_tag, "asset_tag");
    if (data.model_id !== undefined) payload.model_id = InputValidator.validateId(data.model_id, "model_id");
    if (data.status_id !== undefined) payload.status_id = InputValidator.validateId(data.status_id, "status_id");
    if (data.notes !== undefined) payload.notes = InputValidator.validateString(data.notes, "notes", 2000);
    if (data.purchase_date !== undefined) payload.purchase_date = InputValidator.validateDate(data.purchase_date, "purchase_date");
    if (data.purchase_cost !== undefined) payload.purchase_cost = InputValidator.validateString(data.purchase_cost, "purchase_cost", 50);
    if (data.supplier_id !== undefined) payload.supplier_id = InputValidator.validateId(data.supplier_id, "supplier_id");
    const response = await this.client.put(`/api/v1/hardware/${assetId}`, payload);
    return response.data;
  }

  async deleteAsset(id: any) {
    const assetId = InputValidator.validateId(id, "asset_id");
    const response = await this.client.delete(`/api/v1/hardware/${assetId}`);
    return response.data;
  }

  // Users - Create, Update & Delete
  async createUser(data: any) {
    const payload: Record<string, any> = {
      first_name: InputValidator.validateString(data.first_name, "first_name"),
      username: InputValidator.validateString(data.username, "username"),
      password: InputValidator.validateString(data.password, "password"),
    };
    if (!payload.first_name) throw new Error("first_name is required");
    if (!payload.username) throw new Error("username is required");
    if (!payload.password) throw new Error("password is required");
    if (data.last_name !== undefined) payload.last_name = InputValidator.validateString(data.last_name, "last_name");
    if (data.email !== undefined) payload.email = InputValidator.validateString(data.email, "email");
    if (data.jobtitle !== undefined) payload.jobtitle = InputValidator.validateString(data.jobtitle, "jobtitle");
    if (data.employee_num !== undefined) payload.employee_num = InputValidator.validateString(data.employee_num, "employee_num");
    if (data.department_id !== undefined) payload.department_id = InputValidator.validateId(data.department_id, "department_id");
    if (data.company_id !== undefined) payload.company_id = InputValidator.validateId(data.company_id, "company_id");
    if (data.location_id !== undefined) payload.location_id = InputValidator.validateId(data.location_id, "location_id");
    const response = await this.client.post("/api/v1/users", payload);
    return response.data;
  }

  async updateUser(id: any, data: any) {
    const userId = InputValidator.validateId(id, "user_id");
    const payload: Record<string, any> = {};
    if (data.first_name !== undefined) payload.first_name = InputValidator.validateString(data.first_name, "first_name");
    if (data.last_name !== undefined) payload.last_name = InputValidator.validateString(data.last_name, "last_name");
    if (data.username !== undefined) payload.username = InputValidator.validateString(data.username, "username");
    if (data.email !== undefined) payload.email = InputValidator.validateString(data.email, "email");
    if (data.password !== undefined) payload.password = InputValidator.validateString(data.password, "password");
    if (data.jobtitle !== undefined) payload.jobtitle = InputValidator.validateString(data.jobtitle, "jobtitle");
    if (data.employee_num !== undefined) payload.employee_num = InputValidator.validateString(data.employee_num, "employee_num");
    if (data.department_id !== undefined) payload.department_id = InputValidator.validateId(data.department_id, "department_id");
    if (data.company_id !== undefined) payload.company_id = InputValidator.validateId(data.company_id, "company_id");
    if (data.location_id !== undefined) payload.location_id = InputValidator.validateId(data.location_id, "location_id");
    const response = await this.client.put(`/api/v1/users/${userId}`, payload);
    return response.data;
  }

  async deleteUser(id: any) {
    const userId = InputValidator.validateId(id, "user_id");
    const response = await this.client.delete(`/api/v1/users/${userId}`);
    return response.data;
  }

  // Models - Create, Update & Delete
  async createModel(data: any) {
    const payload: Record<string, any> = {
      name: InputValidator.validateString(data.name, "name"),
      category_id: InputValidator.validateId(data.category_id, "category_id"),
    };
    if (!payload.name) throw new Error("name is required");
    if (data.model_number !== undefined) payload.model_number = InputValidator.validateString(data.model_number, "model_number");
    if (data.manufacturer_id !== undefined) payload.manufacturer_id = InputValidator.validateId(data.manufacturer_id, "manufacturer_id");
    const response = await this.client.post("/api/v1/models", payload);
    return response.data;
  }

  async updateModel(id: any, data: any) {
    const modelId = InputValidator.validateId(id, "model_id");
    const payload: Record<string, any> = {};
    if (data.name !== undefined) payload.name = InputValidator.validateString(data.name, "name");
    if (data.model_number !== undefined) payload.model_number = InputValidator.validateString(data.model_number, "model_number");
    if (data.category_id !== undefined) payload.category_id = InputValidator.validateId(data.category_id, "category_id");
    if (data.manufacturer_id !== undefined) payload.manufacturer_id = InputValidator.validateId(data.manufacturer_id, "manufacturer_id");
    const response = await this.client.put(`/api/v1/models/${modelId}`, payload);
    return response.data;
  }

  async deleteModel(id: any) {
    const modelId = InputValidator.validateId(id, "model_id");
    const response = await this.client.delete(`/api/v1/models/${modelId}`);
    return response.data;
  }

  // Categories - Create, Update & Delete
  async createCategory(data: any) {
    const payload: Record<string, any> = {
      name: InputValidator.validateString(data.name, "name"),
      category_type: InputValidator.validateEnum(data.category_type, ["asset", "accessory", "consumable", "component", "license"], "category_type"),
    };
    if (!payload.name) throw new Error("name is required");
    const response = await this.client.post("/api/v1/categories", payload);
    return response.data;
  }

  async updateCategory(id: any, data: any) {
    const categoryId = InputValidator.validateId(id, "category_id");
    const payload: Record<string, any> = {};
    if (data.name !== undefined) payload.name = InputValidator.validateString(data.name, "name");
    if (data.category_type !== undefined) payload.category_type = InputValidator.validateEnum(data.category_type, ["asset", "accessory", "consumable", "component", "license"], "category_type");
    const response = await this.client.put(`/api/v1/categories/${categoryId}`, payload);
    return response.data;
  }

  async deleteCategory(id: any) {
    const categoryId = InputValidator.validateId(id, "category_id");
    const response = await this.client.delete(`/api/v1/categories/${categoryId}`);
    return response.data;
  }

  // Locations - Create, Update & Delete
  async createLocation(data: any) {
    const payload: Record<string, any> = {
      name: InputValidator.validateString(data.name, "name"),
    };
    if (!payload.name) throw new Error("name is required");
    if (data.address !== undefined) payload.address = InputValidator.validateString(data.address, "address");
    if (data.city !== undefined) payload.city = InputValidator.validateString(data.city, "city");
    if (data.state !== undefined) payload.state = InputValidator.validateString(data.state, "state");
    if (data.country !== undefined) payload.country = InputValidator.validateString(data.country, "country");
    if (data.zip !== undefined) payload.zip = InputValidator.validateString(data.zip, "zip", 20);
    const response = await this.client.post("/api/v1/locations", payload);
    return response.data;
  }

  async updateLocation(id: any, data: any) {
    const locationId = InputValidator.validateId(id, "location_id");
    const payload: Record<string, any> = {};
    if (data.name !== undefined) payload.name = InputValidator.validateString(data.name, "name");
    if (data.address !== undefined) payload.address = InputValidator.validateString(data.address, "address");
    if (data.city !== undefined) payload.city = InputValidator.validateString(data.city, "city");
    if (data.state !== undefined) payload.state = InputValidator.validateString(data.state, "state");
    if (data.country !== undefined) payload.country = InputValidator.validateString(data.country, "country");
    if (data.zip !== undefined) payload.zip = InputValidator.validateString(data.zip, "zip", 20);
    const response = await this.client.put(`/api/v1/locations/${locationId}`, payload);
    return response.data;
  }

  async deleteLocation(id: any) {
    const locationId = InputValidator.validateId(id, "location_id");
    const response = await this.client.delete(`/api/v1/locations/${locationId}`);
    return response.data;
  }

  // Manufacturers - Create, Update & Delete
  async createManufacturer(data: any) {
    const payload: Record<string, any> = {
      name: InputValidator.validateString(data.name, "name"),
    };
    if (!payload.name) throw new Error("name is required");
    if (data.url !== undefined) payload.url = InputValidator.validateString(data.url, "url", 500);
    const response = await this.client.post("/api/v1/manufacturers", payload);
    return response.data;
  }

  async updateManufacturer(id: any, data: any) {
    const manufacturerId = InputValidator.validateId(id, "manufacturer_id");
    const payload: Record<string, any> = {};
    if (data.name !== undefined) payload.name = InputValidator.validateString(data.name, "name");
    if (data.url !== undefined) payload.url = InputValidator.validateString(data.url, "url", 500);
    const response = await this.client.put(`/api/v1/manufacturers/${manufacturerId}`, payload);
    return response.data;
  }

  async deleteManufacturer(id: any) {
    const manufacturerId = InputValidator.validateId(id, "manufacturer_id");
    const response = await this.client.delete(`/api/v1/manufacturers/${manufacturerId}`);
    return response.data;
  }

  // Suppliers - Create, Update & Delete
  async createSupplier(data: any) {
    const payload: Record<string, any> = {
      name: InputValidator.validateString(data.name, "name"),
    };
    if (!payload.name) throw new Error("name is required");
    if (data.address !== undefined) payload.address = InputValidator.validateString(data.address, "address");
    if (data.city !== undefined) payload.city = InputValidator.validateString(data.city, "city");
    if (data.state !== undefined) payload.state = InputValidator.validateString(data.state, "state");
    if (data.country !== undefined) payload.country = InputValidator.validateString(data.country, "country");
    if (data.zip !== undefined) payload.zip = InputValidator.validateString(data.zip, "zip", 20);
    if (data.contact !== undefined) payload.contact = InputValidator.validateString(data.contact, "contact");
    if (data.phone !== undefined) payload.phone = InputValidator.validateString(data.phone, "phone", 50);
    if (data.email !== undefined) payload.email = InputValidator.validateString(data.email, "email");
    if (data.url !== undefined) payload.url = InputValidator.validateString(data.url, "url", 500);
    const response = await this.client.post("/api/v1/suppliers", payload);
    return response.data;
  }

  async updateSupplier(id: any, data: any) {
    const supplierId = InputValidator.validateId(id, "supplier_id");
    const payload: Record<string, any> = {};
    if (data.name !== undefined) payload.name = InputValidator.validateString(data.name, "name");
    if (data.address !== undefined) payload.address = InputValidator.validateString(data.address, "address");
    if (data.city !== undefined) payload.city = InputValidator.validateString(data.city, "city");
    if (data.state !== undefined) payload.state = InputValidator.validateString(data.state, "state");
    if (data.country !== undefined) payload.country = InputValidator.validateString(data.country, "country");
    if (data.zip !== undefined) payload.zip = InputValidator.validateString(data.zip, "zip", 20);
    if (data.contact !== undefined) payload.contact = InputValidator.validateString(data.contact, "contact");
    if (data.phone !== undefined) payload.phone = InputValidator.validateString(data.phone, "phone", 50);
    if (data.email !== undefined) payload.email = InputValidator.validateString(data.email, "email");
    if (data.url !== undefined) payload.url = InputValidator.validateString(data.url, "url", 500);
    const response = await this.client.put(`/api/v1/suppliers/${supplierId}`, payload);
    return response.data;
  }

  async deleteSupplier(id: any) {
    const supplierId = InputValidator.validateId(id, "supplier_id");
    const response = await this.client.delete(`/api/v1/suppliers/${supplierId}`);
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

  // ---- UPDATE & DELETE TOOLS ----

  // Asset Update & Delete
  {
    name: "update_asset",
    description: "Update an existing asset in Snipe-IT",
    inputSchema: {
      type: "object",
      properties: {
        asset_id: { type: "number", description: "The ID of the asset to update (required)" },
        name: { type: "string", description: "Asset name" },
        serial: { type: "string", description: "Serial number" },
        asset_tag: { type: "string", description: "Unique asset tag" },
        model_id: { type: "number", description: "Model ID" },
        status_id: { type: "number", description: "Status label ID" },
        notes: { type: "string", description: "Notes about the asset" },
        purchase_date: { type: "string", description: "Purchase date (YYYY-MM-DD format)" },
        purchase_cost: { type: "string", description: "Purchase cost" },
        supplier_id: { type: "number", description: "Supplier ID" },
      },
      required: ["asset_id"],
    },
  },
  {
    name: "delete_asset",
    description: "Delete an asset from Snipe-IT",
    inputSchema: {
      type: "object",
      properties: {
        asset_id: { type: "number", description: "The ID of the asset to delete" },
      },
      required: ["asset_id"],
    },
  },

  // User Create, Update & Delete
  {
    name: "create_user",
    description: "Create a new user in Snipe-IT",
    inputSchema: {
      type: "object",
      properties: {
        first_name: { type: "string", description: "First name (required)" },
        last_name: { type: "string", description: "Last name" },
        username: { type: "string", description: "Username (required)" },
        password: { type: "string", description: "Password (required)" },
        email: { type: "string", description: "Email address" },
        jobtitle: { type: "string", description: "Job title" },
        employee_num: { type: "string", description: "Employee number" },
        department_id: { type: "number", description: "Department ID" },
        company_id: { type: "number", description: "Company ID" },
        location_id: { type: "number", description: "Location ID" },
      },
      required: ["first_name", "username", "password"],
    },
  },
  {
    name: "update_user",
    description: "Update an existing user in Snipe-IT",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "number", description: "The ID of the user to update (required)" },
        first_name: { type: "string", description: "First name" },
        last_name: { type: "string", description: "Last name" },
        username: { type: "string", description: "Username" },
        email: { type: "string", description: "Email address" },
        password: { type: "string", description: "Password" },
        jobtitle: { type: "string", description: "Job title" },
        employee_num: { type: "string", description: "Employee number" },
        department_id: { type: "number", description: "Department ID" },
        company_id: { type: "number", description: "Company ID" },
        location_id: { type: "number", description: "Location ID" },
      },
      required: ["user_id"],
    },
  },
  {
    name: "delete_user",
    description: "Delete a user from Snipe-IT",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "number", description: "The ID of the user to delete" },
      },
      required: ["user_id"],
    },
  },

  // Model Create, Update & Delete
  {
    name: "create_model",
    description: "Create a new asset model in Snipe-IT",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Model name (required)" },
        model_number: { type: "string", description: "Model number" },
        category_id: { type: "number", description: "Category ID (required)" },
        manufacturer_id: { type: "number", description: "Manufacturer ID" },
      },
      required: ["name", "category_id"],
    },
  },
  {
    name: "update_model",
    description: "Update an existing asset model in Snipe-IT",
    inputSchema: {
      type: "object",
      properties: {
        model_id: { type: "number", description: "The ID of the model to update (required)" },
        name: { type: "string", description: "Model name" },
        model_number: { type: "string", description: "Model number" },
        category_id: { type: "number", description: "Category ID" },
        manufacturer_id: { type: "number", description: "Manufacturer ID" },
      },
      required: ["model_id"],
    },
  },
  {
    name: "delete_model",
    description: "Delete an asset model from Snipe-IT",
    inputSchema: {
      type: "object",
      properties: {
        model_id: { type: "number", description: "The ID of the model to delete" },
      },
      required: ["model_id"],
    },
  },

  // Category Create, Update & Delete
  {
    name: "create_category",
    description: "Create a new category in Snipe-IT",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Category name (required)" },
        category_type: { type: "string", description: "Category type (required)", enum: ["asset", "accessory", "consumable", "component", "license"] },
      },
      required: ["name", "category_type"],
    },
  },
  {
    name: "update_category",
    description: "Update an existing category in Snipe-IT",
    inputSchema: {
      type: "object",
      properties: {
        category_id: { type: "number", description: "The ID of the category to update (required)" },
        name: { type: "string", description: "Category name" },
        category_type: { type: "string", description: "Category type", enum: ["asset", "accessory", "consumable", "component", "license"] },
      },
      required: ["category_id"],
    },
  },
  {
    name: "delete_category",
    description: "Delete a category from Snipe-IT",
    inputSchema: {
      type: "object",
      properties: {
        category_id: { type: "number", description: "The ID of the category to delete" },
      },
      required: ["category_id"],
    },
  },

  // Location Create, Update & Delete
  {
    name: "create_location",
    description: "Create a new location in Snipe-IT",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Location name (required)" },
        address: { type: "string", description: "Street address" },
        city: { type: "string", description: "City" },
        state: { type: "string", description: "State/Province" },
        country: { type: "string", description: "Country" },
        zip: { type: "string", description: "Zip/Postal code" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_location",
    description: "Update an existing location in Snipe-IT",
    inputSchema: {
      type: "object",
      properties: {
        location_id: { type: "number", description: "The ID of the location to update (required)" },
        name: { type: "string", description: "Location name" },
        address: { type: "string", description: "Street address" },
        city: { type: "string", description: "City" },
        state: { type: "string", description: "State/Province" },
        country: { type: "string", description: "Country" },
        zip: { type: "string", description: "Zip/Postal code" },
      },
      required: ["location_id"],
    },
  },
  {
    name: "delete_location",
    description: "Delete a location from Snipe-IT",
    inputSchema: {
      type: "object",
      properties: {
        location_id: { type: "number", description: "The ID of the location to delete" },
      },
      required: ["location_id"],
    },
  },

  // Manufacturer Create, Update & Delete
  {
    name: "create_manufacturer",
    description: "Create a new manufacturer in Snipe-IT",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Manufacturer name (required)" },
        url: { type: "string", description: "Manufacturer website URL" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_manufacturer",
    description: "Update an existing manufacturer in Snipe-IT",
    inputSchema: {
      type: "object",
      properties: {
        manufacturer_id: { type: "number", description: "The ID of the manufacturer to update (required)" },
        name: { type: "string", description: "Manufacturer name" },
        url: { type: "string", description: "Manufacturer website URL" },
      },
      required: ["manufacturer_id"],
    },
  },
  {
    name: "delete_manufacturer",
    description: "Delete a manufacturer from Snipe-IT",
    inputSchema: {
      type: "object",
      properties: {
        manufacturer_id: { type: "number", description: "The ID of the manufacturer to delete" },
      },
      required: ["manufacturer_id"],
    },
  },

  // Supplier Create, Update & Delete
  {
    name: "create_supplier",
    description: "Create a new supplier in Snipe-IT",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Supplier name (required)" },
        address: { type: "string", description: "Street address" },
        city: { type: "string", description: "City" },
        state: { type: "string", description: "State/Province" },
        country: { type: "string", description: "Country" },
        zip: { type: "string", description: "Zip/Postal code" },
        contact: { type: "string", description: "Contact person name" },
        phone: { type: "string", description: "Phone number" },
        email: { type: "string", description: "Email address" },
        url: { type: "string", description: "Website URL" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_supplier",
    description: "Update an existing supplier in Snipe-IT",
    inputSchema: {
      type: "object",
      properties: {
        supplier_id: { type: "number", description: "The ID of the supplier to update (required)" },
        name: { type: "string", description: "Supplier name" },
        address: { type: "string", description: "Street address" },
        city: { type: "string", description: "City" },
        state: { type: "string", description: "State/Province" },
        country: { type: "string", description: "Country" },
        zip: { type: "string", description: "Zip/Postal code" },
        contact: { type: "string", description: "Contact person name" },
        phone: { type: "string", description: "Phone number" },
        email: { type: "string", description: "Email address" },
        url: { type: "string", description: "Website URL" },
      },
      required: ["supplier_id"],
    },
  },
  {
    name: "delete_supplier",
    description: "Delete a supplier from Snipe-IT",
    inputSchema: {
      type: "object",
      properties: {
        supplier_id: { type: "number", description: "The ID of the supplier to delete" },
      },
      required: ["supplier_id"],
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

      // ---- UPDATE & DELETE HANDLERS ----

      case "update_asset": {
        const { asset_id, ...updateData } = args as any;
        const result = await snipeit.updateAsset(asset_id, updateData);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "delete_asset": {
        const result = await snipeit.deleteAsset(args!.asset_id);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "create_user": {
        const result = await snipeit.createUser(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "update_user": {
        const { user_id, ...updateData } = args as any;
        const result = await snipeit.updateUser(user_id, updateData);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "delete_user": {
        const result = await snipeit.deleteUser(args!.user_id);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "create_model": {
        const result = await snipeit.createModel(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "update_model": {
        const { model_id, ...updateData } = args as any;
        const result = await snipeit.updateModel(model_id, updateData);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "delete_model": {
        const result = await snipeit.deleteModel(args!.model_id);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "create_category": {
        const result = await snipeit.createCategory(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "update_category": {
        const { category_id, ...updateData } = args as any;
        const result = await snipeit.updateCategory(category_id, updateData);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "delete_category": {
        const result = await snipeit.deleteCategory(args!.category_id);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "create_location": {
        const result = await snipeit.createLocation(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "update_location": {
        const { location_id, ...updateData } = args as any;
        const result = await snipeit.updateLocation(location_id, updateData);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "delete_location": {
        const result = await snipeit.deleteLocation(args!.location_id);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "create_manufacturer": {
        const result = await snipeit.createManufacturer(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "update_manufacturer": {
        const { manufacturer_id, ...updateData } = args as any;
        const result = await snipeit.updateManufacturer(manufacturer_id, updateData);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "delete_manufacturer": {
        const result = await snipeit.deleteManufacturer(args!.manufacturer_id);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "create_supplier": {
        const result = await snipeit.createSupplier(args);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "update_supplier": {
        const { supplier_id, ...updateData } = args as any;
        const result = await snipeit.updateSupplier(supplier_id, updateData);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "delete_supplier": {
        const result = await snipeit.deleteSupplier(args!.supplier_id);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
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
