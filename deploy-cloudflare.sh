#!/usr/bin/env bash
# Deploy the key-free build to Cloudflare Pages with the keys held as project secrets.
#
#   npx wrangler@4 login              # once, in a browser
#   ./deploy-cloudflare.sh            # builds, creates the project if needed, sets secrets, deploys
#
#   AIB_CF_PROJECT=name   the Pages project (default airis-thinking-airport)
#   AIB_PASSCODE=code     the access code visitors must enter (default: generated and printed)
set -euo pipefail
cd "$(dirname "$0")"
PROJECT="${AIB_CF_PROJECT:-airis-thinking-airport}"
W="npx --yes wrangler@4"

[ -f config.js ] || { echo "config.js is missing — the deploy copies voice/model settings and secrets from it"; exit 1; }
node build.js --cloud >/dev/null
grep -qE "sk_[A-Za-z0-9]{20,}|apiKey" dist/cloud/index.html && { echo "refusing: a key is in dist/cloud/index.html"; exit 1; }

$W pages project list 2>/dev/null | grep -q "^│ $PROJECT " || $W pages project create "$PROJECT" --production-branch main >/dev/null

# secrets: read straight from config.js into wrangler's stdin — never echoed, never on the command line
secret() { node -e "const w={};new Function('window',require('fs').readFileSync('config.js','utf8'))(w);const c=w.AIB_CONFIG;process.stdout.write(String($1||''))" | $W pages secret put "$2" --project-name "$PROJECT" >/dev/null; }
secret "c.elevenLabs.apiKey" ELEVEN_KEY
secret "c.llm.apiKey"        AZURE_KEY
secret "c.llm.endpoint"      AZURE_ENDPOINT
PASS="${AIB_PASSCODE:-$(LC_ALL=C tr -dc 'A-HJ-NP-Z2-9' </dev/urandom | head -c 8)}"
printf '%s' "$PASS" | $W pages secret put AIB_PASSCODE --project-name "$PROJECT" >/dev/null

OUT="$($W pages deploy dist/cloud --project-name "$PROJECT" --branch main --commit-dirty=true 2>&1 | tee /dev/stderr)"
URL="$(printf '%s' "$OUT" | grep -oE 'https://[a-z0-9.-]+\.pages\.dev' | tail -1)"
echo
echo "deployed:     ${URL:-see above}"
echo "project:      https://$PROJECT.pages.dev"
echo "access code:  $PASS"
