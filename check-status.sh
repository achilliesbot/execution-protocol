#!/bin/bash
# Auto-deploy script for Execution Protocol
# Run this to deploy to Render

echo "🚀 Execution Protocol Auto-Deploy"
echo "=================================="
echo ""

# Files are ready at: /data/.openclaw/workspace/execution-acp-service/
# Copy these to your repo and push:

cd /data/.openclaw/workspace/execution-acp-service

echo "📁 Files ready for deployment:"
ls -la *.html 2>/dev/null || echo "  (run 'cp docs-site/* .' first)"
echo ""

echo "🔧 Current Git Status:"
git status --short
echo ""

echo "📤 To deploy, run these commands:"
echo ""
echo "  git add -A"
echo "  git commit -m 'Deploy: Mobile-friendly site'"
echo "  git push origin master"
echo ""

echo "✅ After push, site deploys to:"
echo "   https://execution-protocol.onrender.com/"
