# Deployment Guide - Flaky Test Autopilot Action

## Overview

This guide explains how to deploy the Flaky Test Autopilot GitHub Action so users can install it with:

```yaml
- uses: your-username/flaky-autopilot-action@v1
```

---

## Prerequisites

- [x] Action code is built (`npm run build` creates `dist/index.js`)
- [x] `action.yml` exists (metadata file) ✅
- [ ] Production API URL configured in `action.yml`
- [ ] GitHub repository created for the action

---

## Deployment Steps

### 1. Update Production API URL

Edit `action.yml` and replace the placeholder:

```yaml
inputs:
  api-url:
    description: 'Flaky Autopilot API URL'
    required: false
    default: 'https://your-actual-api-url.com'  # ← Update this!
```

**Your API URL should be:**
- Your AWS API Gateway URL, OR
- Your custom domain (e.g., `https://api.flaky-autopilot.com`)

---

### 2. Build the Action

```bash
cd flaky-autopilot-action
npm install
npm run build  # Creates dist/index.js
```

**Verify:** Check that `dist/index.js` exists and is ~1.6MB

---

### 3. Create GitHub Repository

**Option A: Via GitHub Web UI**
1. Go to https://github.com/new
2. Name: `flaky-autopilot-action`
3. Description: "Automatically detect and fix flaky tests with AI"
4. Public repository (required for GitHub Marketplace)
5. Don't initialize with README (we have our own)

**Option B: Via GitHub CLI**
```bash
gh repo create flaky-autopilot-action --public --description "Automatically detect and fix flaky tests with AI"
```

---

### 4. Push Code to GitHub

```bash
cd flaky-autopilot-action

# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial release: Dependency hash implementation"

# Add remote (replace with your username)
git remote add origin https://github.com/YOUR-USERNAME/flaky-autopilot-action.git

# Push to main branch
git branch -M main
git push -u origin main
```

---

### 5. Create Version Tags

Users reference your action by version tag:

```bash
# Create v1.0.0 tag
git tag -a v1.0.0 -m "Release v1.0.0 - Dependency hash support"
git push origin v1.0.0

# Create v1 tag (auto-updates to latest v1.x.x)
git tag -a v1 -m "Version 1"
git push origin v1

# Create 'latest' tag (optional)
git tag -a latest -m "Latest stable version"
git push origin latest
```

**Tag Strategy:**
- `@v1` → Always latest v1.x.x (recommended for users)
- `@v1.0.0` → Locked to specific version
- `@latest` → Always newest version (any breaking changes)

---

### 6. Create GitHub Release

**Via GitHub Web UI:**
1. Go to `https://github.com/YOUR-USERNAME/flaky-autopilot-action/releases/new`
2. Tag: `v1.0.0`
3. Title: `v1.0.0 - Dependency Hash Implementation`
4. Description:
```markdown
## 🚀 Features

- **Dependency Hash**: Reduces false positives from 95% to 5-10%
- **Multi-language Support**: JS/TS, Python, Java, Go, Ruby, C#, PHP, Rust, Kotlin, Swift
- **Smart Detection**: Only resets test history when test or dependencies change
- **Auto Fix PRs**: AI-powered fix generation for common flaky test patterns

## 📦 Installation

```yaml
- name: Detect Flaky Tests
  uses: YOUR-USERNAME/flaky-autopilot-action@v1
  with:
    api-key: ${{ secrets.FLAKY_AUTOPILOT_KEY }}
```

## 📊 What's New

- Implemented robust dependency hash calculation
- Added deterministic hash handling for missing files
- Multi-language import parsing (10+ languages)
- Comprehensive error handling and logging

## 🔗 Documentation

See [README.md](README.md) for full usage guide.
```

**Via GitHub CLI:**
```bash
gh release create v1.0.0 \
  --title "v1.0.0 - Dependency Hash Implementation" \
  --notes "See DEPLOYMENT.md for release notes"
```

---

### 7. Test the Published Action

Create a test repository and workflow:

```yaml
# .github/workflows/test-flaky-autopilot.yml
name: Test Flaky Autopilot

on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Run tests
        run: npm test
        continue-on-error: true

      # ← Test your published action
      - name: Analyze Flaky Tests
        uses: YOUR-USERNAME/flaky-autopilot-action@v1
        with:
          api-key: ${{ secrets.FLAKY_AUTOPILOT_KEY }}
          api-url: 'https://your-production-api.com'
```

