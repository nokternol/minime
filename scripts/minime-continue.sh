#!/usr/bin/env bash
# scripts/minime-continue.sh <id-or-title-fragment>
# Fetches context packet for resuming work on an item

QUERY="${1:-}"
API="${MINIME_API_URL:-http://localhost:8744}"
ENCODED=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$QUERY" 2>/dev/null || echo "$QUERY")

echo "=== MINIME CONTEXT PACKET ==="
echo "Query: $QUERY"
echo ""

curl -s --cookie-jar /dev/null "${API}/api/content?q=${ENCODED}" 2>/dev/null \
  | python3 -c "
import json, sys
try:
  data = json.load(sys.stdin)[:3]
except Exception as e:
  print(f'Error fetching index: {e}')
  sys.exit(1)
for item in data:
  print(f\"[{item['type'].upper()}] {item['title']} ({item['status']}) id={item['id']}\")
  print(f\"  Summary: {item.get('summary', 'none')}\")
  last = item.get('session_summary')
  if last:
    print(f\"  Last session: {last}\")
  print()
" 2>/dev/null || echo "Could not reach API at $API — is it running?"
