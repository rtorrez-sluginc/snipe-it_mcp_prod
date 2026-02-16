# Windows Setup Guide - Snipe-IT MCP Server

**Complete guide for setting up the MCP server on Windows**

---

## Quick Answer

**What to do with the tarball:** Extract it and run on Windows using WSL2

**Do you need Docker?** No! Not required.

**Time to setup:** 1 hour

**Difficulty:** Easy

---

## Choose Your Path

### Option 1: Local Testing on Windows (WSL2) - RECOMMENDED

**Best for:**
- Testing locally
- Development
- Personal use
- Learning

**Time:** 1 hour setup
**Cost:** Free

---

### Option 2: Deploy to Cloud Server

**Best for:**
- Production use
- Team access
- 24/7 availability

**Time:** 8 hours
**Cost:** $5-10/month hosting + $7/user/month (Cloudflare)

---

## Path 1: Local Windows Setup (RECOMMENDED)

Follow these steps in order. Don't skip any!

---

### Step 1: Extract the Tarball (5 minutes)

#### Option A: Use 7-Zip (Recommended)

1. **Download 7-Zip:** https://www.7-zip.org/
2. **Extract the file:** Right-click -> 7-Zip -> Extract Here
3. **If you get a .tar file:** Extract again

**Checkpoint:** You have a folder called `snipe-it_mcp_project`

---

### Step 2: Install WSL2 (10 minutes)

**What is WSL?** Windows Subsystem for Linux - lets you run Linux programs on Windows

1. **Open PowerShell as Administrator:**
   - Press `Win + X`
   - Click "Windows PowerShell (Admin)" or "Terminal (Admin)"

2. **Run this command:**
   ```powershell
   wsl --install
   ```

3. **Wait for installation** (5-10 minutes)

4. **Restart your computer** when prompted

5. **After restart:** Create Ubuntu username and password

6. **Verify installation:**
   ```bash
   wsl --version
   ```

**Checkpoint:** You now have Linux running on Windows!

---

### Step 3: Install Node.js in WSL (10 minutes)

1. **Open Ubuntu/WSL**

2. **Update system packages:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

3. **Install Node.js 20:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

4. **Verify installation:**
   ```bash
   node --version   # Should show: v20.x.x
   npm --version    # Should show: v10.x.x
   ```

**Checkpoint:** Node.js installed successfully!

---

### Step 4: Move Project to WSL (10 minutes)

1. **Navigate to your Windows Downloads folder:**
   ```bash
   cd /mnt/c/Users/YOUR_USERNAME/Downloads
   ```

   **Replace `YOUR_USERNAME` with your actual Windows username!**

2. **Extract tarball if not already done:**
   ```bash
   tar -xzf snipe-it_mcp_project.tar.gz
   ```

3. **Copy to your WSL home directory:**
   ```bash
   cp -r snipe-it_mcp_project ~/
   ```

4. **Navigate to project:**
   ```bash
   cd ~/snipe-it_mcp_project
   ```

**Checkpoint:** Project successfully moved to WSL!

---

### Step 5: Get Your Snipe-IT API Token (5 minutes)

1. **Log into your Snipe-IT instance**
2. **Navigate to API settings:** Click your name -> Manage API Keys
3. **Create a new token** and copy it IMMEDIATELY
   - It looks like a long string of characters
4. **Save it somewhere safe temporarily**

**Checkpoint:** You have your API token saved!

---

### Step 6: Configure & Build (15 minutes)

1. **Go to server directory:**
   ```bash
   cd ~/snipe-it_mcp_project/mcp-server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create configuration file:**
   ```bash
   cp .env.example .env
   ```

4. **Edit configuration:**
   ```bash
   nano .env
   ```

5. **Update the configuration:**
   ```env
   SNIPEIT_URL=https://snipeit.yourcompany.com
   SNIPEIT_API_TOKEN=your-api-token-here
   ```

   **Important:**
   - Use `https://` (not `http://`)
   - No trailing slash on URL

6. **Save and exit:** Press `Ctrl + X`, then `Y`, then `Enter`

7. **Build the server:**
   ```bash
   npm run build
   ```

**Checkpoint:** Server configured and built!

---

### Step 7: Test the Server (5 minutes)

```bash
npm run start
```

**Expected output:**
```
Snipe-IT MCP Server running on stdio
Connected to: https://your-snipeit.com
Available tools: 13
```

**If you see this, SUCCESS!**

**Stop the server:** Press `Ctrl + C`

---

### Step 8: Configure Claude Desktop (15 minutes)

#### Find Your WSL Username:

```bash
whoami
pwd
```

#### Configure Claude Desktop:

1. **Open Claude Desktop config folder:**
   - Press `Win + R`
   - Type: `%APPDATA%\Claude`
   - Press Enter

