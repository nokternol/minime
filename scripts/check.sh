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
WARN=0

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

# run_warn: same as run_step but failure is non-blocking — increments WARN, not FAIL.
run_warn() {
  local label="$1"
  shift
  echo ""
  echo "▶ $label (warning)"
  if "$@"; then
    echo "  ✅ $label"
    PASS=$((PASS + 1))
  else
    echo "  ⚠️  $label — non-blocking"
    WARN=$((WARN + 1))
  fi
}

echo "════════════════════════════════════"
echo "  Minime quality checks"
echo "════════════════════════════════════"

# Biome: lint + format check (read-only — no auto-mutate; biome ci exits non-zero on any violation)
run_step "Biome lint + format" npx biome ci .

# TypeScript: typecheck per app
if [ -f "apps/api/tsconfig.json" ]; then
  run_step "TypeScript (api)" bash -c "cd apps/api && npx tsc --noEmit"
fi

if [ -f "apps/web/tsconfig.json" ]; then
  run_step "TypeScript (web)" bash -c "cd apps/web && npx svelte-kit sync && npx tsc --noEmit"
fi

# Svelte: sync + check
if [ -f "apps/web/package.json" ]; then
  run_step "Svelte check" bash -c "cd apps/web && npx svelte-kit sync && npx svelte-check --tsconfig ./tsconfig.json"
fi

# Tests: per app
if [ -f "apps/api/package.json" ] && grep -q '"test"' apps/api/package.json; then
  run_step "Tests (api)" bash -c "cd apps/api && npx vitest run --passWithNoTests"
fi

if [ -f "apps/web/package.json" ] && grep -q '"test"' apps/web/package.json; then
  run_step "Tests (web)" bash -c "cd apps/web && npx vitest run --passWithNoTests"
fi

# Web build: catches Svelte compile errors that svelte-check misses
if [ -f "apps/web/package.json" ]; then
  run_step "Web build" bash -c "cd apps/web && npx vite build"
fi

# Storybook build: verifies addon-a11y registers and all stories compile — non-blocking.
# a11y violations surface in the browser panel at dev time, not as CI exit codes.
if [ -f "apps/web/package.json" ] && grep -q '"storybook"' apps/web/package.json; then
  run_warn "Storybook build (a11y addon smoke)" bash -c "cd apps/web && npx storybook build --quiet"
fi

echo ""
echo "════════════════════════════════════"
echo "  Results: $PASS passed, $FAIL failed, $WARN warnings"
echo "════════════════════════════════════"

[ "$FAIL" -eq 0 ]
