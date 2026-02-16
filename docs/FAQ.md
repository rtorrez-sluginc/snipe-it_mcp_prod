# Frequently Asked Questions (FAQ)

**Common questions about the Snipe-IT MCP Server**

---

## Table of Contents

- [General Questions](#general-questions)
- [Installation & Setup](#installation--setup)
- [Security & Privacy](#security--privacy)
- [Usage & Features](#usage--features)
- [Cloudflare & Deployment](#cloudflare--deployment)
- [Troubleshooting](#troubleshooting)
- [Cost & Licensing](#cost--licensing)

---

## General Questions

### What is this project?

This is a Model Context Protocol (MCP) server that connects Claude (Anthropic's AI assistant) to your Snipe-IT asset management system. It allows you to query and manage your IT assets using natural language through Claude.

**Example:** Instead of logging into Snipe-IT and clicking through menus, you can ask Claude: "List all laptops assigned to the engineering team" and get instant results.

---

### Do I need this if I already have Snipe-IT?

You don't *need* it, but it makes Snipe-IT much easier to use:

**Without MCP Server:**
1. Open browser
2. Navigate to Snipe-IT
3. Click through multiple pages
4. Search/filter manually
5. Copy data if needed

**With MCP Server:**
1. Ask Claude in natural language
2. Get instant answer

**Time saved:** 60-90% on common queries

---

### Can Claude modify data in Snipe-IT?

**Yes, limited modifications:**
- Create assets
- Check out assets (assign to users/locations)
- Check in assets

**Cannot do:**
- Delete assets (not exposed for safety)
- Modify system settings
- Delete users or categories
- Change permissions

This is intentional for safety.

---

### Is this officially supported by Anthropic or Snipe-IT?

**No.** This is a community/custom implementation:
- Built using Anthropic's MCP SDK (official)
- Uses Snipe-IT's public API (official)
- Integration layer is custom (this project)

**Support:**
- Your IT team (primary)
- Community forums (secondary)
- Documentation (comprehensive)

---

## Installation & Setup

### What do I need to get started?

**Minimum requirements:**
- Computer with Node.js 18+ installed
- Snipe-IT instance (cloud or self-hosted)
- Snipe-IT API token
- Claude Desktop or Claude account

**For production (Cloudflare):**
- Cloudflare account
- Domain in Cloudflare
- Cloudflare One subscription ($7/user/month)

**Time:** 30 minutes (local) to 8 hours (full production)

---

### Do I need to be a developer?

**For local setup:** Basic command-line skills needed
- Copy/paste commands
- Edit text files
- Restart Claude Desktop

**For production:** Some technical knowledge helpful
- Understanding of DNS
- Basic server administration
- Cloudflare configuration

**Alternative:** Have your IT team set it up (follow PLAYBOOK.md)

---

### Can I run this on Windows?

**Yes**, but with some differences:

**Supported:**
- Node.js installation (Windows)
- Building the project (npm commands work)
- Running stdio version with Claude Desktop

**Different:**
- File paths use backslashes: `C:\path\to\project`
- Config file location: `%APPDATA%\Claude\`
- No launchd (use Task Scheduler or NSSM)

**Recommendation:** macOS or Linux for production deployments

---

### How long does setup take?

**Local only (stdio version):**
- Setup: 15 minutes
- Testing: 15 minutes
- **Total: 30 minutes**

**Production (HTTP + Cloudflare):**
- Local setup: 30 minutes
- Cloudflare setup: 2 hours
- Testing: 30 minutes
- Team onboarding: 1 hour
- **Total: 4-8 hours**

See PLAYBOOK.md for detailed timeline

---

## Security & Privacy

### Is this secure?

**Security score: 9.0/10** (see SECURITY-REVIEW-2.md)

**Built-in security:**
- HTTPS enforcement
- Input validation on all parameters
- Error message sanitization
- Request timeouts
- SSL certificate validation
- No SQL injection vectors
- No XSS vectors

**With Cloudflare (production):**
- SSO/SAML authentication
- Multi-factor authentication
- WAF protection
- DDoS mitigation
- Audit logging
- Rate limiting

---

### Where is my API token stored?

**Local development:**
- In `.env` file (not committed to git)
- In Claude Desktop config (local only)

**Production:**
- In environment variables on server
- In systemd/launchd config files (local to server)
- **Never** in source code
- **Never** in git repository

See SECRET-MANAGEMENT.md for complete guide

---

### Can others access my Snipe-IT data?

**Local (stdio) version:** No
- Runs only on your computer
- Only you can access

**Production (HTTP + Cloudflare):** Only authorized users
- Must be in Cloudflare Access policy
- Must authenticate (SSO/MFA)
- Must have valid session
- All access is logged

**Configure access in Cloudflare Access -> Applications**

---

### What data is logged?

**Server logs:**
- Timestamp of requests
- API endpoint called
- Success/error status
- Response time

**NOT logged:**
- API tokens
- Passwords
- Full Snipe-IT responses
- User queries (unless explicitly enabled)

**Cloudflare logs (production):**
- User authentication events
- Access attempts (allowed/denied)
- Request metadata
- Response status codes

---

### Is this HIPAA/SOC 2/GDPR compliant?

**The server itself:** Built with security best practices

**For compliance:**
- SOC 2: Use Cloudflare (SOC 2 Type II certified)
- GDPR: Configure data residency in Cloudflare
- HIPAA: Use Cloudflare Business Associate Agreement

**Your responsibility:**
- Proper access controls
- Audit logging enabled
- Regular security reviews
- API token rotation

See SECURITY.md for compliance details

---

## Usage & Features

### What can I ask Claude to do?

**Common queries:**
```
"List all assets in the system"
"Show me laptops assigned to John Smith"
"What's the status of asset #12345?"
"How many MacBook Pros do we have?"
"Create a new asset: Dell Latitude 7490, serial ABC123"
"Check out asset #100 to user ID 5"
"Show me all assets with status 'Deployed'"
"List users in the IT department"
```

**13 tools available:**
- list_assets, get_asset, create_asset
- checkout_asset, checkin_asset
- list_users, get_user
- list_models, list_categories
- list_locations, list_status_labels
- list_manufacturers, list_suppliers

---

### Can I create custom queries?

**Not directly**, but Claude is smart:

**Example 1:**
- You: "Show me all broken laptops"
- Claude uses: `list_assets` with status filter
- Result: Filtered list

**Example 2:**
- You: "How many assets does Alice have?"
- Claude:
  1. Searches users for Alice
  2. Gets her user ID
  3. Lists assets assigned to her
  4. Counts them

**Claude combines tools creatively to answer complex questions**

---

### Does this work offline?

**stdio version:** Requires internet
- Needs to reach Snipe-IT API (usually cloud)
- Claude Desktop needs internet

**HTTP version:** Requires internet
- Cloudflare Tunnel needs connection
- Snipe-IT API needs to be reachable

**Exception:** If Snipe-IT is self-hosted on local network, and you're on that network, it can work without external internet

---

### How fast are responses?

**Typical response times:**
- Simple queries (list assets): < 500ms
- Complex queries (multiple lookups): 1-2 seconds
- Create operations: < 1 second

**Factors affecting speed:**
- Snipe-IT server performance
- Network latency
- Query complexity
- Number of results

**Slow responses?** See TROUBLESHOOTING.md -> Performance Issues

---

## Cloudflare & Deployment

### Do I need Cloudflare?

**No, but it's recommended for production:**

**Without Cloudflare (stdio only):**
- Works locally on your computer
- Free
- Only you can access
- No remote access
- No SSO/MFA

**With Cloudflare (HTTP + tunnel):**
- Global access
- Team can use it
- Enterprise SSO/MFA
- WAF + DDoS protection
- Costs $7/user/month

---

### What is Cloudflare One?

**Cloudflare One** is Cloudflare's Zero Trust security platform:

**Includes:**
- Cloudflare Access (SSO/MFA)
- Cloudflare Tunnel (secure connections)
- Gateway (DNS filtering, optional)
- WARP (device client, optional)

**Cost:** $7/user/month

**For this project:** You primarily use Access and Tunnel

---

### Can I use free Cloudflare?

**Partially:**

**Free Cloudflare includes:**
- DNS management
- CDN
- Basic DDoS protection

**NOT included (need Cloudflare One):**
- Cloudflare Access (SSO/MFA)
- MCP Portals feature
- Advanced logging

**Alternative on free tier:**
- Use custom Workers gateway (see docs)
- Cost: $5/month total (unlimited users)
- Less features than MCP Portals

---

### Can I deploy without Cloudflare?

**Yes - local only:**

**Use stdio version:**
- Works with Claude Desktop locally
- No internet exposure
- No costs
- Personal use only

**Alternative cloud deployment:**
- Deploy to AWS/GCP/Azure with your own load balancer
- Set up your own authentication
- More complex, more control
- Not covered in these docs

---

### Do I need a domain?

**For local (stdio):** No

**For Cloudflare deployment:** Yes
- Need a domain in Cloudflare
- Can use subdomain: `mcp.yourdomain.com`
- Free domains work too

**Don't have a domain?**
- Register one ($10-15/year)
- Or use Cloudflare registrar ($9/year for .com)

---

## Troubleshooting

### "It's not working" - where do I start?

**Follow this checklist:**

1. **Check services are running:**
   ```bash
   ps aux | grep node
   ps aux | grep cloudflared
   ```

2. **Check health endpoint:**
   ```bash
   curl http://localhost:3000/health
   ```

3. **Check logs:**
   ```bash
   tail -f /tmp/snipeit-mcp.log
   ```

4. **See TROUBLESHOOTING.md** for specific errors

---

### Why can't Claude see my Snipe-IT tools?

**Common causes:**

1. **Config file wrong location**
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. **Invalid JSON syntax**
   - Missing comma
   - Wrong quotes
   - Unclosed brackets

3. **Wrong path to server**
   - Must be absolute path
   - Use `pwd` to get current directory

4. **Claude Desktop not restarted**
   - Quit completely
   - Reopen

**See TROUBLESHOOTING.md -> Claude Desktop Issues**

---

### Performance is slow - why?

**Common causes:**

1. **Slow Snipe-IT server**
   - Test API directly
   - Contact Snipe-IT admin

2. **Network latency**
   - Check ping times
   - Check traceroute

3. **Many results**
   - Use pagination
   - Add filters

4. **Cloudflare location**
   - May route through distant data center
   - Check Cloudflare analytics

---

### How do I update the server?

**Update dependencies:**
```bash
cd mcp-server
npm update
npm audit
```

**Update code:**
1. Download new version
2. Backup your `.env` file
3. Replace server files
4. Restore `.env`
5. Rebuild: `npm run build:all`
6. Restart services

**Recommended:** Monthly updates

---

## Cost & Licensing

### How much does this cost?

**Software:** Free (MIT License)

**Running costs:**

**Local only:**
- $0 - runs on your computer

**Production (Cloudflare):**
- Cloudflare One: $7/user/month
- Server hosting: $0 (your computer) to $10/month (cloud VM)
- **Total: $7-17/user/month**

**Examples:**
- 5 users: $35-85/month
- 25 users: $175-425/month
- 50 users: $350-850/month

---

### Can I use this commercially?

**Yes** - MIT License allows:
- Commercial use
- Modification
- Distribution
- Private use

**Just:**
- Keep license notice
- No warranty provided

---

### Do I need to pay for Claude?

**For Claude Desktop:**
- Free tier: Available
- Pro tier: $20/month (recommended for heavy use)

**The MCP server itself is free**, but you need Claude to use it

---

### What about Snipe-IT licensing?

**Snipe-IT is free and open source**
- AGPL v3 license
- Free to use
- Can self-host or use Snipe-IT Cloud

**Snipe-IT Cloud pricing:**
- Varies by number of assets
- Check snipeitapp.com for current pricing

---

## Still Have Questions?

### Where to find answers:

1. **README.md** - Project overview
2. **START-HERE.md** - Quick start guide
3. **PLAYBOOK.md** - Step-by-step deployment
4. **TROUBLESHOOTING.md** - Common issues
5. **SECURITY.md** - Security details
6. **SECRET-MANAGEMENT.md** - API key storage

### Contact:

- **Your IT team** (primary support)
- **Project documentation** (comprehensive)
- **Security reviews** (SECURITY-REVIEW-2.md)

---

**Last Updated:** 2025-02-13
**Version:** 1.0.0
