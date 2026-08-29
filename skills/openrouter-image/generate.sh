#!/bin/bash
# Generate an image via OpenRouter's chat-completions image-output models.
# Usage: generate.sh "<prompt>" [output-path] [model]
set -euo pipefail

PROMPT="${1:?Usage: generate.sh \"prompt\" [output-path] [model]}"
OUT="${2:-}"
MODEL="${3:-google/gemini-2.5-flash-image}"

# Prefer a real env var; fall back to the one place this key is known to
# live on this machine today (Sabi's wazobia project). Export
# OPENROUTER_API_KEY in your shell profile to make this fully portable.
KEY="${OPENROUTER_API_KEY:-}"
FALLBACK_ENV_FILE="/Users/sabiridwan/Projects/wazobia/wzb-admin/.env.local"
if [ -z "$KEY" ] && [ -f "$FALLBACK_ENV_FILE" ]; then
  KEY=$(grep "^OPENROUTER_API_KEY=" "$FALLBACK_ENV_FILE" | cut -d= -f2)
fi
if [ -z "$KEY" ]; then
  echo "ERROR: no OPENROUTER_API_KEY found (env var, or $FALLBACK_ENV_FILE)" >&2
  exit 1
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

python3 -c "
import json, sys
print(json.dumps({
    'model': sys.argv[1],
    'messages': [{'role': 'user', 'content': sys.argv[2]}],
    'modalities': ['image', 'text'],
}))
" "$MODEL" "$PROMPT" > "$TMPDIR/payload.json"

curl -s https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d @"$TMPDIR/payload.json" > "$TMPDIR/response.json"

python3 -c "
import json, base64, sys

with open(sys.argv[1]) as f:
    d = json.load(f)

if 'error' in d:
    print('OpenRouter error:', d['error'], file=sys.stderr)
    sys.exit(1)

msg = d['choices'][0]['message']
images = msg.get('images') or []
if not images:
    print('No image returned. Model said:', msg.get('content'), file=sys.stderr)
    sys.exit(1)

url = images[0]['image_url']['url']
header, b64data = url.split(',', 1)
ext = 'png' if 'png' in header else 'jpg'
out = sys.argv[2] or ('openrouter-image.' + ext)
if not out.lower().endswith(('.png', '.jpg', '.jpeg')):
    out = out + '.' + ext

with open(out, 'wb') as f:
    f.write(base64.b64decode(b64data))

print(out)
" "$TMPDIR/response.json" "$OUT"
