#!/bin/bash
# Manual deployment script - Run this on your local machine

echo "🚀 Execution Protocol - Manual Deploy"
echo "======================================"
echo ""

# Clone the repo fresh
echo "📥 Cloning repo..."
git clone https://github.com/achilliesbot/execution-protocol.git
cd execution-protocol

# Pull latest from container (if accessible)
# Or manually copy files from container at:
# /data/.openclaw/workspace/execution-acp-service/

echo ""
echo "📤 Pushing to GitHub..."
git add -A
git commit -m "Deploy: Mobile-friendly site with hamburger menu"
git push origin main

echo ""
echo "✅ Done! Site will auto-deploy to:"
echo "   https://execution-protocol.onrender.com/"
echo ""
echo "📱 Mobile features:"
echo "   - Hamburger menu (☰)"
echo "   - Responsive navigation"
echo "   - Touch-optimized"
