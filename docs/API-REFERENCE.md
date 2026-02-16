# API Reference - Snipe-IT MCP Server

**Complete reference for all 13 MCP tools**

---

## Overview

The Snipe-IT MCP server provides 13 tools for interacting with your Snipe-IT instance:

**Assets (5 tools):**
- `list_assets` - List all assets with filtering
- `get_asset` - Get asset details by ID
- `create_asset` - Create new asset
- `checkout_asset` - Check out asset to user/location
- `checkin_asset` - Check in asset

**Reference Data (8 tools):**
- `list_users` - List all users
- `get_user` - Get user details
- `list_models` - List asset models
- `list_categories` - List categories
- `list_locations` - List locations
- `list_status_labels` - List status labels
- `list_manufacturers` - List manufacturers
- `list_suppliers` - List suppliers

---

## Common Parameters

### Pagination Parameters

All `list_*` tools support pagination:

| Parameter | Type | Required | Default | Validation | Description |
|-----------|------|----------|---------|------------|-------------|
| `limit` | number | No | 50 | 1-500 | Max results to return |
| `offset` | number | No | 0 | >=0 | Results to skip |

**Example:**
```json
{
  "limit": 100,
  "offset": 0
}
```

**Pagination Logic:**
- First page: `offset: 0, limit: 100`
- Second page: `offset: 100, limit: 100`
- Third page: `offset: 200, limit: 100`

### Search Parameters

Many tools support search:

| Parameter | Type | Required | Default | Validation | Description |
|-----------|------|----------|---------|------------|-------------|
| `search` | string | No | "" | <500 chars | Search query |

**Example:**
```json
{
  "search": "MacBook Pro"
}
```

---

## Asset Tools

### 1. list_assets

List all assets with optional filtering.

**Parameters:**

| Name | Type | Required | Default | Validation | Description |
|------|------|----------|---------|------------|-------------|
| `limit` | number | No | 50 | 1-500 | Max results |
| `offset` | number | No | 0 | >=0 | Skip results |
| `search` | string | No | "" | <500 chars | Search query |
| `status` | string | No | "all" | See below | Filter by status |

**Status Values:**
- `"all"` - All assets
- `"deployable"` - Available to deploy
- `"deployed"` - Currently deployed
- `"pending"` - Pending status
- `"undeployable"` - Cannot be deployed
- `"archived"` - Archived assets

**Example Request:**
```json
{
  "limit": 100,
  "offset": 0,
  "search": "laptop",
  "status": "deployable"
}
```

**Example Response:**
```json
{
  "total": 523,
  "rows": [
    {
      "id": 123,
      "asset_tag": "LT-001",
      "name": "MacBook Pro 16",
      "serial": "C02ABC123",
      "model": {
        "id": 5,
        "name": "MacBook Pro 16\" M3"
      },
      "status_label": {
        "id": 2,
        "name": "Ready to Deploy"
      },
      "assigned_to": null,
      "location": {
        "id": 10,
        "name": "Headquarters"
      }
    }
  ]
}
```

**Claude Examples:**
- "List all laptops in Snipe-IT"
- "Show me deployable assets"
- "Find all MacBook Pros"
- "List assets in New York office"

---

### 2. get_asset

Get detailed information about a specific asset.

**Parameters:**

| Name | Type | Required | Default | Validation | Description |
|------|------|----------|---------|------------|-------------|
| `id` | number | Yes | - | Positive integer | Asset ID |

**Example Request:**
```json
{
  "id": 123
}
```

**Example Response:**
```json
{
  "id": 123,
  "asset_tag": "LT-001",
  "name": "MacBook Pro 16",
  "serial": "C02ABC123",
  "model": {
    "id": 5,
    "name": "MacBook Pro 16\" M3",
    "manufacturer": {
      "id": 1,
      "name": "Apple"
    }
  },
  "status_label": {
    "id": 2,
    "name": "Ready to Deploy"
  },
  "category": {
    "id": 3,
    "name": "Laptops"
  },
  "purchase_date": "2024-01-15",
  "purchase_cost": "2499.00",
  "warranty_months": 12,
  "notes": "Executive laptop",
  "assigned_to": null,
  "location": {
    "id": 10,
    "name": "Headquarters"
  },
  "custom_fields": {}
}
```

**Claude Examples:**
- "Get details for asset 123"
- "Show me asset LT-001"
- "What's the warranty on asset 456?"

---

### 3. create_asset

Create a new asset in Snipe-IT.

**Parameters:**

