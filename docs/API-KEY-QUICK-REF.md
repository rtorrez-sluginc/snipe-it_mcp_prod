# API Key Storage - Quick Reference

**Where should you store your Snipe-IT API token?**

---

## Quick Answer

### For Right Now (Local Testing):

**Use `.env` file**

```bash
cd mcp-server
cp .env.example .env
nano .env
```

Add:
```env
SNIPEIT_URL=https://your-snipeit.example.com
SNIPEIT_API_TOKEN=your-api-token-here
```

**This file is already in `.gitignore` - safe to use!**

**Time:** 2 minutes

---

### For Team Sharing:

**Use 1Password** RECOMMENDED

1. Store API token in 1Password
2. Create shared vault "Engineering Secrets"
3. Share with team
4. Team copies to their local `.env`

**Cost:** $7.99/user/month (or $4/user with Teams)

**Time:** 10 minutes

---

### For Production:

**Use Cloudflare Secrets** (if using Cloudflare deployment)

```bash
wrangler secret put SNIPEIT_API_TOKEN
# Paste your token when prompted
```

**Or use cloud secret manager** (AWS/GCP/Azure)

**Cost:** Free (Cloudflare) or $0.40/month (AWS Secrets Manager)

**Time:** 15 minutes

---

## NEVER Do This

```bash
# NEVER commit to GitHub
git add .env  # NO!

# NEVER hardcode in files
const TOKEN = "your-api-token-here"  # NO!

# NEVER put in public docs
# README.md
SNIPEIT_API_TOKEN=your-api-token-here  # NO!
```

---

## What's Already Configured

Your project already has:

- `.gitignore` includes `.env`
- `.env.example` template (safe to commit)
- Code reads from `process.env`
- No secrets in source code

**You just need to create `.env` and add your token!**

---

## Recommended Path

### Today:
1. Create `.env` file locally (2 minutes)
2. Test it works (5 minutes)

### This Week:
3. Store backup in 1Password (10 minutes)
4. Share with team if needed (5 minutes)

### Before Production:
5. Move to Cloudflare secrets or cloud secret manager (15 minutes)
6. Set rotation reminder (quarterly)

---

## Full Details

See **[SECRET-MANAGEMENT.md](SECRET-MANAGEMENT.md)** for complete guide including:
- Step-by-step for each option
- Team sharing with 1Password CLI
- GitHub Secrets for CI/CD
- AWS/GCP/Azure secret managers
- Best practices
- Rotation schedules
- Breach response

---

## Quick FAQ

**Q: Is `.env` safe?**
**A:** Yes, if it's in `.gitignore` (it is) and never committed to git.

**Q: Do I need 1Password?**
**A:** Not required, but recommended for teams and as backup.

**Q: Can I use LastPass/Bitwarden instead?**
**A:** Yes! Any password manager works. See SECRET-MANAGEMENT.md for details.

**Q: What if I accidentally commit .env?**
**A:**
1. Delete the file
2. Rotate the secret immediately
3. Never push to GitHub
4. See SECRET-MANAGEMENT.md for git history cleanup

**Q: How often should I rotate?**
**A:** Quarterly for production, every 6 months for dev/staging.

---

## Bottom Line

**For local development:** `.env` file (already configured)

**For team:** 1Password

**For production:** Cloudflare secrets or cloud secret manager

**Never:** Commit to GitHub!

---

**See [SECRET-MANAGEMENT.md](SECRET-MANAGEMENT.md) for complete guide**
