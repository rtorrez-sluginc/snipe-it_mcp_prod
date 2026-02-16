# Secret Management Guide - API Keys & Credentials

**How to securely store your Snipe-IT API token and other secrets**

---

## NEVER DO THIS

```bash
# NEVER commit secrets to GitHub
export SNIPEIT_API_TOKEN="your-api-token-here"  # In a file tracked by git

# NEVER hardcode in source code
const API_TOKEN = "your-api-token-here";

# NEVER put in public documentation
# README.md
SNIPEIT_API_TOKEN=your-api-token-here
```

**Why?** Once committed to git, it's in history forever, even if you delete it!

---

## RECOMMENDED: Secret Storage by Use Case

### Option 1: Local Development (Just You) - SIMPLEST

**Use `.env` file (already in `.gitignore`)**

```bash
# In mcp-server/.env (NEVER commit this file!)
SNIPEIT_URL=https://your-snipeit.example.com
SNIPEIT_API_TOKEN=your-api-token-here
```

**Advantages:**
- Simple and fast
- Works immediately
- Already configured (see `.gitignore`)

**Disadvantages:**
- Only on your machine
- Need to recreate on new machines
- Not backed up

**Security:** Good for solo development

---

### Option 2: Team Sharing - 1Password - RECOMMENDED FOR TEAMS

**Store in 1Password, share with team**

#### Setup:

1. **Create 1Password vault item:**
   ```
   Title: Snipe-IT MCP Server - Production
   Type: API Credential

   Fields:
   - SNIPEIT_URL: https://snipeit.example.com
   - SNIPEIT_API_TOKEN: [your token]
   - Environment: Production
   - Created: 2025-02-13
   - Rotation Schedule: Quarterly
   ```

2. **Share with team:**
   - Create shared vault: "Engineering Secrets"
   - Add team members
   - Grant read-only access

3. **Use with 1Password CLI:**
   ```bash
   # Install 1Password CLI
   brew install 1password-cli

   # Sign in
   eval $(op signin)

   # Load secrets into environment
   export SNIPEIT_URL=$(op read "op://Engineering/Snipe-IT MCP/SNIPEIT_URL")
   export SNIPEIT_API_TOKEN=$(op read "op://Engineering/Snipe-IT MCP/SNIPEIT_API_TOKEN")

   # Run server
   npm run start:http
   ```

---

### Option 3: GitHub Secrets (for CI/CD)

**Store in GitHub repository secrets**

1. Go to repository -> Settings -> Secrets and variables -> Actions
2. Add: `SNIPEIT_URL` and `SNIPEIT_API_TOKEN`

3. **Use in GitHub Actions:**
   ```yaml
   # .github/workflows/test.yml
   name: Test MCP Server

   on: [push]

   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-node@v3

         - name: Install dependencies
           run: cd mcp-server && npm install

         - name: Build
           run: cd mcp-server && npm run build:all

         - name: Test
           env:
             SNIPEIT_URL: ${{ secrets.SNIPEIT_URL }}
             SNIPEIT_API_TOKEN: ${{ secrets.SNIPEIT_API_TOKEN }}
           run: cd mcp-server && npm test
   ```

---

### Option 4: Cloudflare Secrets - FOR PRODUCTION

```bash
# For Cloudflare Workers Gateway
wrangler secret put SNIPEIT_API_TOKEN
# Paste your token when prompted
```

---

### Option 5: Cloud Provider Secret Managers - ENTERPRISE

#### AWS Secrets Manager:
```bash
aws secretsmanager create-secret \
  --name snipeit/api-token \
  --secret-string "your-token-here"
```

#### GCP Secret Manager:
```bash
echo -n "your-token-here" | \
  gcloud secrets create snipeit-api-token --data-file=-
```

#### Azure Key Vault:
```bash
az keyvault secret set \
  --vault-name MyKeyVault \
  --name SnipeITApiToken \
  --value "your-token-here"
```

---

## Best Practices

### 1. Never Commit Secrets

```bash
# Double-check .gitignore includes:
.env
.env.local
.env.production
*.key
*.pem
credentials.json
secrets.json
```

### 2. Use Different Secrets Per Environment

```
Development: dev-api-token-abc123
Staging: stage-api-token-def456
Production: prod-api-token-ghi789
```

### 3. Rotate Secrets Regularly

**Schedule:**
- Development: Every 6 months
- Staging: Every quarter
- Production: Every quarter (or monthly for high security)
- After team member leaves: Immediately

### 4. Limit Access

**Principle of Least Privilege:**
- Developers: Read-only access to dev/staging secrets
- DevOps: Read-write access to all secrets
- Managers: Read-only access to production secrets

### 5. Audit Secret Access

**Enable logging:**
- 1Password: Access logs
- AWS Secrets Manager: CloudTrail
- GitHub: Audit log
- Cloudflare: Access logs

### 6. Have a Breach Response Plan

**If secret is compromised:**
1. Immediately rotate the secret
2. Review logs for unauthorized access
3. Notify security team
4. Update all systems
5. Document incident
6. Review how it happened

---

## Quick Decision Guide

| Situation | Recommended Solution | Setup Time |
|-----------|---------------------|------------|
| Just me, testing locally | `.env` file | 2 minutes |
| Small team (2-5) | 1Password | 10 minutes |
| Medium team (5-20) | 1Password + GitHub Secrets | 20 minutes |
| Large team (20-50) | 1Password + GitHub + Cloud | 1 hour |
| Enterprise (50+) | Cloud Secret Manager | 2 hours |

---

## FAQ

**Q: Can I commit .env.example?**
**A:** Yes! It should have placeholder values only:
```env
SNIPEIT_URL=https://your-snipeit-instance.com
SNIPEIT_API_TOKEN=your-api-token-here
```

**Q: What if I accidentally commit a secret?**
**A:**
1. Immediately rotate the secret
2. Remove from git history: `git filter-branch` or BFG Repo-Cleaner
3. Force push: `git push --force`
4. Notify team

**Q: How do I know if .env is gitignored?**
**A:**
```bash
git check-ignore .env
# Should output: .env
```

---

**Bottom line:** Use `.env` locally (already configured), backup to 1Password, never commit to GitHub!