---

## User Installation Guide

Once published, users install your action like this:

### Step 1: Get API Key
Users sign up at your dashboard and get an API key.

### Step 2: Add Secret to GitHub
```bash
# In their repo settings
Settings → Secrets → Actions → New repository secret
Name: FLAKY_AUTOPILOT_KEY
Value: <their-api-key>
```

### Step 3: Add Workflow
```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Run tests
        run: npm test
        continue-on-error: true  # Don't fail workflow if tests fail

      - name: Detect Flaky Tests
        uses: YOUR-USERNAME/flaky-autopilot-action@v1
        with:
          api-key: ${{ secrets.FLAKY_AUTOPILOT_KEY }}
```

---

## Updating the Action

When you make changes:

### Patch Release (v1.0.1 - bug fixes)
```bash
git add .
git commit -m "Fix: Handle missing test files gracefully"
git tag -a v1.0.1 -m "Bug fixes"
git push origin v1.0.1

# Update v1 tag to point to latest v1.x.x
git tag -f v1
git push origin v1 --force
```

### Minor Release (v1.1.0 - new features)
```bash
git add .
git commit -m "Feature: Add Python support"
git tag -a v1.1.0 -m "Python support"
git push origin v1.1.0

# Update v1 tag
git tag -f v1
git push origin v1 --force
```

### Major Release (v2.0.0 - breaking changes)
```bash
git add .
git commit -m "BREAKING: Change API response format"
git tag -a v2.0.0 -m "Version 2.0.0"
git push origin v2.0.0

# Create v2 tag
git tag -a v2 -m "Version 2"
git push origin v2
```

**Users on `@v1` won't get breaking changes automatically!**

---

## GitHub Marketplace (Optional)

To list your action in the GitHub Marketplace:

1. Go to your repo → Releases
2. Click "Draft a new release"
3. Check ✅ "Publish this Action to the GitHub Marketplace"
4. Fill in metadata:
   - Primary category: "Testing"
   - Additional category: "Continuous Integration"
5. Publish release

**Benefits:**
- Discoverable in GitHub Marketplace
- Official "Verified Creator" badge (if you verify)
- Better visibility for users

---

## File Checklist

Ensure these files are in your repo:

- [x] `action.yml` - Action metadata
- [x] `dist/index.js` - Compiled action (1.6MB bundle)
- [x] `package.json` - Dependencies
- [ ] `README.md` - Usage documentation
- [ ] `LICENSE` - License file (MIT recommended)
- [ ] `.gitignore` - Ignore node_modules, etc.

---

## Distribution Architecture

```
Your Repo: github.com/you/flaky-autopilot-action
├── action.yml          ← Tells GitHub how to run action
├── dist/index.js       ← Bundled code (includes all dependencies)
└── README.md          ← Usage docs

User's workflow references: uses: you/flaky-autopilot-action@v1

When user's workflow runs:
1. GitHub downloads your action from your repo
2. Runs dist/index.js on GitHub's runner
3. Action calculates hash, sends to your API
4. User sees results
```

---

## Versioning Best Practices

| Tag | Purpose | User Experience |
|-----|---------|-----------------|
| `@v1` | Major version (recommended) | Auto-gets bug fixes, no breaking changes |
| `@v1.0.0` | Exact version | Locked, never changes |
| `@latest` | Always newest | May break unexpectedly |
| `@main` | Development branch | Unstable, for testing only |

**Recommendation for users:** `@v1` (gets improvements, no breaking changes)

---

## Troubleshooting

### Action not found
```
Error: Unable to resolve action `you/flaky-autopilot-action@v1`
```
**Solution:** Repository must be public, tag must exist

### dist/index.js missing
```
Error: Cannot find module 'dist/index.js'
```
**Solution:** Run `npm run build` and commit `dist/` folder

### API key not working
```
Error: 401 Unauthorized
```
**Solution:** User needs to add `FLAKY_AUTOPILOT_KEY` secret

---

## Next Steps

1. [ ] Update `api-url` in `action.yml` with production URL
2. [ ] Create GitHub repository
3. [ ] Push code
4. [ ] Create v1.0.0 release
5. [ ] Test with sample repository
6. [ ] Write user documentation in README.md
7. [ ] (Optional) Publish to GitHub Marketplace

---

## Support

- Issues: `https://github.com/YOUR-USERNAME/flaky-autopilot-action/issues`
- Documentation: See README.md
- Contact: your-email@example.com
