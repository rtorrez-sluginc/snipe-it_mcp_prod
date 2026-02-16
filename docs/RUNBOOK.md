# Operations Runbook

**Day-to-day operations guide for Snipe-IT MCP Server**

---

## Quick Reference

**Service URL:** https://mcp.yourdomain.com
**Status Dashboard:** https://dash.cloudflare.com
**Logs Location:** `/tmp/snipeit-mcp*.log`
**Config Location:** `~/.cloudflared/config.yml`

---

## Daily Operations

### Morning Checks (5 minutes)

```bash
# 1. Check health
curl https://mcp.yourdomain.com/health

# Expected: {"status":"healthy","timestamp":"..."}

# 2. Check services running
ps aux | grep node
ps aux | grep cloudflared

# 3. Check recent errors
tail -50 /tmp/snipeit-mcp-error.log | grep -i error

# 4. Review usage
# Go to Cloudflare Dashboard -> Analytics
```

---

## Service Management

### Start Services

**macOS (launchd):**
```bash
# Start MCP server
launchctl start com.snipeit.mcp

# Start Cloudflare tunnel
launchctl start com.cloudflare.tunnel

# Verify running
launchctl list | grep snipeit
launchctl list | grep cloudflare
```

**Linux (systemd):**
```bash
# Start MCP server
sudo systemctl start snipeit-mcp

# Start Cloudflare tunnel
sudo systemctl start cloudflared

# Verify running
sudo systemctl status snipeit-mcp
sudo systemctl status cloudflared
```

---

### Stop Services

**macOS:**
```bash
launchctl stop com.snipeit.mcp
launchctl stop com.cloudflare.tunnel
```

**Linux:**
```bash
sudo systemctl stop snipeit-mcp
sudo systemctl stop cloudflared
```

---

### Restart Services

**macOS:**
```bash
launchctl stop com.snipeit.mcp
launchctl start com.snipeit.mcp

launchctl stop com.cloudflare.tunnel
launchctl start com.cloudflare.tunnel
```

**Linux:**
```bash
sudo systemctl restart snipeit-mcp
sudo systemctl restart cloudflared
```

---

## Monitoring

### View Logs

**Real-time logs:**
```bash
# MCP server logs
tail -f /tmp/snipeit-mcp.log

# Error logs
tail -f /tmp/snipeit-mcp-error.log

# Cloudflare tunnel logs
tail -f /tmp/cloudflared.log

# All logs together
tail -f /tmp/snipeit-mcp*.log /tmp/cloudflared.log
```

**Search logs:**
```bash
# Find errors
grep -i error /tmp/snipeit-mcp.log

# Find authentication issues
grep -i auth /tmp/snipeit-mcp.log

# Count errors today
grep "$(date +%Y-%m-%d)" /tmp/snipeit-mcp.log | grep -i error | wc -l
```

---

### Check Performance

**Response time:**
```bash
curl -w "@/tmp/curl-format.txt" -o /dev/null -s https://mcp.yourdomain.com/health
```

**Expected:**
- time_total: < 0.5s (500ms)
- time_starttransfer: < 0.3s

---

## Common Issues

### Issue: Server Won't Start

**Diagnosis:**
```bash
# Check if port 3000 is in use
lsof -i :3000

# Check recent errors
tail -50 /tmp/snipeit-mcp-error.log
```

**Solutions:**

**1. Port in use:**
```bash
kill $(lsof -t -i:3000)
```

**2. Missing environment variables:**
```bash
ls -la mcp-server/.env
cat mcp-server/.env
```

---

### Issue: Tunnel Won't Connect

**Diagnosis:**
```bash
tail -50 /tmp/cloudflared.log
```

**Solutions:**

**1. Tunnel not authenticated:**
```bash
cloudflared tunnel login
```

**2. Wrong tunnel ID in config:**
```bash
cloudflared tunnel list
nano ~/.cloudflared/config.yml
```

**3. MCP server not running:**
```bash
curl http://localhost:3000/health
```

---

### Issue: Authentication Failing

**Solutions:**

**1. User not in policy:**
- Go to Cloudflare Access -> Applications
- Edit application
- Check "Include" rules
- Add user's email

**2. MFA not working:**
- User should clear cookies
- Try different MFA method

---

### Issue: Slow Performance

**Diagnosis:**
```bash
# Test direct to MCP server
time curl http://localhost:3000/health

# Test through Cloudflare
time curl https://mcp.yourdomain.com/health

# Test Snipe-IT API
time curl -H "Authorization: Bearer $SNIPEIT_API_TOKEN" \
  $SNIPEIT_URL/api/v1/statuslabels
```

---

## Maintenance Tasks

### Weekly

**1. Review logs:**
```bash
grep error /tmp/snipeit-mcp.log | tail -50
```

**2. Check access logs:** Cloudflare Access -> Logs

**3. Archive logs:**
```bash
cd /tmp
tar -czf snipeit-logs-$(date +%Y%m%d).tar.gz snipeit-mcp*.log
rm snipeit-mcp*.log
```

---

### Monthly

**1. Update dependencies:**
```bash
cd mcp-server
npm update
npm audit
npm audit fix
npm run build:all
```

**2. Restart services after updates**

**3. Review access list** - remove former employees, add new team members

---

### Quarterly

**1. Rotate API token:**
```bash
# 1. Generate new token in Snipe-IT
# 2. Update .env file
nano mcp-server/.env

# 3. Reload service
# 4. Test
curl http://localhost:3000/health
```

**2. Security review** - npm audit, review access logs

**3. Backup configurations:**
```bash
tar -czf snipeit-mcp-backup-$(date +%Y%m%d).tar.gz \
  mcp-server/.env \
  ~/.cloudflared/config.yml
```

---

## Escalation

### Level 1: Self-Service (0-1 hour)
1. Check this runbook
2. Check TROUBLESHOOTING.md
3. Review recent logs
4. Restart services
5. Test again

### Level 2: Admin Support (1-4 hours)
- Contact: Primary Admin - [Name] - [Email]
- Response time: 1 hour during business hours

### Level 3: Vendor Support (4-24 hours)
- Cloudflare: Enterprise support portal
- Snipe-IT: support@snipeitapp.com
- Security: [Your security team]

---

## Security Operations

### Monitor Failed Logins

Check Cloudflare Access logs for:
- Failed authentication attempts
- Unusual login patterns
- Access from new locations

### Incident Response

**If security incident:**

1. **Contain:** Disable affected user, rotate API token if needed
2. **Investigate:** Review logs, identify scope
3. **Remediate:** Fix vulnerability, update controls
4. **Report:** Notify security team, document incident

---

## Quick Commands Reference

```bash
# Health check
curl https://mcp.yourdomain.com/health

# Restart MCP server (macOS)
launchctl restart com.snipeit.mcp

# Restart tunnel (macOS)
launchctl restart com.cloudflare.tunnel

# View logs
tail -f /tmp/snipeit-mcp.log

# Search for errors
grep -i error /tmp/snipeit-mcp.log | tail -20

# Check services
ps aux | grep node
ps aux | grep cloudflared

# Check port
lsof -i :3000

# Test Snipe-IT
curl -H "Authorization: Bearer $SNIPEIT_API_TOKEN" \
  $SNIPEIT_URL/api/v1/statuslabels
```

---

**Last Updated:** 2025-02-13
**Version:** 1.0.0
**Maintained By:** [Your Organization]
