# 💬 Slack /precheck Integration Setup Guide

## Overview

The `/precheck` slash command lets interviewers instantly check any interview question for bias directly from Slack.

**Usage:**
```
/precheck Are you married?
/precheck What programming languages do you know?
/precheck How old are you?
```

---

## Step 1 — Create a Slack App

1. Go to **https://api.slack.com/apps**
2. Click **"Create New App"** → **"From scratch"**
3. App Name: `Interview Audit Bot`
4. Pick your workspace → **"Create App"**

---

## Step 2 — Configure Slash Command

1. In your app settings → **"Slash Commands"**
2. Click **"Create New Command"**
3. Fill in:
   - **Command:** `/precheck`
   - **Request URL:** `https://YOUR_DOMAIN/api/slack/precheck`
   - **Short Description:** `Check an interview question for bias`
   - **Usage Hint:** `[your interview question]`
4. Click **"Save"**

---

## Step 3 — Get Credentials

1. Go to **"Basic Information"** → copy **Signing Secret**
2. Go to **"OAuth & Permissions"** → copy **Bot Token** (`xoxb-...`)

Paste into `backend/.env`:
```env
SLACK_SIGNING_SECRET=your_signing_secret
SLACK_BOT_TOKEN=xoxb-your-bot-token
```

---

## Step 4 — Set Bot Permissions

1. Go to **"OAuth & Permissions"** → **"Scopes"** → **"Bot Token Scopes"**
2. Add: `commands`, `chat:write`, `chat:write.public`
3. Click **"Install to Workspace"**

---

## Step 5 — Expose Backend (Development)

Use ngrok for local development:
```bash
npm install -g ngrok
ngrok http 5000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`) and update:
- Your Slack slash command Request URL
- `FRONTEND_URL` in `backend/.env`

---

## Step 6 — Test It!

In any Slack channel:
```
/precheck What programming languages do you know?
```

You should see an instant response card with:
- ✅ SAFE verdict + confidence score
- Legal compliance note
- Link to audit dashboard

Try a flagged one:
```
/precheck Are you planning to have children?
```

---

## Slack App Manifest (optional)

You can also create the app from this manifest:

```yaml
display_information:
  name: Interview Audit Bot
  description: AI-powered interview question bias checker
  background_color: "#080C10"
features:
  slash_commands:
    - command: /precheck
      url: https://YOUR_DOMAIN/api/slack/precheck
      description: Check an interview question for bias
      usage_hint: "[your interview question]"
      should_escape: false
  bot_user:
    display_name: Interview Audit Bot
    always_online: true
oauth_config:
  scopes:
    bot:
      - commands
      - chat:write
      - chat:write.public
settings:
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
```
