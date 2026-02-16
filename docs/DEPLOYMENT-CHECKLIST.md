# Deployment Checklist - Snipe-IT MCP Server

**Pre-deployment verification checklist**

---

## Overview

Use this checklist before deploying to ensure everything is configured correctly and secure.

**Deployment Paths:**
- Local Development - Checkpoints 1-10
- Production (Cloudflare) - All checkpoints
- Enterprise - All checkpoints + additional security review

---

## Phase 1: Pre-Deployment (Everyone)

### Environment Setup

- [ ] **Node.js 18+ installed**
  ```bash
  node --version  # Should be v18.x.x or higher
  ```

- [ ] **npm installed**
  ```bash
  npm --version  # Should be v9.x.x or higher
  ```

- [ ] **Project extracted**
  ```bash
  cd snipe-it_mcp_prod
  ls -la  # Should see mcp-server/, docs/, etc.
  ```

- [ ] **Dependencies installed**
  ```bash
  cd mcp-server
  npm install
  # Should complete without errors
  ```

---

### Configuration

- [ ] **`.env` file created**
  ```bash
  ls -la .env  # Should exist
  ```

- [ ] **Snipe-IT URL configured (HTTPS only!)**
  ```bash
  grep SNIPEIT_URL .env
  # Should be: SNIPEIT_URL=https://your-instance.com
  # NOT: http://... (no HTTP allowed!)
  ```

- [ ] **API token configured**
  ```bash
  grep SNIPEIT_API_TOKEN .env
  # Should have real token, not placeholder
  ```

- [ ] **API token tested**
  ```bash
  curl -H "Authorization: Bearer YOUR_TOKEN" \
    https://your-snipeit.com/api/v1/statuslabels
  # Should return JSON response
  ```

---

### Security

- [ ] **`.env` file NOT committed to git**
  ```bash
  git status | grep .env
  # Should show nothing or "ignored"
  ```

- [ ] **`.gitignore` file exists**
  ```bash
  cat .gitignore | grep .env
  # Should show: .env
  ```

- [ ] **No secrets in source code**
  ```bash
  grep -r "eyJ" mcp-server/src/
  # Should return nothing
  ```

- [ ] **Security review read**
  ```bash
  cat SECURITY-REVIEW-2-SUMMARY.md
  # Understand: 9.0/10 security score
  ```

---

### Build

- [ ] **stdio version builds**
  ```bash
  npm run build
  ls -la build/index.js  # Should exist
  ```

- [ ] **HTTP version builds (if deploying to Cloudflare)**
  ```bash
  npm run build:http
  ls -la build-http/index.js  # Should exist
  ```

- [ ] **No build errors**
  ```bash
  # Check output for errors
  # Should end with: "Compiled successfully"
  ```

---

### Testing

- [ ] **Server starts locally**
  ```bash
  npm run start
  # Should show: "Snipe-IT MCP Server running"
  ```

- [ ] **Health check works (HTTP version)**
  ```bash
  npm run start:http &
  curl http://localhost:3000/health
  # Should return: {"status":"healthy"}
  kill %1  # Stop background process
  ```

- [ ] **Can list assets**
  ```bash
  # Test through Claude Desktop or direct API call
  # Should return asset data from Snipe-IT
  ```

---

## Phase 2: Local Deployment Only

### Claude Desktop Integration

- [ ] **Config file located**
  ```bash
  # macOS
  cat ~/Library/Application\ Support/Claude/claude_desktop_config.json

  # Windows
  type %APPDATA%\Claude\claude_desktop_config.json

  # Linux
  cat ~/.config/Claude/claude_desktop_config.json
  ```

- [ ] **Config uses ABSOLUTE path**
  ```json
  {
    "mcpServers": {
      "snipeit": {
        "command": "node",
        "args": [
          "/path/to/snipe-it_mcp_prod/mcp-server/build/index.js"
        ]
      }
    }
  }
  ```

- [ ] **Environment variables in config**
  ```json
  {
    "env": {
      "SNIPEIT_URL": "https://your-instance.com",
      "SNIPEIT_API_TOKEN": "your-token-here"
    }
  }
  ```

- [ ] **Claude Desktop restarted**
  ```bash
  # Quit Claude Desktop completely
  # Restart Claude Desktop
  # Check MCP indicator shows
  ```

- [ ] **Tools available in Claude**
  ```
  Ask Claude: "What Snipe-IT tools do you have?"
  # Should list: list_assets, get_asset, create_asset, etc.
  ```

- [ ] **Can query Snipe-IT data**
  ```
  Ask Claude: "List my assets"
  # Should show real data from your Snipe-IT
  ```

---

## Phase 3: Production Deployment (Cloudflare)

### Server Provisioning

- [ ] **Cloud server provisioned**
  ```bash
  # AWS Lightsail, DigitalOcean, or other
  # Minimum: 512MB RAM, 20GB disk
  # Recommended: 1GB+ RAM
  ```

- [ ] **SSH access working**
  ```bash
  ssh user@your-server-ip
  # Should connect successfully
  ```

- [ ] **Node.js installed on server**
  ```bash
  node --version  # On server
  # Should be v18.x.x or higher
  ```

- [ ] **Project uploaded to server**
  ```bash
  # On server
  ls -la ~/snipe-it_mcp_prod
  ```

---

### Server Configuration

