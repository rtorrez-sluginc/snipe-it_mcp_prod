# Troubleshooting Guide - Snipe-IT MCP Server

**Common issues and solutions**

---

## Quick Diagnosis

### Is the problem...

**...with installation?** -> See [Installation Issues](#installation-issues)
**...with building?** -> See [Build Issues](#build-issues)
**...with running locally?** -> See [Local Runtime Issues](#local-runtime-issues)
**...with Cloudflare?** -> See [Cloudflare Issues](#cloudflare-issues)
**...with authentication?** -> See [Authentication Issues](#authentication-issues)
**...with performance?** -> See [Performance Issues](#performance-issues)

---

## Installation Issues

### "npm install fails"

**Symptoms:**
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Solutions:**

**Option 1 - Clean install:**
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

**Option 2 - Use legacy peer deps:**
```bash
npm install --legacy-peer-deps
```

**Option 3 - Update npm:**
```bash
npm install -g npm@latest
npm install
```

---

### "Node version too old"

**Solution:**

**macOS:**
```bash
brew install node@20
```

**Linux:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Verify:**
```bash
node --version  # Should show v20.x.x or higher
```

---

### "Cannot find module '@modelcontextprotocol/sdk'"

**Solution:**
```bash
cd mcp-server
npm install @modelcontextprotocol/sdk
```

---

## Build Issues

### "tsc: command not found"

**Solution:**
```bash
npm install typescript --save-dev
# Or install globally
npm install -g typescript
```

---

### "TypeScript compilation errors"

**Solution:**
```bash
npm install @types/node @types/express --save-dev
```

---

### "Build succeeds but no output files"

Check `tsconfig.json`:
```json
{
  "compilerOptions": {
    "outDir": "./build",
    "rootDir": "./src"
  }
}
```

Rebuild:
```bash
rm -rf build/
npm run build
ls -la build/  # Should show index.js
```

---

## Local Runtime Issues

### "Error: SNIPEIT_URL and SNIPEIT_API_TOKEN environment variables are required"

**Solutions:**

**Option 1 - Create .env file:**
```bash
cp .env.example .env
nano .env
# Add your actual credentials
```

**Option 2 - Export manually:**
```bash
export SNIPEIT_URL=https://your-snipeit.com
export SNIPEIT_API_TOKEN=your-token
node build/index.js
```

---

### "Error: SNIPEIT_URL must use HTTPS protocol for security"

Your `.env` has HTTP instead of HTTPS:

**Wrong:**
```env
SNIPEIT_URL=http://snipeit.example.com
```

**Correct:**
```env
SNIPEIT_URL=https://snipeit.example.com
```

---

### "Port 3000 already in use"

**Solutions:**

**Option 1 - Find and kill process:**
```bash
lsof -i :3000
kill [PID]
```

**Option 2 - Use different port:**
```bash
export PORT=3001
npm run start:http
```

---

### "Cannot connect to Snipe-IT server"

**Solutions:**

**1. Verify Snipe-IT URL:**
```bash
curl $SNIPEIT_URL
```

**2. Test API directly:**
```bash
curl -H "Authorization: Bearer $SNIPEIT_API_TOKEN" \
  $SNIPEIT_URL/api/v1/statuslabels
```

**3. Check API token** - Go to Snipe-IT -> Settings -> API

**4. Check firewall** - Ensure Snipe-IT is accessible from your network

---

### "SSL certificate validation failed"

**For development only (NOT production):**

Edit `src/index.ts` or `src-http/index.ts`:
```typescript
// TEMPORARY FIX FOR DEV ONLY
httpsAgent: new https.Agent({
  rejectUnauthorized: false, // WARNING: Only for dev!
}),
```

**Proper fix:** Get valid SSL certificate for Snipe-IT

---

## Cloudflare Issues

### "cloudflared: command not found"

**macOS:**
```bash
brew install cloudflare/cloudflare/cloudflared
```

**Linux:**
```bash
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

---

### "Tunnel authentication failed"

**Solutions:**

**1. Re-authenticate:**
```bash
cloudflared tunnel login
```

**2. Check credentials file:**
```bash
ls ~/.cloudflared/*.json
```

**3. Verify tunnel exists:**
```bash
cloudflared tunnel list
```

---

### "Tunnel won't connect"

**1. Check MCP server is running:**
```bash
curl http://localhost:3000/health
```

**2. Check tunnel config:**
```bash
cat ~/.cloudflared/config.yml
```

**3. Test tunnel manually:**
```bash
cloudflared tunnel --config ~/.cloudflared/config.yml \
  run snipeit-mcp --loglevel debug
```

---

### "DNS not resolving"

```bash
cloudflared tunnel route dns snipeit-mcp mcp.yourdomain.com

# Check DNS
dig mcp.yourdomain.com
nslookup mcp.yourdomain.com

# May take 5-10 minutes to propagate
```

---

## Authentication Issues

### "Access Denied" page

**1. Check email in policy:**
- Go to Cloudflare Access -> Applications
- Verify your email is in "Include" rules

**2. Clear browser cookies**

**3. Try incognito/private browsing**

---

### "Too many redirects"

**1. Clear cookies and try again**
**2. Check Access application domain matches tunnel hostname**
**3. Disable browser extensions**

---

## Performance Issues

### "Slow response times"

**1. Check Snipe-IT server performance:**
```bash
time curl -H "Authorization: Bearer $SNIPEIT_API_TOKEN" \
  $SNIPEIT_URL/api/v1/statuslabels
```

**2. Check network latency:**
```bash
ping snipeit.example.com
```

**3. Check Cloudflare analytics**

---

### "Rate limited by Snipe-IT"

**Solutions:**
- Contact Snipe-IT admin
- Reduce request frequency
- Add caching

---

## Claude Desktop Issues

### "Claude doesn't see MCP tools"

**1. Verify config file location:**

**macOS:**
```bash
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Windows:**
```bash
type %APPDATA%\Claude\claude_desktop_config.json
```

**2. Check config syntax** - ensure valid JSON

**3. Verify absolute path:**
```bash
cd mcp-server
pwd
# Use this output + /build/index.js
```

**4. Restart Claude Desktop** - quit completely and reopen

---

### "MCP server crashes when Claude calls it"

**1. Verify Node.js in PATH:**
```bash
which node
```

**2. Use full path to node:**
```json
{
  "mcpServers": {
    "snipeit": {
      "command": "/usr/local/bin/node",
      "args": ["/full/path/to/build/index.js"]
    }
  }
}
```

---

## Diagnostic Commands

### System Check

```bash
# Check Node.js
node --version
npm --version

# Check services
ps aux | grep node
ps aux | grep cloudflared

# Check ports
lsof -i :3000

# Check environment
echo $SNIPEIT_URL
```

### Connectivity Check

```bash
# Test localhost
curl http://localhost:3000/health

# Test through Cloudflare
curl https://mcp.yourdomain.com/health

# Test Snipe-IT API
curl -H "Authorization: Bearer $SNIPEIT_API_TOKEN" \
  $SNIPEIT_URL/api/v1/statuslabels
```

### Log Check

```bash
# View all logs
tail -f /tmp/snipeit-mcp*.log

# Search for errors
grep -i error /tmp/snipeit-mcp.log
grep -i failed /tmp/cloudflared.log
```

---

## Common Error Codes

| Error Code | Meaning | Solution |
|------------|---------|----------|
| EADDRINUSE | Port already in use | Kill process or use different port |
| ECONNREFUSED | Cannot connect | Check server is running |
| ETIMEDOUT | Request timeout | Check network, increase timeout |
| ENOTFOUND | DNS resolution failed | Check hostname, DNS settings |
| 401 | Authentication failed | Check API token |
| 403 | Permission denied | Check API token permissions |
| 404 | Not found | Check URL, endpoint exists |
| 429 | Rate limited | Reduce request frequency |
| 500 | Server error | Check Snipe-IT logs |

---

## Health Check Script

Create `scripts/health-check.sh`:

```bash
#!/bin/bash

echo "Health Check"
echo "==============="

# Check MCP server
echo -n "MCP Server: "
if curl -sf http://localhost:3000/health > /dev/null; then
  echo "Running"
else
  echo "Down"
fi

# Check Cloudflare tunnel
echo -n "Cloudflare Tunnel: "
if curl -sf https://mcp.yourdomain.com/health > /dev/null; then
  echo "Running"
else
  echo "Down"
fi

# Check Snipe-IT API
echo -n "Snipe-IT API: "
if curl -sf -H "Authorization: Bearer $SNIPEIT_API_TOKEN" \
  $SNIPEIT_URL/api/v1/statuslabels > /dev/null; then
  echo "Running"
else
  echo "Down"
fi

echo
echo "Logs: /tmp/snipeit-mcp*.log"
```

---

**Last Updated:** 2025-02-13
**Version:** 1.0.0
