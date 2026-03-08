#!/bin/bash
# Quick deploy script for Execution Protocol

echo "🚀 Execution Protocol - Quick Deploy"
echo "====================================="
echo ""

# Check if git is configured
if [ -z "$(git config --get user.email)" ]; then
    echo "⚠️  Git not configured. Please run:"
    echo "   git config --global user.email 'you@example.com'"
    echo "   git config --global user.name 'Your Name'"
    exit 1
fi

# Add all files
echo "📦 Adding files to git..."
git add -A

# Commit
echo "💾 Committing changes..."
git commit -m "Update: Mobile-friendly UI + documentation

- Added hamburger menu for mobile navigation
- Updated all 6 pages with responsive design
- Added GitHub Actions auto-deployment
- Updated render.yaml configuration

Ready for Render deployment"

# Push to GitHub
echo "📤 Pushing to GitHub..."
git push origin main

echo ""
echo "✅ Done! Your site will auto-deploy to:"
echo "   https://execution-protocol.onrender.com/"
echo ""
echo "📱 The site is now mobile-friendly with:"
echo "   - Hamburger menu (☰)"
echo "   - Responsive navigation"
echo "   - Touch-optimized buttons"
