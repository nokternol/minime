#!/usr/bin/env bash
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v npx &>/dev/null; then
  echo "❌ npx not found — ensure Node.js is installed and in PATH" >&2
  exit 1
fi

PASS=0
FAIL=0
WARN=0
declare -a FAIL_LABELS=()
declare -a FAIL_OUTPUTS=()
declare -a WARN_LABELS=()
declare -a WARN_OUTPUTS=()

run_step() {
  local label="$1"; shift
  local out
  if out=$("$@" 2>&1); then
    echo "✅ $label"
    PASS=$((PASS + 1))
  else
    echo "❌ $label"
    FAIL=$((FAIL + 1))
    FAIL_LABELS+=("$label")
    FAIL_OUTPUTS+=("$out")
  fi
}

run_warn() {
  local label="$1"; shift
  local out
  if out=$("$@" 2>&1); then
    echo "✅ $label"
    PASS=$((PASS + 1))
  else
    echo "⚠️  $label (non-blocking)"
    WARN=$((WARN + 1))
    WARN_LABELS+=("$label")
    WARN_OUTPUTS+=("$out")
  fi
}

echo "════════════════════════════════════"
echo "  Minime quality checks"
echo "════════════════════════════════════"

run_step "Biome lint + format"  npx biome ci .
run_step "TypeScript (api)"     npm run typecheck --workspace=apps/api
run_step "TypeScript (web)"     npm run typecheck --workspace=apps/web
run_step "Svelte check"         npm run check --workspace=apps/web
run_step "Tests (api)"          npm run test --workspace=apps/api
run_step "Tests (web)"          npm run test --workspace=apps/web
run_step "Web build"            npm run build --workspace=apps/web
run_warn "Storybook build"      npm run build-storybook --workspace=apps/web

echo ""
echo "════════════════════════════════════"
printf   "  %d passed" "$PASS"
[ "$FAIL" -gt 0 ] && printf ", %d failed" "$FAIL"
[ "$WARN" -gt 0 ] && printf ", %d warnings" "$WARN"
echo ""
echo "════════════════════════════════════"

# Print failure details — only the output for steps that failed
if [ "${#FAIL_LABELS[@]}" -gt 0 ]; then
  echo ""
  for i in "${!FAIL_LABELS[@]}"; do
    echo "── ❌ ${FAIL_LABELS[$i]} ──────────────────────────"
    echo "${FAIL_OUTPUTS[$i]}"
  done
fi

if [ "${#WARN_LABELS[@]}" -gt 0 ]; then
  echo ""
  for i in "${!WARN_LABELS[@]}"; do
    echo "── ⚠️  ${WARN_LABELS[$i]} ──────────────────────────"
    echo "${WARN_OUTPUTS[$i]}"
  done
fi

[ "$FAIL" -eq 0 ]
