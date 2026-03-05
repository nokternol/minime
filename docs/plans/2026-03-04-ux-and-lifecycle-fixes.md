# UX & Lifecycle Fixes — Plan

_Opened 2026-03-04 after first live test session._

---

## Context

First live test revealed several gaps between the design intent and the current implementation. This plan captures what needs to change before the app is useful day-to-day.

---

## Issues identified

### 1. Capture form: type selector contradicts the design

**Current:** new capture form has a type dropdown (idea / plan / discussion / solution).

**Design intent:** everything starts as an `idea`. Plans are promoted _from_ ideas — never directly captured as plans. The type-first form adds cognitive load at exactly the moment you want zero friction.

**Proposed change:** remove the type selector from the capture form. All new captures are `idea` by default. Type evolves through the promote lifecycle, not upfront selection.

Open question: should `discussion` and `solution` ever be directly captured, or always derived? Defer until real usage reveals the answer.

---

### 2. Commit button: never visible

**Current:** chat page has `{#if item?.pr}` guard on the Commit button. `pr` is not written to the file frontmatter in `buildDocument`, so `item.pr` is always undefined after reading the file.

**Fix:** `contentById` should merge the cache entry's `pr` and `branch` fields into the response, since the cache holds the live PR state. Alternatively, write `pr` to the frontmatter at capture time and update it on merge.

---

### 3. Session summary: generated but never saved

**Current:** `finish()` calls `api.summarise()` and discards the result, then merges the PR. The `session_summary` is never written back to the document — the primary continuity mechanism is broken.

**Fix needed:**
- API endpoint to update `session_summary` on the branch before merging
- `finish()` flow: summarise → patch file with summary → merge PR → redirect home
- The `minime:save` skill also depends on this endpoint (noted as open item)

---

### 4. `loadUser()` never called

**Current:** `user` store initialises as `null`. `loadUser()` exists in `auth.ts` but is never called. The layout `{#if $user}` should always show the login screen on every page load — it appears to be masked by the service worker cache.

**Fix:** call `loadUser()` on mount in `+layout.svelte` and gate the slot render on the result.

---

### 5. Error paths are silent

Several routes return bare 500s with no user feedback in the UI. The capture form and chat page both need visible error states so failures don't just silently swallow user input.

---

## Broader UX question

The current capture → chat → commit flow requires knowing upfront that you want to capture. The design also discussed a more fluid model:

> "everything starts as an idea and once it starts to take shape I can promote it to a plan"

There may also be a stage between idea and plan: a **design** (thinking through the shape of something) before a **plan** (executable steps). This wasn't in the original content model and may be worth discussing — though it risks over-engineering for types that may rarely be used.

**Defer:** leave content types as-is until real usage reveals whether the distinction matters.

---

## Priority order

1. `loadUser()` — without this auth state is fragile
2. Capture defaults to idea — removes upfront friction
3. `pr` visible in chat — unlocks the commit flow
4. Session summary save-back — core continuity mechanism
5. Visible error states — prevents silent data loss

---

_Pick up here next session._