| Name | Type | Required | Default | Validation | Description |
|------|------|----------|---------|------------|-------------|
| `model_id` | number | Yes | - | Positive int | Model ID |
| `status_id` | number | Yes | - | Positive int | Status label ID |
| `asset_tag` | string | No | Auto | <255 chars | Asset tag |
| `name` | string | No | "" | <255 chars | Asset name |
| `serial` | string | No | "" | <255 chars | Serial number |
| `purchase_date` | string | No | null | YYYY-MM-DD | Purchase date |
| `purchase_cost` | string | No | null | <50 chars | Purchase cost |
| `supplier_id` | number | No | null | Positive int | Supplier ID |
| `notes` | string | No | "" | <2000 chars | Notes |

**Example Request:**
```json
{
  "model_id": 5,
  "status_id": 2,
  "asset_tag": "LT-042",
  "name": "Engineering Laptop",
  "serial": "C02XYZ789",
  "purchase_date": "2025-02-01",
  "purchase_cost": "2499.00",
  "supplier_id": 3,
  "notes": "For new hire John Doe"
}
```

**Example Response:**
```json
{
  "status": "success",
  "messages": "Asset created successfully",
  "payload": {
    "id": 524,
    "asset_tag": "LT-042"
  }
}
```

**Claude Examples:**
- "Create a new MacBook Pro asset"
- "Add laptop with serial ABC123"
- "Create asset: Dell XPS 15, model ID 8, status ID 2"

---

### 4. checkout_asset

Check out an asset to a user, asset, or location.

**Parameters:**

| Name | Type | Required | Default | Validation | Description |
|------|------|----------|---------|------------|-------------|
| `asset_id` | number | Yes | - | Positive int | Asset ID to check out |
| `checkout_to_type` | string | Yes | - | Enum | "user", "asset", or "location" |
| `assigned_user` | number | Conditional | - | Positive int | User ID (if type=user) |
| `assigned_asset` | number | Conditional | - | Positive int | Asset ID (if type=asset) |
| `assigned_location` | number | Conditional | - | Positive int | Location ID (if type=location) |
| `note` | string | No | "" | <1000 chars | Checkout note |

**Example Request (to user):**
```json
{
  "asset_id": 123,
  "checkout_to_type": "user",
  "assigned_user": 456,
  "note": "Laptop for remote work"
}
```

**Example Request (to location):**
```json
{
  "asset_id": 789,
  "checkout_to_type": "location",
  "assigned_location": 10,
  "note": "Stored in conference room"
}
```

**Example Response:**
```json
{
  "status": "success",
  "messages": "Asset checked out successfully"
}
```

**Claude Examples:**
- "Check out asset 123 to user 456"
- "Assign laptop LT-001 to John Doe (user 789)"
- "Check out asset 999 to location 5"

---

### 5. checkin_asset

Check in an asset (return it).

**Parameters:**

| Name | Type | Required | Default | Validation | Description |
|------|------|----------|---------|------------|-------------|
| `asset_id` | number | Yes | - | Positive int | Asset ID to check in |
| `note` | string | No | "" | <1000 chars | Checkin note |

**Example Request:**
```json
{
  "asset_id": 123,
  "note": "Employee departed, laptop returned"
}
```

**Example Response:**
```json
{
  "status": "success",
  "messages": "Asset checked in successfully"
}
```

**Claude Examples:**
- "Check in asset 123"
- "Return laptop LT-001"
- "Mark asset 456 as returned"

---

## User Tools

### 6. list_users

List all users in Snipe-IT.

**Parameters:**

| Name | Type | Required | Default | Validation | Description |
|------|------|----------|---------|------------|-------------|
| `limit` | number | No | 50 | 1-500 | Max results |
| `offset` | number | No | 0 | >=0 | Skip results |
| `search` | string | No | "" | <500 chars | Search query |

**Example Request:**
```json
{
  "limit": 100,
  "search": "john"
}
```

**Example Response:**
```json
{
  "total": 247,
  "rows": [
    {
      "id": 456,
      "username": "jdoe",
      "first_name": "John",
      "last_name": "Doe",
      "email": "jdoe@company.com",
      "department": {
        "id": 5,
        "name": "Engineering"
      },
      "location": {
        "id": 10,
        "name": "San Francisco"
      },
      "assets_count": 3
    }
  ]
}
```

**Claude Examples:**
- "List all users"
- "Find user John Doe"
- "Show me users in Engineering"

---

### 7. get_user

Get detailed information about a specific user.

**Parameters:**

