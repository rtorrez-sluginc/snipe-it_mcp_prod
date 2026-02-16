# Support - Snipe-IT MCP Server

**Getting help with your deployment**

---

## Quick Help

**Having an issue? Follow this flowchart:**

```
Is it working but you have a question?
├─ Yes -> See "Getting Help" below
└─ No -> Go to next question

Is it a security issue?
├─ Yes -> See SECURITY.md (don't open public issue!)
└─ No -> Go to next question

Is it covered in documentation?
├─ Check docs first -> See "Documentation" below
└─ Still stuck -> See "Getting Help" below

Is it a bug?
├─ Yes -> Open GitHub issue (see "Reporting Bugs")
└─ No -> See "Getting Help"
```

---

## Self-Service Resources

### Start Here (Most Common)

**1. Quick Start Issues?**
-> [START-HERE.md](START-HERE.md) - 30-minute setup guide

**2. Can't Connect?**
-> [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Connection issues section

**3. Server Crashes?**
-> [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Startup errors section

**4. Security Questions?**
-> [SECURITY.md](SECURITY.md) - Complete security documentation

**5. Where to Store API Key?**
-> [API-KEY-QUICK-REF.md](API-KEY-QUICK-REF.md) - Quick answer

---

### Complete Documentation

**Getting Started:**
- [README.md](README.md) - Project overview
- [START-HERE.md](START-HERE.md) - Quick start (30 min)
- [PLAYBOOK.md](PLAYBOOK.md) - Complete deployment (8 hours)

**Security:**
- [SECURITY.md](SECURITY.md) - Security documentation index
- [SECURITY-REVIEW-2.md](SECURITY-REVIEW-2.md) - Latest security audit
- [SECRET-MANAGEMENT.md](SECRET-MANAGEMENT.md) - How to store secrets
- [API-KEY-QUICK-REF.md](API-KEY-QUICK-REF.md) - Quick reference

**Operations:**
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues & solutions
- [MONITORING.md](MONITORING.md) - How to monitor deployment
- [DEPLOYMENT-CHECKLIST.md](DEPLOYMENT-CHECKLIST.md) - Pre-deployment checklist

**Reference:**
- [FAQ.md](FAQ.md) - Frequently asked questions
- [ARCHITECTURE.md](ARCHITECTURE.md) - How it works
- [TESTING.md](TESTING.md) - Testing guide

**Contributing:**
- [CONTRIBUTING.md](CONTRIBUTING.md) - How to contribute
- [CHANGELOG.md](CHANGELOG.md) - Version history

---

## Getting Help

### Option 1: Documentation (Fastest)

**95% of issues are covered in docs:**

| Issue | Documentation |
|-------|---------------|
| Setup problems | [START-HERE.md](START-HERE.md) |
| Can't connect | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| Security questions | [SECURITY.md](SECURITY.md) |
| Performance issues | [MONITORING.md](MONITORING.md) |
| Deployment help | [PLAYBOOK.md](PLAYBOOK.md) |

---

### Option 2: GitHub Discussions (Community)

**Best for:**
- General questions
- "How do I...?" questions
- Feature ideas discussion
- Sharing your setup

**Link:** https://github.com/YOUR_ORG/snipe-it_mcp_prod/discussions

---

### Option 3: GitHub Issues (Bug Reports)

**Best for:**
- Bugs / errors
- Feature requests
- Documentation errors

**Before opening issue:**
- [ ] Checked existing issues
- [ ] Read relevant documentation
- [ ] Can reproduce the issue
- [ ] Have all required information

**Link:** https://github.com/YOUR_ORG/snipe-it_mcp_prod/issues

---

## Reporting Bugs

### Required Information

```markdown
## Environment
- OS: [e.g., Ubuntu 22.04, macOS 14.2]
- Node.js version: [e.g., v20.11.0]
- npm version: [e.g., v10.2.4]
- Project version: [e.g., v1.0.0]

## Configuration (REDACT SECRETS!)
SNIPEIT_URL=https://snipeit.example.com
SNIPEIT_API_TOKEN=***REDACTED***
PORT=3000

## Steps to Reproduce
1. Start server with `npm run start:http`
2. Call health endpoint: `curl http://localhost:3000/health`
3. See error

## Expected Behavior
Should return: {"status":"healthy"}

## Actual Behavior
Returns: 500 Internal Server Error

## Error Messages
[paste error output]

## What I've Tried
- Checked Snipe-IT is running
- Verified API token
- Tested network connectivity
- Read troubleshooting docs
```

---

### Security Issues

**DO NOT open public issue!**

Instead:
1. Read [SECURITY.md](SECURITY.md)
2. Email: admin@yourdomain.com
3. Include description, steps to reproduce, potential impact

**We take security seriously and will respond within 48 hours.**

---

## Support Levels

### Community Support (Free)

- Access to all documentation
- GitHub Discussions
- Community help
- Bug reports
- Feature requests

**Response time:** Best effort (1-7 days)

---

### Professional Support (Paid)

- Everything in Community
- Priority support
- Direct contact
- Custom development
- Training sessions

**Response time:** 24 hours (business days)

**Contact:** admin@yourdomain.com

---

## Contact Information

### General Questions
- GitHub Discussions

### Bug Reports
- GitHub Issues

### Security Issues
- admin@yourdomain.com
- See [SECURITY.md](SECURITY.md)

---

## Response Times

| Channel | Response Time | Who Responds |
|---------|---------------|--------------|
| Documentation | Immediate | Self-service |
| GitHub Discussions | 1-3 days | Community |
| GitHub Issues | 1 week | Maintainers |
| Security Email | 48 hours | Security team |

---

**Thank you for using Snipe-IT MCP Server!**

---

**Last Updated:** 2025-02-13
**Version:** 1.0.0
**Support:** See contact information above