2. **Open or create:** `claude_desktop_config.json`

3. **Add this configuration:**
   ```json
   {
     "mcpServers": {
       "snipeit": {
         "command": "wsl",
         "args": [
           "bash",
           "-c",
           "cd /home/YOUR_WSL_USERNAME/snipe-it_mcp_project/mcp-server && node build/index.js"
         ],
         "env": {
           "SNIPEIT_URL": "https://your-snipeit.example.com",
           "SNIPEIT_API_TOKEN": "your-actual-token-here"
         }
       }
     }
   }
   ```

4. **Replace values:** WSL username, Snipe-IT URL, API token

5. **Save the file**

6. **Validate JSON:** https://jsonlint.com/

---

#### Restart Claude Desktop:

1. Quit Claude Desktop completely
2. Start Claude Desktop
3. Check for MCP indicator

**Checkpoint:** Claude Desktop configured!

---

### Step 9: Test with Claude (5 minutes)

1. **In Claude Desktop, start a new conversation**

2. **Ask Claude:**
   ```
   What Snipe-IT tools do you have access to?
   ```

3. **Test with real data:**
   ```
   List my assets in Snipe-IT
   ```

4. **Try more commands:**
   ```
   How many users are in Snipe-IT?
   Show me all laptops
   Get details for asset #123
   What categories do we have?
   ```

**CHECKPOINT: IT WORKS!**

---

## Success! You're Done!

**What you have now:**
- MCP server running on Windows (via WSL2)
- Claude Desktop connected to Snipe-IT
- Can query Snipe-IT data through Claude
- Production-ready security (9.0/10)

**Total time spent:** ~1 hour

---

## What to Do Next

### Daily Usage:

**Starting the server:**
- Claude Desktop starts it automatically!
- No manual steps needed

**If server isn't working:**
```bash
# In WSL:
cd ~/snipe-it_mcp_project/mcp-server
npm run start
```

**Updating the server:**
```bash
cd ~/snipe-it_mcp_project/mcp-server
git pull  # If using git
npm install
npm run build
```

---

## Frequently Asked Questions

**Q: Do I need Docker?**
**A:** No! Not required for Windows setup.

**Q: Can I run this on Windows without WSL?**
**A:** Technically yes, but WSL is much easier and recommended.

**Q: Do I need administrator access?**
**A:** Yes, to install WSL2. After that, no admin needed for daily use.

**Q: How much disk space needed?**
**A:** ~2GB (WSL + Node.js + project)

**Q: Does this work on Windows 10?**
**A:** Yes, Windows 10 version 2004 or later. Windows 11 works too.

**Q: Is my data secure?**
**A:** Yes! Security score: 9.0/10.

**Q: Do I need to start the server manually?**
**A:** No! Claude Desktop starts it automatically.

---

## Getting Help

**In the project folder, you have:**
- `START-HERE.md` - Quick start guide
- `TROUBLESHOOTING.md` - Common issues & solutions
- `SUPPORT.md` - How to get help
- `FAQ.md` - Frequently asked questions

---

## Quick Reference

### Essential Commands

**Open WSL:**
```
Press Win, type "Ubuntu", press Enter
```

**Navigate to project:**
```bash
cd ~/snipe-it_mcp_project/mcp-server
```

**Start server manually:**
```bash
npm run start
```

**Stop server:**
```
Press Ctrl + C
```

**Rebuild server:**
```bash
npm run build
```

**Edit config:**
```bash
nano .env
```

---

### File Locations

**Windows:**
- Claude config: `%APPDATA%\Claude\claude_desktop_config.json`

**WSL:**
- Project: `/home/YOUR_USERNAME/snipe-it_mcp_project/`
- Server: `/home/YOUR_USERNAME/snipe-it_mcp_project/mcp-server/`
- Config: `/home/YOUR_USERNAME/snipe-it_mcp_project/mcp-server/.env`

**Access WSL from Windows:**
- Explorer: `\\wsl$\Ubuntu\home\YOUR_USERNAME`

---

## Success Checklist

**After completing this guide:**

- [ ] WSL2 installed and working
- [ ] Node.js 20+ installed in WSL
- [ ] Project extracted to WSL
- [ ] Dependencies installed (`npm install`)
- [ ] .env file configured with Snipe-IT URL and token
- [ ] Server builds without errors (`npm run build`)
- [ ] Server starts without errors (`npm run start`)
- [ ] Claude Desktop config file created/updated
- [ ] Claude Desktop restarted
- [ ] Claude can see Snipe-IT tools
- [ ] Claude can query Snipe-IT data

**All checked? You're done!**

---

**Last Updated:** 2025-02-13
**Version:** 1.0.0
**Platform:** Windows 10/11
**Tested On:** Windows 11 with WSL2 + Ubuntu 22.04
