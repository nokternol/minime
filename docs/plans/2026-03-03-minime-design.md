# Minime — Design Document
_2026-03-03_

## Overview

Minime is a Claude-first personal knowledge base for a single ADHD user. The primary interface is a PWA web chat. Claude writes, structures and recalls content. Git is the storage backend. The system is designed to remove the cognitive barrier of storing, recalling and iteratively improving ideas and plans over time.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Synology NAS (Docker / Portainer managed stack)    │
│                                                     │
│  ┌──────────────────┐    ┌──────────────────────┐   │
│  │  SvelteKit PWA   │◄──►│   Hono API Service   │   │
│  │  (default: 8743) │    │   (default: 8744)     │   │
│  └──────────────────┘    └──────┬───────┬────────┘   │
│                                 │       │            │
└─────────────────────────────────┼───────┼────────────┘
                                  │       │
                    ┌─────────────┘       └──────────────┐
                    ▼                                     ▼
           GitHub Private Repo                    LLM APIs
           (storage + PRs + webhooks)       Claude Sonnet (reasoning)
                                            Gemini Flash (summaries)
```

**Two Docker services, no database.** All persistent state lives in the GitHub repo. The Hono API is the only process that touches GitHub or the LLMs. The SvelteKit PWA only talks to the API.

Synology reverse proxy sits in front, maps a DDNS subdomain to the PWA port. Google OAuth callback routes through the same domain.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | SvelteKit (PWA) |
| Backend | Hono (Node.js, TypeScript) |
| Auth | Google OAuth, single-account allowlist |
| Storage | GitHub private repo (GitHub REST API, no git binary) |
| Primary LLM | Anthropic API — Claude Sonnet |
| Secondary LLM | Gemini API — Gemini Flash (free tier) |
| Container | Docker Compose, Portainer managed stack |
| Reverse proxy | Synology built-in + DDNS |

---

## Content Model

### Repo structure

```
/
├── ideas/
│   └── YYYY-MM-DD-slug.md
├── plans/
│   └── YYYY-MM-DD-slug.md
├── discussions/
│   └── YYYY-MM-DD-slug.md
├── solutions/
│   └── YYYY-MM-DD-slug.md        ← technical work, code decisions
└── .minime/
    └── index.json                 ← auto-generated, never hand-edited
```

### Shared frontmatter (all types)

```yaml
---
id: 01JNXK2M...                   # ULID — stable, sortable, collision-proof
type: idea | plan | discussion | solution | insight
title: "Short descriptive title"
status: draft | active | parked | promoted | done | dismissed
tags: [typescript, architecture, work]
summary: "One sentence. What this is about."
created: 2026-03-03T14:00:00Z
updated: 2026-03-03T14:00:00Z
branch: idea/ulid-slug             # null once merged to main
pr: 42                             # GitHub PR number, null once merged
---
```

### Type-specific frontmatter

```yaml
# ideas
promoted_to: ulid                  # plan this idea became, if promoted

# plans
promoted_from: [ulid, ulid]        # originating ideas
priority: low | medium | high | critical
related_solutions: [ulid]

# discussions
related_to: ulid                   # plan or idea being discussed
session_summary: "..."             # Claude-written 2-3 sentence recap

# solutions
language: typescript
problem: "One line problem statement"
related_plan: ulid

# insights (system-generated)
subtype: pattern | milestone | review
generated_by: gemini-flash
references: [ulid, ulid]           # items this insight covers
```

### Content lifecycle

```
idea (captured)
  → parked     (went nowhere for now, preserved indefinitely)
  → promoted   (becomes worth fleshing out — spawns a plan)
  → dismissed  (consciously dropped)
  ... parked ideas can be promoted years later

plan (promoted from one or more ideas)
  → active     (being worked on)
  → parked     (deprioritised, not dead)
  → done       (shipped / resolved)
```

An idea is never mutated into a plan. A plan is a separate document with `promoted_from` linking back. The idea retains its own record and status.

### index.json

An array of all frontmatter objects, no body content. Rebuilt automatically on every PR merge via GitHub webhook. Loaded into API memory on startup. Typical size: ~100KB for 500 documents. If query complexity grows, migrates to SQLite (additive change, no restructuring).

---

## Git Workflow

All git operations use the GitHub REST API. No git binary required in the container.

### Branch naming

```
idea/01JNXK2M-capturing-fleeting-thoughts
plan/01JNXK2M-minime-architecture
discussion/01JNXK2M-auth-approach
solution/01JNXK2M-svelte-pwa-setup
```

### Item lifecycle in git

```
New capture
  → API creates branch
  → Claude writes markdown to branch
  → API opens draft PR
  → Document status: draft

Active session on existing item
  → API pushes new commits to existing branch
  → PR updated
  → Document status: active

User merges PR ("Commit to memory")
  → GitHub merges branch → main
  → Webhook fires → API rebuilds index.json
  → Branch deleted

User closes PR ("Dismiss")
  → PR closed without merge
  → Branch deleted
  → Document status: dismissed | parked
```

Multiple items can be in-flight simultaneously, each on its own branch. `index.json` on `main` reflects only committed knowledge. Open PRs are queried separately to surface in-flight items in the PWA.

### Webhook → index rebuild

```
PR merged on GitHub
  → GitHub sends POST to API /webhook/github
  → API fetches updated file list
  → Rebuilds .minime/index.json
  → Commits index back to main
  → In-memory cache refreshed
