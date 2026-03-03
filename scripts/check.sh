#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v npx &>/dev/null; then
  echo "❌ npx not found — ensure Node.js is installed and in PATH" >&2
  exit 1
fi

PASS=0
FAIL=0

run_step() {
  local label="$1"
  shift
  echo ""
  echo "▶ $label"
  if "$@"; then
    echo "  ✅ $label"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $label"
    FAIL=$((FAIL + 1))
  fi
}

echo "════════════════════════════════════"
echo "  Minime quality checks"
echo "════════════════════════════════════"

# Biome: lint + format check
run_step "Biome lint + format" npx biome check .

# TypeScript: typecheck per app (added as apps are scaffolded)
if [ -f "apps/api/tsconfig.json" ]; then
  run_step "TypeScript (api)" bash -c "cd apps/api && npx tsc --noEmit"
fi

if [ -f "apps/web/tsconfig.json" ]; then
  run_step "TypeScript (web)" bash -c "cd apps/web && npx tsc --noEmit"
fi

# Tests: per app (added as tests are written)
if [ -f "apps/api/package.json" ] && grep -q '"test"' apps/api/package.json; then
  run_step "Tests (api)" bash -c "cd apps/api && npx vitest run --passWithNoTests"
fi

echo ""
echo "════════════════════════════════════"
echo "  Results: $PASS passed, $FAIL failed"
echo "════════════════════════════════════"

[ "$FAIL" -eq 0 ]
