# Monitoring Guide - Snipe-IT MCP Server

**How to monitor, alert, and maintain production deployments**

---

## Overview

This guide covers monitoring your Snipe-IT MCP server in production to ensure:
- High availability (99.9% uptime target)
- Fast performance (<2s response time)
- Early problem detection
- Quick incident response

**Monitoring Levels:**
- **Basic:** Health checks + logs (free)
- **Standard:** + Cloudflare Analytics (free)
- **Advanced:** + External monitoring (e.g., UptimeRobot, $5/mo)
- **Enterprise:** + APM tools (e.g., DataDog, $15/mo+)

---

## What to Monitor

### Critical Metrics

**1. Availability (Uptime)**
- Target: >99.9% (< 43 minutes downtime/month)
- Check: Every 5 minutes
- Alert: Immediately if down

**2. Response Time**
- Target: <2 seconds (95th percentile)
- Check: Every request
- Alert: If >5 seconds for 5 minutes

**3. Error Rate**
- Target: <1% of requests
- Check: Every minute
- Alert: If >5% for 5 minutes

**4. Authentication Success**
- Target: >95% success rate
- Check: Every auth attempt
- Alert: If <90% for 10 minutes

---

## Basic Monitoring (Free)

### Health Check Endpoint

**Built-in health check:**
```bash
curl https://mcp.yourdomain.com/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-02-13T12:00:00Z"
}
```

**Monitor with cron:**
```bash
# Add to crontab: crontab -e
*/5 * * * * curl -f https://mcp.yourdomain.com/health || echo "ALERT: MCP server down!" | mail -s "MCP Alert" admin@yourdomain.com
```

---

### System Logs

**View server logs:**
```bash
# On server
sudo journalctl -u snipeit-mcp -f

# Last 100 lines
sudo journalctl -u snipeit-mcp -n 100

# Errors only
sudo journalctl -u snipeit-mcp -p err

# Today's logs
sudo journalctl -u snipeit-mcp --since today

# Search for specific error
sudo journalctl -u snipeit-mcp | grep "401"
```

**Tunnel logs:**
```bash
# Cloudflare tunnel logs
sudo journalctl -u cloudflared -f
sudo journalctl -u cloudflared -n 100
```

**Watch logs in real-time:**
```bash
# Watch both services
watch -n 5 'sudo journalctl -u snipeit-mcp -n 20 && echo "---" && sudo journalctl -u cloudflared -n 20'
```

---

### System Resources

**Monitor CPU/Memory:**
```bash
# Real-time monitoring
htop

# Or basic top
top

# Specific to Node.js process
ps aux | grep node

# Memory usage
free -h

# Disk space
df -h
```

**Automated resource monitoring:**
```bash
# Add to crontab
*/15 * * * * /usr/local/bin/check-resources.sh
```

**check-resources.sh:**
```bash
#!/bin/bash

# Get memory usage
MEM_USAGE=$(free | grep Mem | awk '{print ($3/$2) * 100.0}')
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')

# Alert if high
if (( $(echo "$MEM_USAGE > 80" | bc -l) )); then
    echo "High memory usage: ${MEM_USAGE}%" | mail -s "Memory Alert" admin@yourdomain.com
fi

if (( DISK_USAGE > 80 )); then
    echo "High disk usage: ${DISK_USAGE}%" | mail -s "Disk Alert" admin@yourdomain.com
fi
```

---

## Cloudflare Analytics (Free)

### Enable Analytics

**In Cloudflare Dashboard:**
1. Go to your domain
2. Analytics -> Traffic
3. View traffic to mcp.yourdomain.com

**Metrics available:**
- Requests per minute/hour/day
- Bandwidth usage
- Response status codes (200, 401, 403, 404, 500, etc.)
- Geographic distribution
- Top paths/endpoints

---

### Access Logs

**View authentication attempts:**
1. Cloudflare Dashboard
2. Zero Trust -> Logs -> Access
3. Filter by application: mcp.yourdomain.com

**What to monitor:**
- Failed login attempts (high rate = brute force?)
- Login from unusual locations
- Login outside business hours
- Multiple failed attempts same user

---

### Gateway Logs (MCP Portals)

**View AI-specific activity:**
1. Cloudflare Dashboard
2. Zero Trust -> Logs -> Gateway
3. Filter by AI Controls / MCP Portals

**What to monitor:**
- Tool usage patterns
- Prompt content (if enabled)
- Data access patterns
- Rate limit hits
- DLP violations

---

## Alert Configuration

### Basic Email Alerts

**Using cron + email:**
```bash
# Health check failure
*/5 * * * * curl -f https://mcp.yourdomain.com/health || echo "MCP server down!" | mail -s "CRITICAL: MCP Down" admin@yourdomain.com

# High error rate
*/5 * * * * sudo journalctl -u snipeit-mcp --since "5 minutes ago" | grep -c "Error:" | awk '{if ($1 > 10) print "High error rate: " $1 " errors in 5 minutes"}' | mail -s "MCP Error Alert" admin@yourdomain.com
```

---

### Slack Alerts

**Using webhook:**
```bash
#!/bin/bash
# alert-slack.sh

WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
MESSAGE="$1"

curl -X POST -H 'Content-type: application/json' \
  --data "{\"text\":\"${MESSAGE}\"}" \
  ${WEBHOOK_URL}
```

