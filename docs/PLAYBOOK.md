# Snipe-IT MCP Server - Deployment Playbook

**Complete playbook from zero to production in one day**

---

## Timeline Overview

**Total Time:** 8 hours (with breaks)
**Difficulty:** Intermediate
**Prerequisites:** Node.js, npm, Cloudflare account (for production)

| Phase | Time | What | Status |
|-------|------|------|--------|
| **Morning** | 3h | Local setup & testing | |
| **Lunch** | 1h | Break | |
| **Afternoon** | 3h | Cloudflare setup & testing | |
| **Late Day** | 1h | Team rollout & documentation | |

---

## MORNING SESSION (9am-12pm): Local Setup

### 9:00 - 9:30am: Project Setup (30 min)

#### Checklist
- [ ] Node.js 18+ installed
- [ ] npm installed
- [ ] Snipe-IT API token obtained
- [ ] Project downloaded and extracted
- [ ] Text editor ready

#### Tasks

**1. Download & Extract (5 min)**
```bash
# Extract the project
tar -xzf snipe-it_mcp_project.tar.gz
cd snipe-it_mcp_project

# Verify structure
ls -la
```

**2. Install Dependencies (10 min)**
```bash
cd mcp-server
npm install
```

**3. Configure Environment (10 min)**
```bash
# Copy template
cp .env.example .env

# Edit with your credentials
nano .env
```

**Add your actual values:**
```env
SNIPEIT_URL=https://your-actual-snipeit.com
SNIPEIT_API_TOKEN=your-api-token-here
PORT=3000
```

**4. Verify Configuration (5 min)**
```bash
# Test Snipe-IT API directly
curl -H "Authorization: Bearer $SNIPEIT_API_TOKEN" \
  $SNIPEIT_URL/api/v1/statuslabels

# Should return JSON with status labels
```

**Checkpoint:** Environment configured, API working

---

### 9:30 - 10:30am: Build & Test stdio Version (1 hour)

**1. Build stdio Version (5 min)**
```bash
cd mcp-server
npm run build
```

**2. Test Server Starts (5 min)**
```bash
# Set environment variables
export $(cat .env | xargs)

# Run server
node build/index.js
```

**Press Ctrl+C to stop**

**3. Configure Claude Desktop (15 min)**

**macOS:**
```bash
nano ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Windows:**
```bash
notepad %APPDATA%\Claude\claude_desktop_config.json
```

**Add this configuration:**
```json
{
  "mcpServers": {
    "snipeit": {
      "command": "node",
      "args": ["/FULL/PATH/TO/mcp-server/build/index.js"],
      "env": {
        "SNIPEIT_URL": "https://your-actual-snipeit.com",
        "SNIPEIT_API_TOKEN": "your-actual-token"
      }
    }
  }
}
```

**4. Test with Claude Desktop (30 min)**

**Restart Claude Desktop**

**Test queries:**
1. "List my assets in Snipe-IT"
2. "How many users are in the system?"
3. "What asset models do we have?"
4. "Show me the status labels"
5. "Get details for asset ID 1"

**Checkpoint:** stdio version working with Claude Desktop

---

### 10:30 - 11:00am: Build & Test HTTP Version (30 min)

**1. Install HTTP Dependencies (5 min)**
```bash
npm install express @types/express
```

**2. Build HTTP Version (5 min)**
```bash
npm run build:http
```

**3. Start HTTP Server (5 min)**

**Terminal 1:**
```bash
export $(cat .env | xargs)
npm run start:http
```

**4. Test HTTP Server (15 min)**

**Terminal 2:**
```bash
# Test health check
curl http://localhost:3000/health

# Expected: {"status":"healthy","timestamp":"..."}
```

**Checkpoint:** HTTP server running and responding

---

### 11:00 - 12:00pm: Testing & Security Review (1 hour)

**Run tests, review security documentation, and verify all 13 tools are working.**

**Checkpoint:** Morning session complete, ready for Cloudflare

---

## LUNCH BREAK (12pm-1pm)

**Take a break! You've got a working MCP server locally.**

---

## AFTERNOON SESSION (1pm-4pm): Cloudflare Setup

### 1:00 - 1:30pm: Cloudflare Tunnel Setup (30 min)

**1. Install cloudflared (10 min)**

**macOS:**
```bash
brew install cloudflare/cloudflare/cloudflared
```

**Linux:**
```bash
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

**2. Authenticate with Cloudflare (5 min)**
```bash
cloudflared tunnel login
```

**3. Create Tunnel (10 min)**
```bash
cloudflared tunnel create snipeit-mcp
```

**Save the Tunnel ID!**

**4. Configure DNS (5 min)**
```bash
cloudflared tunnel route dns snipeit-mcp mcp.yourdomain.com
```

**Checkpoint:** Tunnel created, DNS configured

---

### 1:30 - 2:00pm: Tunnel Configuration (30 min)

**Create config.yml:**
```yaml
tunnel: YOUR-TUNNEL-ID
credentials-file: /path/to/credentials.json

ingress:
  - hostname: mcp.yourdomain.com
    service: http://localhost:3000
    originRequest:
      noTLSVerify: true
      http2Origin: true
  - service: http_status:404

logDirectory: /var/log/cloudflared
logLevel: info
```

**Test External Access:**
```bash
curl https://mcp.yourdomain.com/health
```

**Checkpoint:** Tunnel working, externally accessible

---

### 2:00 - 3:00pm: Cloudflare Access & Testing (1 hour)

**Create Access Application, configure identity providers, create access policies, and test authentication flow.**

**Checkpoint:** Access authentication working

---

### 3:00 - 4:00pm: Production Configuration & Monitoring (1 hour)

**Set up auto-start services, configure monitoring alerts, and test alerting.**

**Checkpoint:** Services auto-start on reboot, monitoring configured

---

## LATE AFTERNOON (4pm-5pm): Team Rollout

### 4:00 - 4:30pm: Team Onboarding (30 min)

**Add team members to Access, send onboarding email, help first users connect.**

### 4:30 - 5:00pm: Documentation & Handoff (30 min)

**Create operations runbook, update deployment notes, schedule follow-ups.**

---

## End of Day Checklist

### Technical Milestones
- [ ] MCP server running and tested locally
- [ ] HTTP server responding on port 3000
- [ ] Cloudflare Tunnel configured and connected
- [ ] Access authentication working (SSO/MFA)
- [ ] All 13 tools functional
- [ ] Auto-restart configured (launchd/systemd)
- [ ] Monitoring and alerts enabled
- [ ] Security review completed (9.0/10 score)

### Team Milestones
- [ ] 3+ users successfully onboarded
- [ ] Onboarding email sent
- [ ] Documentation complete (README, RUNBOOK)
- [ ] Known issues documented
- [ ] Follow-up scheduled

---

## Success Criteria

**You're successful when:**

**Technical:**
- MCP server running 24/7
- Accessible via https://mcp.yourdomain.com
- Authentication working (SSO/MFA)
- All tests passing
- Error rate < 1%
- Response time < 500ms

**Team:**
- 3+ users successfully using the service
- Positive user feedback
- Clear documentation
- Support process defined

---

## Emergency Contacts

**If everything is down:**

1. Check Cloudflare status: https://www.cloudflarestatus.com/
2. Check Snipe-IT server status
3. Review logs: /tmp/snipeit-mcp.log
4. Restart services
5. Contact Cloudflare support (if Enterprise)

---

**Version:** 1.0.0
**Last Updated:** 2025-02-13
**Status:** Complete
