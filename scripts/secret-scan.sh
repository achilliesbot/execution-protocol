#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Fast secret scan (best-effort). Intentionally ignores node_modules and dist.
PATTERN='BEGIN (RSA|EC|OPENSSH) PRIVATE KEY|PRIVATE KEY-----|seed phrase|mnemonic|xprv|sk-[A-Za-z0-9]{20,}|Bearer [A-Za-z0-9_\-]{20,}|AWS_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID|OPENAI_API_KEY|ANTHROPIC_API_KEY|XAI_API_KEY|LINEAR_API_KEY'

# Only scan source-controlled paths we expect to own
SCAN_PATHS=(src tests scripts docs)

FOUND=0
for p in "${SCAN_PATHS[@]}"; do
  if [ -d "$p" ] || [ -f "$p" ]; then
    if grep -RInE "$PATTERN" "$p" --exclude="secret-scan.sh" >/tmp/ep_secret_scan_hits.txt 2>/dev/null; then
      FOUND=1
      break
    fi
  fi
done

if [ "$FOUND" -eq 1 ]; then
  echo "❌ Potential secret patterns found:" >&2
  cat /tmp/ep_secret_scan_hits.txt >&2
  exit 1
fi

echo "✅ Secret scan clean (src/tests/scripts/docs)"