- [ ] **HTTP server starts on server**
  ```bash
  # On server
  cd snipe-it_mcp_prod/mcp-server
  npm run start:http
  # Should start without errors
  ```

- [ ] **Health check works locally on server**
  ```bash
  # On server
  curl http://localhost:3000/health
  # Should return: {"status":"healthy"}
  ```

- [ ] **systemd service created**
  ```bash
  # On server
  sudo cat /etc/systemd/system/snipeit-mcp.service
  # Should exist with correct config
  ```

- [ ] **Service starts automatically**
  ```bash
  # On server
  sudo systemctl enable snipeit-mcp
  sudo systemctl start snipeit-mcp
  sudo systemctl status snipeit-mcp
  # Should show: Active (running)
  ```

- [ ] **Service survives reboot**
  ```bash
  # On server
  sudo reboot
  # Wait for server to restart
  ssh user@your-server-ip
  sudo systemctl status snipeit-mcp
  # Should still be: Active (running)
  ```

---

### Cloudflare Tunnel

- [ ] **Cloudflare account created**
- [ ] **Domain added to Cloudflare**
- [ ] **cloudflared installed on server**
  ```bash
  cloudflared --version
  ```

- [ ] **Cloudflare authenticated**
  ```bash
  cloudflared tunnel login
  ```

- [ ] **Tunnel created**
  ```bash
  cloudflared tunnel create snipeit-mcp
  ```

- [ ] **DNS configured**
  ```bash
  cloudflared tunnel route dns snipeit-mcp mcp.yourdomain.com
  ```

- [ ] **Tunnel config file created**
  ```bash
  cat ~/.cloudflared/config.yml
  ```

- [ ] **Tunnel works**
  ```bash
  cloudflared tunnel --config ~/.cloudflared/config.yml run snipeit-mcp

  # From your computer
  curl https://mcp.yourdomain.com/health
  # Should return: {"status":"healthy"}
  ```

- [ ] **Tunnel service enabled**
  ```bash
  sudo systemctl enable cloudflared
  sudo systemctl start cloudflared
  sudo systemctl status cloudflared
  ```

---

### Cloudflare Access

- [ ] **Application created in Cloudflare**
- [ ] **Identity provider configured**
- [ ] **Access policies created**
- [ ] **MFA enabled**
- [ ] **Access tested**
  ```bash
  # Open in browser: https://mcp.yourdomain.com/health
  # Should redirect to login
  # After login, should show health check
  ```

- [ ] **Unauthorized access blocked**

---

## Phase 4: Security Verification

### Code Security

- [ ] **Using hardened version**
- [ ] **HTTPS enforcement active**
- [ ] **Input validation active**
- [ ] **Error sanitization working**

---

### Secret Management

- [ ] **API token stored securely**
- [ ] **Token permissions minimal**
- [ ] **Token rotation scheduled**

---

### Monitoring

- [ ] **Health checks automated**
  ```bash
  # */5 * * * * curl -f https://mcp.yourdomain.com/health || alert
  ```

- [ ] **Logging configured**
  ```bash
  sudo journalctl -u snipeit-mcp -n 10
  sudo journalctl -u cloudflared -n 10
  ```

- [ ] **Cloudflare Analytics enabled**
- [ ] **Alert mechanism configured**

---

## Phase 5: Documentation & Training

- [ ] **Internal wiki page created**
- [ ] **Runbook created**
- [ ] **Support process defined**
- [ ] **Team demonstrated functionality**
- [ ] **Documentation shared**
- [ ] **Feedback mechanism created**

---

## Phase 6: Go-Live

### Pre-Launch Validation

- [ ] **All above checkpoints completed**
- [ ] **Backups configured**
- [ ] **Rollback plan documented**

### Launch

- [ ] **Announced to team**
- [ ] **Monitoring active**
- [ ] **Available for support**

### Post-Launch (First Week)

- [ ] **Daily health checks**
- [ ] **User feedback collected**
- [ ] **Metrics reviewed**

---

## Success Criteria

### Week 1 Goals

- [ ] **Uptime: >99%**
- [ ] **Error rate: <1%**
- [ ] **Average response time: <2 seconds**
- [ ] **All team members can access**
- [ ] **No security incidents**

### Month 1 Goals

- [ ] **Uptime: >99.5%**
- [ ] **Error rate: <0.5%**
- [ ] **Average response time: <1 second**
- [ ] **User satisfaction: >80%**
- [ ] **Support tickets: <5% of users**

---

## Red Flags (Don't Launch If...)

**Critical Issues:**
- [ ] .env file in git repository
- [ ] API token exposed in source code
- [ ] HTTP (not HTTPS) URLs configured
- [ ] No access control (anyone can access)
- [ ] Server crashes on startup
- [ ] Can't connect to Snipe-IT
- [ ] Error rate >10%
- [ ] No way to know if it goes down

**If any of these are true, DO NOT LAUNCH until fixed!**

---

## Quick Reference

**Most Important Checks:**

1. HTTPS only (no HTTP)
2. .env not in git
3. Can connect to Snipe-IT
4. Server starts without errors
5. Health check works
6. Access control configured
7. MFA enabled
8. Monitoring active
9. Team trained
10. Rollback plan ready

**If all 10 are checked, you're ready to deploy!**

---

**Last Updated:** 2025-02-13
**Version:** 1.0.0
**Status:** Production-tested checklist
