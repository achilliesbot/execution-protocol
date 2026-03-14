# 🚀 Deployment Guide

## Auto-Deployment Setup (Recommended)

### Step 1: Configure Render Secrets

Go to your GitHub repository settings and add these secrets:

1. **RENDER_SERVICE_ID**
   - Get from: https://dashboard.render.com/
   - Your static site service ID

2. **RENDER_API_KEY**
   - Get from: https://dashboard.render.com/settings#api-keys
   - Create new API key

### Step 2: Push to GitHub

```bash
# Run the deploy script
./deploy.sh

# Or manually:
git add -A
git commit -m "Deploy: Mobile-friendly site"
git push origin main
```

### Step 3: Auto-Deploy Works!

Every push to `main` branch will auto-deploy to:
**https://achillesalpha.onrender.com/ep/**

---

## Manual Render Setup (Alternative)

If auto-deployment doesn't work:

1. **Go to Render Dashboard**
   - https://dashboard.render.com/

2. **Create New Static Site**
   - Connect GitHub repo: `achilliesbot/execution-protocol`
   - Build command: `echo "Static site ready"`
   - Publish directory: `./docs-site`

3. **Add Routes** (in Redirects/Rewrites):
   ```
   /docs    → /docs/index.html
   /api     → /api/index.html
   /contracts → /contracts/index.html
   /integration → /integration/index.html
   /virtuals → /virtuals/index.html
   ```

4. **Deploy**
   - Click "Create Static Site"
   - Your site will be live at `achillesalpha.onrender.com/ep`

---

## 📱 Mobile Features

The site now includes:
- ☰ Hamburger menu on all pages
- Responsive navigation (stacks on mobile)
- Touch-optimized buttons
- Readable font sizes on small screens
- Horizontal scroll for code blocks

---

## 🔗 Live URLs

After deployment, these paths will work:

- `/` - Home page with stats
- `/docs/` - Documentation
- `/api/` - API reference
- `/contracts/` - Smart contract info
- `/integration/` - Integration guide
- `/virtuals/` - Virtuals ACP page

---

## ✅ Verification

After deployment, verify:

1. **Mobile Menu**: Resize browser to <768px, hamburger appears
2. **Navigation**: Click ☰ menu, all links work
3. **Pages**: All 6 pages load correctly
4. **Content**: Contract addresses displayed correctly

---

## 🆘 Troubleshooting

**Issue: Changes not showing**
- Clear browser cache (Ctrl+Shift+R)
- Check Render dashboard for build errors

**Issue: 404 on subpages**
- Verify routes configured in Render
- Check that all index.html files exist

**Issue: Auto-deploy not working**
- Verify secrets are set correctly
- Check GitHub Actions tab for errors

---

## 📊 Current Status

- ✅ All pages built
- ✅ Mobile-friendly CSS added
- ✅ GitHub Actions configured
- ✅ Render.yaml updated
- ⏳ Awaiting GitHub push

**Next Step**: Run `./deploy.sh` or push to GitHub
