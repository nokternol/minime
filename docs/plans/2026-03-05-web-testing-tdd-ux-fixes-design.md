# Web Testing Infrastructure + TDD UX Fixes — Design

_2026-03-05. Picks up the UX & Lifecycle Fixes plan with a TDD-first approach._

---

## Context

The web app has no test infrastructure. The UX & Lifecycle Fixes plan (`2026-03-04-ux-and-lifecycle-fixes.md`) identified 5 concrete issues after first live use. Before implementing any of those fixes, we establish a component testing stack that can assert on network-layer behaviour, then use TDD to drive each fix in priority order.

---

## Testing Stack

| Package | Role |
|---|---|
| `vitest` | Test runner — consistent with the API app |
| `@testing-library/svelte` v5 | Render Svelte 5 components, query the DOM |
| `@testing-library/user-event` v14 | Realistic user interactions (click, type, tab) |
| `@testing-library/jest-dom` | DOM matchers (`toBeVisible`, `toHaveTextContent`, etc.) |
| `msw` v2 | Intercept `fetch` at the network boundary; capture request verb and body for assertion |
| `happy-dom` | Lightweight DOM environment (faster than jsdom, fewer quirks with Svelte 5) |

Vitest is configured with `environment: 'happy-dom'` and a `setupFiles` entry that boots the MSW server before all tests and tears it down after.

---

## Test Layout

```
apps/web/src/
  tests/
    server.ts          ← MSW setupServer + default happy-path handlers for all API routes
    setup.ts           ← beforeAll / afterEach / afterAll MSW lifecycle hooks
  routes/
    +page.test.ts      ← Fix 1 (loadUser on mount), Fix 5 (error states)
  routes/chat/
    new/+page.test.ts  ← Fix 2 (capture POST body defaults to idea)
    [id]/+page.test.ts ← Fix 3 (commit button visibility), Fix 4 (summarise → patch → commit sequence)
```

Co-located with routes — mirrors SvelteKit's convention.

---

## Network Assertion Pattern

Every test that needs to verify what crossed the wire uses an MSW request capture:

```ts
let lastBody: unknown
server.use(http.post('/api/capture', async ({ request }) => {
  lastBody = await request.json()
  return HttpResponse.json({ id: 'x', pr: 1, branch: 'b' })
}))
await userEvent.click(screen.getByRole('button', { name: /capture/i }))
expect(lastBody).toMatchObject({ type: 'idea' })
```

For ordered sequences (Fix 4), a `calls: string[]` array accumulates handler hits in order:

```ts
expect(calls).toEqual([
  'POST /api/chat/summarise',
  'PATCH /api/content/x',
  'POST /api/content/x/commit',
])
```

---

## TDD Cycle Per Fix

Each fix follows three atomic commits:

```
test: [fix-N] <description>      ← RED   — failing test committed; branch is intentionally broken
fix:  [fix-N] <description>      ← GREEN — minimum code to make the test pass
refactor: [fix-N] <description>  ← REFACTOR — improvements after code-review subagent pass
```

The branch is allowed to be red after the `test:` commit. Green is only required before merge.

### Refactor Phase

After GREEN, a **code-reviewer subagent** receives the implementation (not the tests) and evaluates two things only:

1. **Interface readability** — is the component or function's public surface intuitive? Would a developer encountering it for the first time understand its contract immediately?
2. **Implementation simplicity** — is the internals more complex than necessary? Can any abstraction, conditional, or data flow be simplified without changing the behaviour?

The main agent reviews the feedback, adopts what genuinely improves the design, and discards what doesn't. If one iteration doesn't resolve disagreement, it escalates to the user rather than spinning further.

Test correctness and assertion accuracy are **out of scope** for the refactor reviewer.

---

## Fixes in TDD Order

### Fix 1 — `loadUser()` on mount
**Test:** render `+layout.svelte`; assert `GET /auth/me` is called; assert slot content is hidden until the promise resolves, then visible.
**Fix:** call `loadUser()` in `onMount` in `+layout.svelte`; gate slot render on resolution.

### Fix 2 — Capture defaults to idea
**Test:** render `/chat/new`; fill title; submit; assert POST `/api/capture` body contains `{ type: 'idea' }`; assert no type selector visible in DOM.
**Fix:** remove type selector from capture form; hardcode `type: 'idea'` in the submit handler.

### Fix 3 — `pr` visible in chat
**Test:** render `/chat/[id]` with MSW returning `contentById` response that includes a `pr` field; assert Commit button is visible.
**Fix:** merge cache `pr` and `branch` fields into `contentById` response in the API (`apps/api/src/routes/content.ts`); no frontend change needed beyond the existing `{#if item?.pr}` guard.

### Fix 4 — Session summary save-back
**Test:** render `/chat/[id]`; trigger finish flow; assert calls arrive in order: `POST /api/chat/summarise` → `PATCH /api/content/:id` → `POST /api/content/:id/commit`.
**Fix:** add `PATCH /api/content/:id` endpoint to API (updates `session_summary` in frontmatter on branch); update `finish()` in the chat page to call summarise → patch → commit sequentially.

### Fix 5 — Visible error states
**Test:** render capture form and chat page with MSW returning 500; assert an error message element appears in the DOM; assert no silent swallowing (no unhandled rejection).
**Fix:** add try/catch in capture submit handler and chat send handler; render an error banner on failure.

---

## API Change Required

Fix 4 requires a new endpoint not currently in the API:

```
PATCH /api/content/:id
Body: { session_summary: string }
Effect: updates frontmatter on the item's branch, commits the change
```

This endpoint is implemented in `apps/api` as part of the same branch. It is stubbed in MSW for the web tests.

---

## Git Branch

`feat/web-testing-tdd-ux-fixes`

All work lands on this branch. Small atomic commits per TDD phase. The branch is merged when all 5 fixes are green and have passed the refactor review.