| Name | Type | Required | Default | Validation | Description |
|------|------|----------|---------|------------|-------------|
| `id` | number | Yes | - | Positive int | User ID |

**Example Request:**
```json
{
  "id": 456
}
```

**Example Response:**
```json
{
  "id": 456,
  "username": "jdoe",
  "first_name": "John",
  "last_name": "Doe",
  "email": "jdoe@company.com",
  "phone": "+1-555-1234",
  "jobtitle": "Senior Engineer",
  "department": {
    "id": 5,
    "name": "Engineering"
  },
  "location": {
    "id": 10,
    "name": "San Francisco"
  },
  "manager": {
    "id": 123,
    "name": "Jane Smith"
  },
  "assets": [
    {
      "id": 789,
      "asset_tag": "LT-042",
      "name": "MacBook Pro 16"
    }
  ]
}
```

**Claude Examples:**
- "Get user details for ID 456"
- "Show me John Doe's assigned assets"
- "What assets does user 789 have?"

---

## Reference Data Tools

### 8. list_models

List all asset models.

**Parameters:**

| Name | Type | Required | Default | Validation | Description |
|------|------|----------|---------|------------|-------------|
| `limit` | number | No | 50 | 1-500 | Max results |
| `offset` | number | No | 0 | >=0 | Skip results |
| `search` | string | No | "" | <500 chars | Search query |

**Example Response:**
```json
{
  "total": 45,
  "rows": [
    {
      "id": 5,
      "name": "MacBook Pro 16\" M3",
      "model_number": "MRW13LL/A",
      "manufacturer": {
        "id": 1,
        "name": "Apple"
      },
      "category": {
        "id": 3,
        "name": "Laptops"
      },
      "assets_count": 23
    }
  ]
}
```

**Claude Examples:**
- "List all laptop models"
- "Show me MacBook models"
- "What models do we have?"

---

### 9. list_categories

List all asset categories.

**Parameters:**

| Name | Type | Required | Default | Validation | Description |
|------|------|----------|---------|------------|-------------|
| `limit` | number | No | 50 | 1-500 | Max results |
| `offset` | number | No | 0 | >=0 | Skip results |

**Example Response:**
```json
{
  "total": 12,
  "rows": [
    {
      "id": 3,
      "name": "Laptops",
      "category_type": "asset",
      "assets_count": 156
    },
    {
      "id": 4,
      "name": "Monitors",
      "category_type": "asset",
      "assets_count": 89
    }
  ]
}
```

**Claude Examples:**
- "List all categories"
- "What asset categories exist?"
- "Show me equipment types"

---

### 10. list_locations

List all locations.

**Parameters:**

| Name | Type | Required | Default | Validation | Description |
|------|------|----------|---------|------------|-------------|
| `limit` | number | No | 50 | 1-500 | Max results |
| `offset` | number | No | 0 | >=0 | Skip results |
| `search` | string | No | "" | <500 chars | Search query |

**Example Response:**
```json
{
  "total": 8,
  "rows": [
    {
      "id": 10,
      "name": "San Francisco HQ",
      "address": "123 Market St",
      "city": "San Francisco",
      "state": "CA",
      "country": "US",
      "zip": "94103",
      "assets_count": 234,
      "assigned_assets_count": 189
    }
  ]
}
```

**Claude Examples:**
- "List all office locations"
- "Show me locations in California"
- "What locations have assets?"

---

### 11. list_status_labels

List all status labels.

**Parameters:**

| Name | Type | Required | Default | Validation | Description |
|------|------|----------|---------|------------|-------------|
| `limit` | number | No | 50 | 1-500 | Max results |
| `offset` | number | No | 0 | >=0 | Skip results |

**Example Response:**
```json
{
  "total": 6,
  "rows": [
    {
      "id": 2,
      "name": "Ready to Deploy",
      "type": "deployable",
      "color": "green",
      "assets_count": 145
    },
    {
      "id": 3,
      "name": "In Repair",
      "type": "pending",
      "color": "yellow",
      "assets_count": 12
    }
  ]
}
```

**Claude Examples:**
- "List all status labels"
- "What statuses are available?"
- "Show me asset states"

---

### 12. list_manufacturers

List all manufacturers.

**Parameters:**

| Name | Type | Required | Default | Validation | Description |
|------|------|----------|---------|------------|-------------|
| `limit` | number | No | 50 | 1-500 | Max results |
| `offset` | number | No | 0 | >=0 | Skip results |

