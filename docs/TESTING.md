# Testing Guide

**Comprehensive testing procedures for Snipe-IT MCP Server**

---

## Testing Overview

### Test Levels

| Level | Scope | When | Duration |
|-------|-------|------|----------|
| Unit | Individual functions | During development | Minutes |
| Integration | Component interactions | Before deployment | 30 min |
| System | End-to-end | After deployment | 1 hour |
| Acceptance | User workflows | Before production | 2 hours |
| Security | Vulnerabilities | Monthly | 1 hour |

---

## Unit Testing

### Input Validators

**Test: validateId()**
```typescript
// Test file: tests/unit/validators.test.ts
describe('InputValidator.validateId', () => {
  it('accepts positive integers', () => {
    expect(InputValidator.validateId(1, 'id')).toBe(1);
    expect(InputValidator.validateId(100, 'id')).toBe(100);
  });

  it('rejects negative numbers', () => {
    expect(() => InputValidator.validateId(-1, 'id'))
      .toThrow('id must be a positive integer');
  });

  it('rejects zero', () => {
    expect(() => InputValidator.validateId(0, 'id'))
      .toThrow('id must be a positive integer');
  });

  it('rejects non-integers', () => {
    expect(() => InputValidator.validateId(1.5, 'id'))
      .toThrow('id must be a positive integer');
  });

  it('rejects strings', () => {
    expect(() => InputValidator.validateId('abc', 'id'))
      .toThrow('id must be a positive integer');
  });
});
```

**Run tests:**
```bash
npm test
```

---

### Error Handler

**Test: sanitizeError()**
```typescript
describe('ErrorHandler.sanitizeError', () => {
  it('sanitizes 401 errors', () => {
    const error = { response: { status: 401 } };
    const result = ErrorHandler.sanitizeError(error);
    expect(result).toBe('Authentication failed. Please check your API token configuration.');
  });

  it('sanitizes 404 errors', () => {
    const error = { response: { status: 404 } };
    const result = ErrorHandler.sanitizeError(error);
    expect(result).toBe('Resource not found. The requested item may not exist.');
  });

  it('does not expose stack traces', () => {
    const error = new Error('Internal database error');
    error.stack = 'Error at db.query...';
    const result = ErrorHandler.sanitizeError(error);
    expect(result).not.toContain('database');
    expect(result).not.toContain(error.stack);
  });
});
```

---

## Integration Testing

### Test MCP Server Locally

**Prerequisites:**
```bash
# Start server
cd mcp-server
npm run build
npm run start:http &

# Wait for server to start
sleep 2
```

**Test health endpoint:**
```bash
#!/bin/bash
# tests/integration/health.test.sh

echo "Testing health endpoint..."

RESPONSE=$(curl -s http://localhost:3000/health)
STATUS=$(echo $RESPONSE | jq -r '.status')

if [ "$STATUS" = "healthy" ]; then
  echo "Health check passed"
  exit 0
else
  echo "Health check failed"
  echo "Response: $RESPONSE"
  exit 1
fi
```

---

### Test Snipe-IT Connection

```bash
#!/bin/bash
# tests/integration/snipeit-connection.test.sh

echo "Testing Snipe-IT connection..."

# Test API directly
RESPONSE=$(curl -s -H "Authorization: Bearer $SNIPEIT_API_TOKEN" \
  $SNIPEIT_URL/api/v1/statuslabels)

if echo $RESPONSE | jq -e '.total' > /dev/null; then
  echo "Snipe-IT API connection successful"
  exit 0
else
  echo "Snipe-IT API connection failed"
  echo "Response: $RESPONSE"
  exit 1
fi
```

---

## System Testing

### Test Complete Flow (stdio)

**Test queries in Claude Desktop:**

| Query | Expected Result | Status |
|-------|----------------|--------|
| "List my assets in Snipe-IT" | Returns asset list | [ ] |
| "How many users are in the system?" | Returns count | [ ] |
| "What asset models do we have?" | Returns models list | [ ] |
| "Show me status labels" | Returns status labels | [ ] |
| "Get details for asset ID 1" | Returns asset details | [ ] |
| "Create an asset: Laptop Model, serial ABC123, model ID 1, status ID 2" | Creates asset | [ ] |