```

---

## LLM Routing & Token Efficiency

### Model routing

| Task | Model |
|---|---|
| Complex planning, code architecture, reasoning | Claude Sonnet |
| Frontmatter generation | Gemini Flash |
| Session recap / session_summary | Gemini Flash |
| Simple recall queries | Gemini Flash |
| Scheduled analysis (pattern detection) | Gemini Flash |

### Context assembly — layered loading

The system never loads full document bodies unless explicitly requested.

```
Layer 1 (always):        system prompt + user query          ~500 tokens
Layer 2 (every request): summaries of top 5 relevant items   ~300 tokens
Layer 3 (on drill-in):   full body of one specific item      ~1000 tokens
Layer 4 (code work):     solution details + related plan     ~2000 tokens
```

Relevance for Layer 2 is tag matching + recency + status. No embeddings required.

### Resume flow ("continue the X plan")

```
1. Script finds item by title/tag match in index.json
2. Script loads: frontmatter + session_summary of last discussion
3. Script loads: frontmatter of related ideas (titles + summaries only)
4. Context packet assembled: ~800 tokens total
5. Claude receives pre-built context, responds with continuity
```

### Session end

Every conversation close triggers Gemini Flash to write a `session_summary` back to the document. This is the primary continuity mechanism — next session loads the summary, not the full conversation history.

---

## Scheduled Analysis

A first-class extensibility pattern. New analysis jobs are addable without touching core architecture.

**Initial job: parked idea pattern detection**
- Schedule: weekly (configurable)
- Input: all `status: parked` idea summaries from `index.json`
- Model: Gemini Flash
- Output: `insight` document if 3+ ideas share a theme
- Result: surfaces as notification in PWA, goes through PR workflow (merge = acknowledge, close = dismiss)

Future analysis types follow the same pattern: read from index, process with Gemini Flash, write insight document, open PR.

---

## Skills (`minime:*` namespace)

### Design principles

- **Scripts for determinism, LLMs for reasoning.** Every predictable input/output operation is a script. LLMs handle only reasoning and writing.
- **Short-response contract.** Every skill enforces: lead with the answer, max 5 bullet points, no preamble, no repeating context back, `[expand]` marker if more detail is available.
- **`minime:deep-dive`** is the explicit escape hatch for longer reasoning when needed.

### Initial skill set

| Skill | Script does | LLM does |
|---|---|---|
| `minime:capture` | Creates branch + frontmatter stub | Writes content |
| `minime:continue` | Assembles context packet from index | Continues reasoning |
| `minime:save` | Commits + pushes to branch | Writes session_summary |
| `minime:promote` | Links idea → plan, creates plan stub | Writes plan content |
| `minime:finish` | Creates PR via GitHub API | Nothing |
| `minime:analyze` | Feeds parked summaries to Gemini Flash | Pattern detection |
| `minime:deep-dive` | Assembles full context (body + related) | Extended reasoning |

---

## PWA

### Two modes

**Browse** — finding past work. Tabs by type (ideas / plans / discussions / solutions / insights). Search by title and tag. Status dot per item. In-flight PR count badge. Offline read supported via service worker cache of `index.json` and recently viewed documents.

**Chat** — where work happens. Shows loaded context summary ("Context: plan + 2 ideas"). Session starts with last `session_summary` displayed. Attach additional context via ⊕ button. LLM response constrained by skill short-response contract.

### PR approval card

Shown when an item is ready to commit. Displays title, type, session count, change count. Two actions: "Commit to memory" (merge PR) and "Dismiss" (close PR). Detail view deliberately left open — will be enriched based on real usage patterns.

### PWA behaviour

- Installable via `manifest.json` + service worker on Android and iOS
- Accessible via Synology DDNS subdomain
- Offline read only — no local write queue
- Mobile-first, single column, large touch targets

---

## Authentication

Google OAuth with a hard-coded single-account allowlist. Reuses Google account already held for Gemini. No passwords. Implemented in the Hono API service; the SvelteKit PWA is gated behind the auth session.

---

## Configuration

All sensitive values and port choices in environment variables. Portainer manages the `.env` via the stack configuration UI.

```env
# Ports — non-default to avoid generic port scanning
PWA_PORT=8743
API_PORT=8744

# Auth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ALLOWED_GOOGLE_EMAIL=

# GitHub
GITHUB_TOKEN=
GITHUB_OWNER=
GITHUB_REPO=
GITHUB_WEBHOOK_SECRET=

# LLMs
ANTHROPIC_API_KEY=
GEMINI_API_KEY=

# Schedule
PARKED_ANALYSIS_CRON="0 9 * * 1"   # Monday 09:00
```

---

## Index Performance Path

| Level | Mechanism | Trigger |
|---|---|---|
| 1 (default) | `index.json` in-memory | Sufficient for hundreds–thousands of items |
| 2 (if needed) | SQLite `.db` file | Complex queries, full-text search on summaries |
| 3 (if needed) | Gemini embeddings + SQLite vectors | Semantic recall ("find things related to X") |

Each level is additive. No re-platforming required to move between levels.

---

## Open Items

- Verify Anthropic API billing is tracked separately from Claude Code usage
- Confirm Gemini free tier rate limits are sufficient for scheduled analysis workload
- PR commit card detail design — defer until real usage reveals what matters
- Response length constraints per skill — tune based on usage

---

_Design approved 2026-03-03. Next step: implementation plan._