**Usage:**
```bash
# In cron job
*/5 * * * * curl -f https://mcp.yourdomain.com/health || /usr/local/bin/alert-slack.sh "MCP server is down!"
```

---

### PagerDuty Integration

**Install PagerDuty agent:**
```bash
# Follow PagerDuty docs for your OS
# Configure integration key

# Create incident
pd-send -k YOUR_INTEGRATION_KEY -t trigger \
  -d "MCP server health check failed" \
  -i mcp-health-check
```

**In cron:**
```bash
*/5 * * * * curl -f https://mcp.yourdomain.com/health || pd-send -k KEY -t trigger -d "MCP down" -i mcp-down
```

---

## Advanced Monitoring

### UptimeRobot (Free/Paid)

**Setup:**
1. Go to uptimerobot.com
2. Create account (free tier: 50 monitors)
3. Add HTTP monitor
   - Name: Snipe-IT MCP Server
   - URL: https://mcp.yourdomain.com/health
   - Interval: 5 minutes
   - Alert when: Down
   - Alert via: Email, SMS, Slack, etc.

**Advantages:**
- External monitoring (detects ISP/network issues)
- Free tier available
- Multiple notification channels
- Status page creation

---

### Prometheus + Grafana (Free, Self-Hosted)

**Setup Prometheus:**
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'snipeit-mcp'
    static_configs:
      - targets: ['your-server-ip:9090']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

**Add metrics endpoint to MCP server:**
```typescript
// In src-http/index.ts
import promClient from 'prom-client';

const register = new promClient.Register();

// Create metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

---

## Alert Rules

### Critical Alerts (Page Immediately)

**Server Down:**
```
Condition: Health check fails for 2 consecutive checks
Action: Page on-call engineer
Channel: PagerDuty, SMS
```

**High Error Rate:**
```
Condition: >10% error rate for 5 minutes
Action: Page on-call engineer
Channel: PagerDuty, Slack
```

**Authentication Bypass Attempt:**
```
Condition: 10+ failed auth attempts from same IP in 1 minute
Action: Alert security team, block IP
Channel: Email, Slack #security
```

---

### Warning Alerts (Can Wait)

**Slow Response:**
```
Condition: 95th percentile > 5 seconds for 10 minutes
Action: Create ticket
Channel: Slack #ops
```

**High Memory Usage:**
```
Condition: >80% memory for 15 minutes
Action: Investigate and optimize
Channel: Email, Slack #ops
```

**Disk Space Low:**
```
Condition: <20% disk free
Action: Clean up or expand storage
Channel: Email, Slack #ops
```

---

## Monitoring Checklist

### Daily

- [ ] Check health endpoint
- [ ] Review error logs (last 24h)
- [ ] Check resource usage (CPU, memory, disk)
- [ ] Verify Cloudflare Access logs
- [ ] Review any alerts received

### Weekly

- [ ] Review performance trends
- [ ] Check for security events
- [ ] Update monitoring thresholds if needed
- [ ] Test alerting (send test alert)
- [ ] Review Cloudflare Analytics

### Monthly

- [ ] Generate uptime report
- [ ] Review SLA compliance
- [ ] Capacity planning review
- [ ] Update documentation
- [ ] Security audit logs review

---

## SLA Targets

### Availability

**Production:**
- Target: 99.9% (< 43 min downtime/month)
- Measurement: External health checks
- Reporting: Monthly

**Development:**
- Target: 99% (< 7 hours downtime/month)
- Measurement: Internal health checks
- Reporting: Quarterly

---

### Performance

**Response Time:**
- p50: < 1 second
- p95: < 2 seconds
- p99: < 5 seconds

**Error Rate:**
- Target: < 1% of requests
- Critical threshold: 5%
- Measurement: HTTP 5xx responses

---

### Recovery

**MTTR (Mean Time To Recovery):**
- Critical: < 30 minutes
- High: < 2 hours
- Medium: < 1 business day
- Low: < 1 week

---

## Tools Comparison

| Tool | Cost | Difficulty | Features |
|------|------|------------|----------|
| **cron + curl** | Free | Easy | Basic health checks |
| **Cloudflare Analytics** | Free | Easy | Traffic, errors, geo |
| **UptimeRobot** | Free-$58/mo | Easy | External monitoring, alerts |
| **Pingdom** | $10-72/mo | Medium | RUM, transactions, SLA |
| **Prometheus+Grafana** | Free | Hard | Custom metrics, dashboards |
| **DataDog** | $15+/host/mo | Medium | APM, logs, traces, AI |
| **New Relic** | $25+/mo | Medium | APM, browser, mobile |

---

## Best Practices

1. **Start Simple:** Health checks + logs
2. **Add External:** UptimeRobot for external view
3. **Enable Analytics:** Cloudflare (already there)
4. **Set Alerts:** Email -> Slack -> PagerDuty
5. **Review Regularly:** Weekly metrics review
6. **Iterate:** Improve thresholds based on patterns

---

**Last Updated:** 2025-02-13
**Version:** 1.0.0
**Status:** Production-tested monitoring guide