**Example Response:**
```json
{
  "total": 15,
  "rows": [
    {
      "id": 1,
      "name": "Apple",
      "url": "https://apple.com",
      "support_url": "https://support.apple.com",
      "assets_count": 234
    }
  ]
}
```

**Claude Examples:**
- "List all manufacturers"
- "What brands do we have?"
- "Show me vendors"

---

### 13. list_suppliers

List all suppliers.

**Parameters:**

| Name | Type | Required | Default | Validation | Description |
|------|------|----------|---------|------------|-------------|
| `limit` | number | No | 50 | 1-500 | Max results |
| `offset` | number | No | 0 | >=0 | Skip results |

**Example Response:**
```json
{
  "total": 9,
  "rows": [
    {
      "id": 3,
      "name": "CDW",
      "contact": "sales@cdw.com",
      "phone": "+1-800-123-4567",
      "address": "200 N Milwaukee Ave",
      "city": "Vernon Hills",
      "state": "IL",
      "assets_count": 67
    }
  ]
}
```

**Claude Examples:**
- "List all suppliers"
- "What vendors do we use?"
- "Show me resellers"

---

## Security & Validation

### Input Validation Rules

All parameters are validated before being sent to Snipe-IT:

**IDs (`id`, `model_id`, `status_id`, etc.):**
- Must be positive integers (>0)
- Example: 123 | NOT "123", 0, -1, null

**Limits:**
- Must be between 1 and 500
- Example: 100 | NOT 0, 501, -10

**Offsets:**
- Must be non-negative (>=0)
- Example: 0, 100 | NOT -1, null

**Strings:**
- Must be strings
- Max length varies by field
- Trimmed automatically
- Example: "laptop" | NOT 123, null, ["laptop"]

**Dates:**
- Must be in YYYY-MM-DD format
- Example: "2025-02-13" | NOT "02/13/2025", "2025-2-13"

**Enums:**
- Must be exact match from allowed values
- Case-sensitive
- Example: "user" | NOT "USER", "users", "person"

### Error Handling

All errors are sanitized to prevent information disclosure:

**Validation Errors:**
```json
{
  "error": "Validation error: id must be a positive integer"
}
```

**API Errors:**
- 401: "Authentication failed. Please check your API token configuration."
- 403: "Permission denied. You may not have access to perform this operation."
- 404: "Resource not found. The requested item may not exist."
- 422: "Validation error. Please check your input parameters."
- 500: "Snipe-IT server error. Please try again later or contact your administrator."

**No stack traces or internal details are exposed.**

---

## Rate Limits

**Built-in Protection:**
- Request timeout: 30 seconds per request
- No server-level rate limiting (relies on Cloudflare)

**Cloudflare Access:**
- 100 requests per minute per user (default)
- Configurable in Access policies

**Best Practices:**
- Use pagination for large datasets
- Cache results when appropriate
- Implement exponential backoff on errors

---

## Usage Tips

### Pagination Best Practices

```javascript
// Get all assets (example in pseudocode)
let allAssets = [];
let offset = 0;
const limit = 500;  // Max allowed

while (true) {
  const result = await list_assets({ limit, offset });
  allAssets.push(...result.rows);

  if (allAssets.length >= result.total) {
    break;  // Got everything
  }

  offset += limit;
}
```

### Search Best Practices

```javascript
// Search is substring match, case-insensitive
search: "macbook"  // Finds: "MacBook", "macbook pro", "MACBOOK AIR"

// Use specific terms
search: "macbook pro 16"  // Better than just "laptop"

// Limit results for performance
{
  search: "laptop",
  limit: 100  // Don't get all 1000+ results
}
```

### Error Handling Best Practices

```javascript
try {
  const asset = await get_asset({ id: 123 });
  // Use asset
} catch (error) {
  if (error.includes("not found")) {
    // Asset doesn't exist
  } else if (error.includes("Authentication")) {
    // Check API token
  } else {
    // Other error
  }
}
```

---

## Testing Tools

### Using curl

```bash
# Health check
curl http://localhost:3000/health

# List assets (requires MCP client)
# See test-tools.js for examples
```

### Using test-tools.js

```bash
cd tests
node test-tools.js http://localhost:3000
```

---

## Additional Resources

- [Snipe-IT API Documentation](https://snipe-it.readme.io/reference)
- [MCP Specification](https://modelcontextprotocol.io/)
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues
- [FAQ.md](FAQ.md) - Frequently asked questions

---

**Last Updated:** 2025-02-13
**Version:** 1.0.0
**Total Tools:** 13
