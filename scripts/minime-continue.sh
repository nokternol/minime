#!/usr/bin/env bash
# scripts/minime-continue.sh <id-or-title-fragment>
# Fetches context packet for resuming work on an item
# NOTE: Requires prior authentication. Set MINIME_COOKIE_JAR to a persistent cookie file
# that was populated by authenticating via the browser or curl -c ~/.minime-cookies -L <API_URL>/auth/login

QUERY="${1:-}"
API="${MINIME_API_URL:-http://localhost:8744}"
COOKIE_JAR="${MINIME_COOKIE_JAR:-$HOME/.minime-cookies}"
ENCODED=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$QUERY" 2>/dev/null || echo "$QUERY")

echo "=== MINIME CONTEXT PACKET ==="
echo "Query: $QUERY"
echo ""

curl -s --cookie "$COOKIE_JAR" --cookie-jar "$COOKIE_JAR" "${API}/api/content?q=${ENCODED}" 2>/dev/null \
  | python3 -c "
import json, sys
try:
  data = json.load(sys.stdin)
except Exception as e:
  print(f'Error fetching index: {e}')
  sys.exit(1)
if not isinstance(data, list):
  print('Error: API returned unexpected response (check auth -- ensure cookie jar is populated at \$MINIME_COOKIE_JAR)')
  sys.exit(1)
for item in data[:3]:
  print(f\"[{item['type'].upper()}] {item['title']} ({item['status']}) id={item['id']}\")
  print(f\"  Summary: {item.get('summary', 'none')}\")
  last = item.get('session_summary')
  if last:
    print(f\"  Last session: {last}\")
  print()
" 2>/dev/null || echo "Could not reach API at $API -- is it running?"