**Pass criteria:**
- All 6 queries return correct results
- No errors in console
- Response time < 2 seconds per query

---

### Test Complete Flow (HTTP + Cloudflare)

**Test procedure:**

**1. Test unauthenticated access:**
```bash
# Should redirect to Cloudflare Access
curl -I https://mcp.yourdomain.com/health

# Expected: 302 redirect to Cloudflare Access
```

**2. Test authenticated access:**
```bash
# In browser (private/incognito):
# 1. Visit https://mcp.yourdomain.com
# 2. Login with authorized email
# 3. Should see application
```

**Pass criteria:**
- Unauthenticated users redirected to login
- Authenticated users can access
- Session persists
- Health endpoint returns 200

---

## Security Testing

### Automated Security Scan

```bash
cd mcp-server
npm audit

# Expected: No critical or high vulnerabilities
```

### Manual Security Tests

#### Test 1: HTTPS Enforcement

```bash
# Try HTTP URL
echo "SNIPEIT_URL=http://snipeit.example.com" > .env.test
export $(cat .env.test | xargs)
node build/index.js
```

**Expected:** Error: SNIPEIT_URL must use HTTPS protocol for security

#### Test 2: Input Validation

```bash
# Try negative ID
curl -X POST http://localhost:3000/message \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "get_asset",
      "arguments": {"id": -1}
    }
  }'
```

**Expected:** Error: id must be a positive integer

#### Test 3: Access Control

1. Visit https://mcp.yourdomain.com without logging in
2. Try to access with unauthorized email
3. Try to access after session expires

**Expected:** Redirected to login, access denied for unauthorized users

---

## Performance Testing

### Load Test

```bash
# 100 requests, 10 concurrent
ab -n 100 -c 10 http://localhost:3000/health

# Expected:
# - Requests per second: > 100
# - Time per request: < 100ms average
# - Failed requests: 0
```

### Stress Test

```bash
# 1000 requests, 50 concurrent
ab -n 1000 -c 50 http://localhost:3000/health
```

**Pass criteria:**
- No crashes
- No significant memory leaks
- Response time remains < 500ms

---

## Test Checklists

### Pre-Deployment Checklist

**Build & Configuration:**
- [ ] Project builds without errors
- [ ] .env file configured with real credentials
- [ ] .env file NOT committed to git
- [ ] All dependencies installed
- [ ] No npm audit vulnerabilities (critical/high)

**Local Testing:**
- [ ] stdio server starts without errors
- [ ] HTTP server starts without errors
- [ ] Health endpoint returns 200
- [ ] Can connect to Snipe-IT API
- [ ] All 13 tools working

**Cloudflare Testing:**
- [ ] Tunnel connects successfully
- [ ] DNS resolves correctly
- [ ] Access authentication working
- [ ] Authorized users can access
- [ ] Unauthorized users blocked

**Security:**
- [ ] HTTPS enforced
- [ ] Input validation tested
- [ ] Error sanitization verified
- [ ] No secrets in code
- [ ] Security review completed

---

### Post-Deployment Checklist

**Day 1:**
- [ ] Services running continuously
- [ ] No errors in logs
- [ ] Health checks passing
- [ ] 3+ users successfully tested
- [ ] Performance acceptable (< 500ms)

**Week 1:**
- [ ] Daily error rate < 1%
- [ ] Uptime > 99%
- [ ] User feedback positive
- [ ] No security issues

---

## Continuous Testing

### Daily Automated Tests

```bash
# Add to crontab
0 * * * * curl -sf http://localhost:3000/health || mail -s "MCP Server Down" admin@yourdomain.com
```

### Weekly Test Run

```bash
#!/bin/bash
# tests/weekly-test.sh

echo "Weekly Test Suite"
echo "===================="

# 1. Health check
echo "1. Health check..."
curl -sf http://localhost:3000/health || exit 1

# 2. Security scan
echo "2. Security scan..."
npm audit --audit-level=moderate || exit 1

# 3. Performance test
echo "3. Performance test..."
ab -n 100 -c 10 -q http://localhost:3000/health | grep "Requests per second"

echo "All tests passed!"
```

---

**Last Updated:** 2025-02-13
**Version:** 1.0.0
