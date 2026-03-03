# Minime Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a containerized Claude-first personal knowledge base PWA with GitHub-backed storage, Google OAuth, and a PR-based idea lifecycle.

**Architecture:** SvelteKit PWA (port 8743) + Hono API (port 8744) in Docker Compose on Synology NAS. All state in a private GitHub repo. GitHub API for all git operations — no git binary in containers.

**Tech Stack:** SvelteKit, Hono, TypeScript, Docker Compose, GitHub REST API, Anthropic SDK, Google Generative AI SDK, google-auth-library, node-cron, gray-matter, ulid

---

## Phase 1 — Repo & Container Scaffolding

### Task 1: Initialise monorepo structure

**Files:**
- Create: `package.json` (root, workspaces)
- Create: `apps/api/package.json`
- Create: `apps/web/package.json`
- Create: `.gitignore`
- Create: `.env.example`

**Step 1: Create root package.json**

```json
{
  "name": "minime",
  "private": true,
  "workspaces": ["apps/api", "apps/web"],
  "scripts": {
    "dev": "docker compose up",
    "build": "docker compose build"
  }
}
```

**Step 2: Create .gitignore**

```
node_modules/
.env
dist/
.svelte-kit/
```

**Step 3: Create .env.example**

```env
# Ports
PWA_PORT=8743
API_PORT=8744

# Auth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ALLOWED_GOOGLE_EMAIL=
SESSION_SECRET=

# GitHub
GITHUB_TOKEN=
GITHUB_OWNER=
GITHUB_REPO=
GITHUB_WEBHOOK_SECRET=

# LLMs
ANTHROPIC_API_KEY=
GEMINI_API_KEY=

# Schedule
PARKED_ANALYSIS_CRON=0 9 * * 1
```

**Step 4: Commit**

```bash
git init
git add .
git commit -m "chore: initialise monorepo structure"
```

---

### Task 2: Scaffold Hono API service

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/index.ts`

**Step 1: Create apps/api/package.json**

```json
{
  "name": "@minime/api",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "@google/generative-ai": "^0.21.0",
    "google-auth-library": "^9.0.0",
    "gray-matter": "^4.0.3",
    "hono": "^4.6.0",
    "node-cron": "^3.0.3",
    "ulid": "^2.3.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/node-cron": "^3.0.11",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

**Step 2: Create apps/api/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src"]
}
```

**Step 3: Create apps/api/src/index.ts**

```typescript
import { Hono } from 'hono'
import { serve } from '@hono/node-server'

const app = new Hono()

app.get('/health', (c) => c.json({ status: 'ok' }))

const port = parseInt(process.env.API_PORT ?? '8744')
serve({ fetch: app.fetch, port })
console.log(`API running on port ${port}`)
```

**Step 4: Install and verify**

```bash
cd apps/api && npm install
npx tsx src/index.ts
# Expected: "API running on port 8744"
# curl http://localhost:8744/health → {"status":"ok"}
```

**Step 5: Commit**

```bash
git add apps/api
git commit -m "chore: scaffold hono api service"
```

---

### Task 3: Scaffold SvelteKit PWA

**Files:**
- Create: `apps/web/` (via SvelteKit init)
- Modify: `apps/web/package.json`
- Create: `apps/web/static/manifest.json`
- Create: `apps/web/src/service-worker.ts`

**Step 1: Create SvelteKit app**

```bash
cd apps/web
npm create svelte@latest . -- --template skeleton --types typescript --no-prettier --no-eslint
npm install
npm install -D @vite-pwa/sveltekit vite-plugin-pwa workbox-window
```

**Step 2: Create static/manifest.json**

```json
{
  "name": "Minime",
  "short_name": "Minime",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f0f0f",
  "theme_color": "#0f0f0f",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Step 3: Create apps/web/src/service-worker.ts**

```typescript
/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker'

const CACHE = `minime-${version}`
const ASSETS = [...build, ...files]

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  )
})

self.addEventListener('fetch', (event: FetchEvent) => {
  if (event.request.method !== 'GET') return
  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request))
  )
})
```

**Step 4: Verify dev server starts**

```bash
cd apps/web && npm run dev
# Expected: Local: http://localhost:5173/
```

**Step 5: Commit**

```bash
git add apps/web
git commit -m "chore: scaffold sveltekit pwa"
```

---

### Task 4: Docker Compose setup

**Files:**
- Create: `apps/api/Dockerfile`
- Create: `apps/web/Dockerfile`
- Create: `docker-compose.yml`

**Step 1: Create apps/api/Dockerfile**

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY dist/ ./dist/
EXPOSE 8744
CMD ["node", "dist/index.js"]
```

**Step 2: Create apps/web/Dockerfile**

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./
RUN npm install --production
EXPOSE 8743
CMD ["node", "build"]
```

**Step 3: Create docker-compose.yml**

```yaml
services:
  api:
    build: ./apps/api
    restart: unless-stopped
    ports:
      - "${API_PORT:-8744}:8744"
    environment:
      API_PORT: ${API_PORT:-8744}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      ALLOWED_GOOGLE_EMAIL: ${ALLOWED_GOOGLE_EMAIL}
      SESSION_SECRET: ${SESSION_SECRET}
      GITHUB_TOKEN: ${GITHUB_TOKEN}
      GITHUB_OWNER: ${GITHUB_OWNER}
      GITHUB_REPO: ${GITHUB_REPO}
      GITHUB_WEBHOOK_SECRET: ${GITHUB_WEBHOOK_SECRET}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      PARKED_ANALYSIS_CRON: ${PARKED_ANALYSIS_CRON:-0 9 * * 1}

  web:
    build: ./apps/web
    restart: unless-stopped
    ports:
      - "${PWA_PORT:-8743}:8743"
    environment:
      PWA_PORT: ${PWA_PORT:-8743}
      PUBLIC_API_URL: http://api:8744
    depends_on:
      - api
```

**Step 4: Commit**

```bash
git add apps/api/Dockerfile apps/web/Dockerfile docker-compose.yml
git commit -m "chore: add docker compose setup"
```

---

## Phase 2 — GitHub API Service

### Task 5: GitHub client module

**Files:**
- Create: `apps/api/src/github/client.ts`
- Create: `apps/api/src/github/client.test.ts`

**Step 1: Write the failing test**

```typescript
// apps/api/src/github/client.test.ts
import { describe, it, expect, vi } from 'vitest'
import { GitHubClient } from './client.js'

describe('GitHubClient', () => {
  it('constructs with owner and repo', () => {
    const client = new GitHubClient('token', 'owner', 'repo')
    expect(client.owner).toBe('owner')
    expect(client.repo).toBe('repo')
  })
})
```

**Step 2: Run to confirm failure**

```bash
cd apps/api && npx vitest run src/github/client.test.ts
# Expected: FAIL — cannot find module './client.js'
```

**Step 3: Implement**

```typescript
// apps/api/src/github/client.ts
const BASE = 'https://api.github.com'

export class GitHubClient {
  constructor(
    private token: string,
    public owner: string,
    public repo: string
  ) {}

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${await res.text()}`)
    return res.json() as T
  }

  async getFile(path: string, branch = 'main') {
    return this.request<{ content: string; sha: string; encoding: string }>(
      `/repos/${this.owner}/${this.repo}/contents/${path}?ref=${branch}`
    )
  }

  async upsertFile(path: string, content: string, message: string, branch: string, sha?: string) {
    return this.request(`/repos/${this.owner}/${this.repo}/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify({
        message,
        content: Buffer.from(content).toString('base64'),
        branch,
        ...(sha ? { sha } : {}),
      }),
    })
  }

  async createBranch(name: string, fromBranch = 'main') {
    const { object } = await this.request<{ object: { sha: string } }>(
      `/repos/${this.owner}/${this.repo}/git/ref/heads/${fromBranch}`
    )
    return this.request(`/repos/${this.owner}/${this.repo}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${name}`, sha: object.sha }),
    })
  }

  async createPR(title: string, head: string, body = '') {
    return this.request<{ number: number; html_url: string }>(
      `/repos/${this.owner}/${this.repo}/pulls`,
      {
        method: 'POST',
        body: JSON.stringify({ title, head, base: 'main', body, draft: false }),
      }
    )
  }

  async mergePR(prNumber: number) {
    return this.request(`/repos/${this.owner}/${this.repo}/pulls/${prNumber}/merge`, {
      method: 'PUT',
      body: JSON.stringify({ merge_method: 'squash' }),
    })
  }

  async closePR(prNumber: number) {
    return this.request(`/repos/${this.owner}/${this.repo}/pulls/${prNumber}`, {
      method: 'PATCH',
      body: JSON.stringify({ state: 'closed' }),
    })
  }

  async deleteBranch(name: string) {
    return this.request(`/repos/${this.owner}/${this.repo}/git/refs/heads/${name}`, {
      method: 'DELETE',
    })
  }

  async listOpenPRs() {
    return this.request<Array<{ number: number; title: string; head: { ref: string } }>>(
      `/repos/${this.owner}/${this.repo}/pulls?state=open&per_page=100`
    )
  }

  async listFiles(path: string, branch = 'main') {
    return this.request<Array<{ name: string; path: string; type: string }>>(
      `/repos/${this.owner}/${this.repo}/contents/${path}?ref=${branch}`
    )
  }
}
```

**Step 4: Run test**

```bash
npx vitest run src/github/client.test.ts
# Expected: PASS
```

**Step 5: Commit**

```bash
git add apps/api/src/github/
git commit -m "feat: add github api client"
```

---

### Task 6: Index builder

**Files:**
- Create: `apps/api/src/index-builder/build.ts`
- Create: `apps/api/src/index-builder/build.test.ts`

**Step 1: Write failing test**

```typescript
// apps/api/src/index-builder/build.test.ts
import { describe, it, expect } from 'vitest'
import { parseFrontmatter } from './build.js'

describe('parseFrontmatter', () => {
  it('extracts frontmatter without body', () => {
    const md = `---
id: 01JNXK2M
type: idea
title: Test Idea
status: draft
tags: [typescript]
summary: A test idea
created: 2026-03-03T00:00:00Z
updated: 2026-03-03T00:00:00Z
---
# Body content here
More content`
    const result = parseFrontmatter(md)
    expect(result.id).toBe('01JNXK2M')
    expect(result.title).toBe('Test Idea')
    expect((result as any).body).toBeUndefined()
  })
})
```

**Step 2: Run to confirm failure**

```bash
npx vitest run src/index-builder/build.test.ts
# Expected: FAIL
```

**Step 3: Implement**

```typescript
// apps/api/src/index-builder/build.ts
import matter from 'gray-matter'
import type { GitHubClient } from '../github/client.js'

export type ContentType = 'idea' | 'plan' | 'discussion' | 'solution' | 'insight'
export type ContentStatus = 'draft' | 'active' | 'parked' | 'promoted' | 'done' | 'dismissed'

export interface IndexEntry {
  id: string
  type: ContentType
  title: string
  status: ContentStatus
  tags: string[]
  summary: string
  created: string
  updated: string
  branch?: string
  pr?: number
  path: string
  // type-specific
  promoted_to?: string
  promoted_from?: string[]
  priority?: string
  related_to?: string
  session_summary?: string
  language?: string
  problem?: string
  related_plan?: string
  subtype?: string
  generated_by?: string
  references?: string[]
}

export function parseFrontmatter(content: string): IndexEntry {
  const { data } = matter(content)
  return data as IndexEntry
}

const CONTENT_DIRS: ContentType[] = ['ideas', 'plans', 'discussions', 'solutions'] as unknown as ContentType[]
const DIRS = ['ideas', 'plans', 'discussions', 'solutions']

export async function buildIndex(github: GitHubClient): Promise<IndexEntry[]> {
  const entries: IndexEntry[] = []

  for (const dir of DIRS) {
    let files: Array<{ path: string }> = []
    try {
      files = await github.listFiles(dir) as Array<{ path: string; type: string }>
    } catch {
      continue // dir may not exist yet
    }

    for (const file of files) {
      if (!file.path.endsWith('.md')) continue
      try {
        const { content, encoding } = await github.getFile(file.path)
        const decoded = encoding === 'base64'
          ? Buffer.from(content, 'base64').toString('utf-8')
          : content
        const entry = parseFrontmatter(decoded)
        entry.path = file.path
        entries.push(entry)
      } catch {
        continue
      }
    }
  }

  return entries.sort((a, b) => b.updated.localeCompare(a.updated))
}
```

**Step 4: Run test**

```bash
npx vitest run src/index-builder/build.test.ts
# Expected: PASS
```

**Step 5: Commit**

```bash
git add apps/api/src/index-builder/
git commit -m "feat: add frontmatter parser and index builder"
```

---

### Task 7: In-memory index cache + webhook handler

**Files:**
- Create: `apps/api/src/store/index-cache.ts`
- Create: `apps/api/src/routes/webhook.ts`

**Step 1: Create index cache**

```typescript
// apps/api/src/store/index-cache.ts
import type { IndexEntry } from '../index-builder/build.js'
import type { GitHubClient } from '../github/client.js'
import { buildIndex } from '../index-builder/build.js'

export class IndexCache {
  private entries: IndexEntry[] = []
  private lastBuilt: Date | null = null

  constructor(private github: GitHubClient) {}

  async load() {
    this.entries = await buildIndex(this.github)
    this.lastBuilt = new Date()
    console.log(`Index loaded: ${this.entries.length} entries`)
  }

  all() { return this.entries }

  byType(type: string) { return this.entries.filter(e => e.type === type) }

  byStatus(status: string) { return this.entries.filter(e => e.status === status) }

  search(query: string) {
    const q = query.toLowerCase()
    return this.entries.filter(e =>
      e.title.toLowerCase().includes(q) ||
      e.summary?.toLowerCase().includes(q) ||
      e.tags?.some(t => t.toLowerCase().includes(q))
    )
  }

  findById(id: string) { return this.entries.find(e => e.id === id) }

  getLastBuilt() { return this.lastBuilt }
}
```

**Step 2: Create webhook route**

```typescript
// apps/api/src/routes/webhook.ts
import { Hono } from 'hono'
import { createHmac } from 'crypto'
import type { IndexCache } from '../store/index-cache.js'

export function webhookRoutes(cache: IndexCache, secret: string) {
  const app = new Hono()

  app.post('/webhook/github', async (c) => {
    const sig = c.req.header('x-hub-signature-256')
    const body = await c.req.text()

    const expected = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
    if (sig !== expected) return c.json({ error: 'invalid signature' }, 401)

    const event = c.req.header('x-github-event')
    const payload = JSON.parse(body)

    if (event === 'pull_request' && payload.action === 'closed' && payload.pull_request.merged) {
      await cache.load()
      console.log('Index rebuilt after PR merge')
    }

    return c.json({ ok: true })
  })

  return app
}
```

**Step 3: Commit**

```bash
git add apps/api/src/store/ apps/api/src/routes/
git commit -m "feat: add index cache and github webhook handler"
```

---

## Phase 3 — Authentication

### Task 8: Google OAuth in Hono API

**Files:**
- Create: `apps/api/src/auth/google.ts`
- Create: `apps/api/src/routes/auth.ts`
- Modify: `apps/api/src/index.ts`

**Step 1: Create auth module**

```typescript
// apps/api/src/auth/google.ts
import { OAuth2Client } from 'google-auth-library'

export class GoogleAuth {
  private client: OAuth2Client

  constructor(
    clientId: string,
    clientSecret: string,
    private redirectUri: string,
    private allowedEmail: string
  ) {
    this.client = new OAuth2Client(clientId, clientSecret, redirectUri)
  }

  getAuthUrl() {
    return this.client.generateAuthUrl({
      scope: ['openid', 'email', 'profile'],
      access_type: 'offline',
    })
  }

  async exchange(code: string): Promise<{ email: string; name: string; picture: string }> {
    const { tokens } = await this.client.getToken(code)
    this.client.setCredentials(tokens)
    const ticket = await this.client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: this.client._clientId,
    })
    const payload = ticket.getPayload()!
    if (payload.email !== this.allowedEmail) {
      throw new Error('Email not allowed')
    }
    return { email: payload.email!, name: payload.name!, picture: payload.picture! }
  }
}
```

**Step 2: Create auth routes**

```typescript
// apps/api/src/routes/auth.ts
import { Hono } from 'hono'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import type { GoogleAuth } from '../auth/google.js'

const SESSIONS = new Map<string, { email: string; name: string }>()

export function authRoutes(auth: GoogleAuth) {
  const app = new Hono()

  app.get('/auth/login', (c) => {
    return c.redirect(auth.getAuthUrl())
  })

  app.get('/auth/callback', async (c) => {
    const code = c.req.query('code')
    if (!code) return c.json({ error: 'no code' }, 400)
    try {
      const user = await auth.exchange(code)
      const sessionId = crypto.randomUUID()
      SESSIONS.set(sessionId, user)
      setCookie(c, 'session', sessionId, {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      })
      return c.redirect('/')
    } catch (e) {
      return c.json({ error: 'auth failed' }, 403)
    }
  })

  app.get('/auth/me', (c) => {
    const sessionId = getCookie(c, 'session')
    if (!sessionId) return c.json(null)
    const user = SESSIONS.get(sessionId)
    return c.json(user ?? null)
  })

  app.post('/auth/logout', (c) => {
    const sessionId = getCookie(c, 'session')
    if (sessionId) SESSIONS.delete(sessionId)
    deleteCookie(c, 'session')
    return c.json({ ok: true })
  })

  return app
}

export function requireAuth() {
  return async (c: any, next: any) => {
    const sessionId = getCookie(c, 'session')
    if (!sessionId || !SESSIONS.has(sessionId)) {
      return c.json({ error: 'unauthorized' }, 401)
    }
    c.set('user', SESSIONS.get(sessionId))
    await next()
  }
}
```

**Step 3: Wire into index.ts**

```typescript
// apps/api/src/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { GitHubClient } from './github/client.js'
import { IndexCache } from './store/index-cache.js'
import { GoogleAuth } from './auth/google.js'
import { authRoutes } from './routes/auth.js'
import { webhookRoutes } from './routes/webhook.js'

const app = new Hono()

app.use('*', cors({ origin: process.env.PWA_ORIGIN ?? 'http://localhost:8743', credentials: true }))

const github = new GitHubClient(
  process.env.GITHUB_TOKEN!,
  process.env.GITHUB_OWNER!,
  process.env.GITHUB_REPO!
)
const cache = new IndexCache(github)
await cache.load()

const googleAuth = new GoogleAuth(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  `${process.env.PUBLIC_URL ?? 'http://localhost:8744'}/auth/callback`,
  process.env.ALLOWED_GOOGLE_EMAIL!
)

app.route('/', authRoutes(googleAuth))
app.route('/', webhookRoutes(cache, process.env.GITHUB_WEBHOOK_SECRET!))
app.get('/health', (c) => c.json({ status: 'ok' }))

const port = parseInt(process.env.API_PORT ?? '8744')
serve({ fetch: app.fetch, port })
console.log(`API running on port ${port}`)
```

**Step 4: Commit**

```bash
git add apps/api/src/auth/ apps/api/src/routes/auth.ts apps/api/src/index.ts
git commit -m "feat: add google oauth with single-account allowlist"
```

---

## Phase 4 — Content API Routes

### Task 9: Browse API (index + item reads)

**Files:**
- Create: `apps/api/src/routes/content.ts`

**Step 1: Create content routes**

```typescript
// apps/api/src/routes/content.ts
import { Hono } from 'hono'
import { requireAuth } from './auth.js'
import type { IndexCache } from '../store/index-cache.js'
import type { GitHubClient } from '../github/client.js'
import matter from 'gray-matter'

export function contentRoutes(cache: IndexCache, github: GitHubClient) {
  const app = new Hono()

  // List all — supports ?type=plan&status=active&q=search
  app.get('/api/content', requireAuth(), (c) => {
    let entries = cache.all()
    const type = c.req.query('type')
    const status = c.req.query('status')
    const q = c.req.query('q')
    if (type) entries = entries.filter(e => e.type === type)
    if (status) entries = entries.filter(e => e.status === status)
    if (q) entries = cache.search(q).filter(e =>
      (!type || e.type === type) && (!status || e.status === status)
    )
    return c.json(entries)
  })

  // Get in-flight (open PRs cross-referenced with index)
  app.get('/api/content/inflight', requireAuth(), async (c) => {
    const prs = await github.listOpenPRs()
    return c.json(prs.map(pr => ({
      pr: pr.number,
      branch: pr.head.ref,
      title: pr.title,
    })))
  })

  // Get full body of a single item by id
  app.get('/api/content/:id', requireAuth(), async (c) => {
    const id = c.req.param('id')
    const entry = cache.findById(id)
    if (!entry) return c.json({ error: 'not found' }, 404)

    const { content, encoding } = await github.getFile(entry.path)
    const decoded = encoding === 'base64'
      ? Buffer.from(content, 'base64').toString('utf-8')
      : content

    const { data, content: body } = matter(decoded)
    return c.json({ ...data, body, path: entry.path })
  })

  return app
}
```

**Step 2: Wire into index.ts — add after existing routes:**

```typescript
import { contentRoutes } from './routes/content.js'
// ...
app.route('/', contentRoutes(cache, github))
```

**Step 3: Commit**

```bash
git add apps/api/src/routes/content.ts apps/api/src/index.ts
git commit -m "feat: add content browse and read api routes"
```

---

### Task 10: Capture & lifecycle API routes

**Files:**
- Create: `apps/api/src/routes/lifecycle.ts`
- Create: `apps/api/src/content/document.ts`

**Step 1: Create document builder**

```typescript
// apps/api/src/content/document.ts
import { ulid } from 'ulid'

export interface CaptureInput {
  type: 'idea' | 'plan' | 'discussion' | 'solution'
  title: string
  tags: string[]
  summary: string
  body: string
  related_to?: string
  promoted_from?: string[]
  language?: string
  problem?: string
}

export function buildDocument(input: CaptureInput, branchName: string, prNumber?: number) {
  const id = ulid()
  const now = new Date().toISOString()
  const slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
  const filename = `${now.split('T')[0]}-${slug}.md`
  const path = `${input.type}s/${filename}`

  const frontmatter: Record<string, unknown> = {
    id,
    type: input.type,
    title: input.title,
    status: 'draft',
    tags: input.tags,
    summary: input.summary,
    created: now,
    updated: now,
    branch: branchName,
    ...(prNumber ? { pr: prNumber } : {}),
    ...(input.related_to ? { related_to: input.related_to } : {}),
    ...(input.promoted_from ? { promoted_from: input.promoted_from } : {}),
    ...(input.language ? { language: input.language } : {}),
    ...(input.problem ? { problem: input.problem } : {}),
  }

  const yaml = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.join(', ')}]` : JSON.stringify(v)}`)
    .join('\n')

  const content = `---\n${yaml}\n---\n\n${input.body}`
  return { id, path, content, filename, branchName: `${input.type}/${id.toLowerCase()}-${slug}` }
}
```

**Step 2: Create lifecycle routes**

```typescript
// apps/api/src/routes/lifecycle.ts
import { Hono } from 'hono'
import { requireAuth } from './auth.js'
import type { GitHubClient } from '../github/client.js'
import type { IndexCache } from '../store/index-cache.js'
import { buildDocument } from '../content/document.js'

export function lifecycleRoutes(github: GitHubClient, cache: IndexCache) {
  const app = new Hono()

  // Capture new item
  app.post('/api/capture', requireAuth(), async (c) => {
    const input = await c.req.json()
    const doc = buildDocument(input)
    await github.createBranch(doc.branchName)
    await github.upsertFile(doc.path, doc.content, `capture: ${input.title}`, doc.branchName)
    const pr = await github.createPR(`[${input.type}] ${input.title}`, doc.branchName)
    return c.json({ id: doc.id, path: doc.path, pr: pr.number, branch: doc.branchName })
  })

  // Commit to memory (merge PR)
  app.post('/api/content/:id/commit', requireAuth(), async (c) => {
    const entry = cache.findById(c.req.param('id'))
    if (!entry?.pr) return c.json({ error: 'no open PR' }, 404)
    await github.mergePR(entry.pr)
    if (entry.branch) await github.deleteBranch(entry.branch)
    return c.json({ ok: true })
  })

  // Dismiss (close PR without merge)
  app.post('/api/content/:id/dismiss', requireAuth(), async (c) => {
    const entry = cache.findById(c.req.param('id'))
    if (!entry?.pr) return c.json({ error: 'no open PR' }, 404)
    await github.closePR(entry.pr)
    if (entry.branch) await github.deleteBranch(entry.branch)
    return c.json({ ok: true })
  })

  // Park (update status in-branch)
  app.post('/api/content/:id/park', requireAuth(), async (c) => {
    const entry = cache.findById(c.req.param('id'))
    if (!entry) return c.json({ error: 'not found' }, 404)
    // Status update is handled by next chat turn writing updated frontmatter
    return c.json({ ok: true, note: 'status updated via next save' })
  })

  return app
}
```

**Step 3: Wire into index.ts**

```typescript
import { lifecycleRoutes } from './routes/lifecycle.js'
// ...
app.route('/', lifecycleRoutes(github, cache))
```

**Step 4: Commit**

```bash
git add apps/api/src/routes/lifecycle.ts apps/api/src/content/ apps/api/src/index.ts
git commit -m "feat: add capture and lifecycle api routes"
```

---

## Phase 5 — LLM Chat Route

### Task 11: Context assembler

**Files:**
- Create: `apps/api/src/llm/context.ts`
- Create: `apps/api/src/llm/context.test.ts`

**Step 1: Write failing test**

```typescript
// apps/api/src/llm/context.test.ts
import { describe, it, expect } from 'vitest'
import { assembleContext } from './context.js'
import type { IndexEntry } from '../index-builder/build.js'

describe('assembleContext', () => {
  it('returns top 5 by recency when no query', () => {
    const entries: IndexEntry[] = Array.from({ length: 10 }, (_, i) => ({
      id: `id-${i}`,
      type: 'idea' as const,
      title: `Idea ${i}`,
      status: 'active' as const,
      tags: [],
      summary: `Summary ${i}`,
      created: `2026-0${(i % 9) + 1}-01T00:00:00Z`,
      updated: `2026-0${(i % 9) + 1}-01T00:00:00Z`,
      path: `ideas/idea-${i}.md`,
    }))
    const result = assembleContext(entries, undefined, undefined)
    expect(result.length).toBeLessThanOrEqual(5)
  })
})
```

**Step 2: Run to confirm failure**

```bash
npx vitest run src/llm/context.test.ts
# Expected: FAIL
```

**Step 3: Implement**

```typescript
// apps/api/src/llm/context.ts
import type { IndexEntry } from '../index-builder/build.js'

export interface ContextEntry {
  id: string
  type: string
  title: string
  status: string
  tags: string[]
  summary: string
  session_summary?: string
}

export function assembleContext(
  entries: IndexEntry[],
  query: string | undefined,
  relatedToId: string | undefined,
  limit = 5
): ContextEntry[] {
  let scored = entries.map(e => ({ entry: e, score: 0 }))

  if (query) {
    const q = query.toLowerCase()
    scored = scored.map(({ entry, score }) => ({
      entry,
      score: score
        + (entry.title.toLowerCase().includes(q) ? 3 : 0)
        + (entry.summary?.toLowerCase().includes(q) ? 2 : 0)
        + (entry.tags?.some(t => t.toLowerCase().includes(q)) ? 1 : 0),
    }))
  }

  if (relatedToId) {
    scored = scored.map(({ entry, score }) => ({
      entry,
      score: score + (
        entry.related_to === relatedToId ||
        entry.promoted_from?.includes(relatedToId) ||
        entry.references?.includes(relatedToId) ? 4 : 0
      ),
    }))
  }

  return scored
    .sort((a, b) => b.score - a.score || b.entry.updated.localeCompare(a.entry.updated))
    .slice(0, limit)
    .map(({ entry }) => ({
      id: entry.id,
      type: entry.type,
      title: entry.title,
      status: entry.status,
      tags: entry.tags,
      summary: entry.summary,
      session_summary: entry.session_summary,
    }))
}

export function formatContextBlock(entries: ContextEntry[]): string {
  if (!entries.length) return 'No relevant prior context found.'
  return entries.map(e =>
    `[${e.type.toUpperCase()}] ${e.title} (${e.status})\n` +
    `Summary: ${e.summary}\n` +
    (e.session_summary ? `Last session: ${e.session_summary}\n` : '') +
    `Tags: ${e.tags.join(', ')}`
  ).join('\n\n')
}
```

**Step 4: Run test**

```bash
npx vitest run src/llm/context.test.ts
# Expected: PASS
```

**Step 5: Commit**

```bash
git add apps/api/src/llm/context.ts apps/api/src/llm/context.test.ts
git commit -m "feat: add context assembler for llm requests"
```

---

### Task 12: Chat route with Claude + Gemini routing

**Files:**
- Create: `apps/api/src/llm/router.ts`
- Create: `apps/api/src/routes/chat.ts`

**Step 1: Create LLM router**

```typescript
// apps/api/src/llm/router.ts
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

const SHORT_RESPONSE_CONTRACT = `
You are Minime, a personal knowledge assistant.
Rules:
- Lead with the answer, not the reasoning
- Maximum 5 bullet points unless user asks to expand
- Use [expand] marker if more detail is available but not shown
- Never repeat context back to the user
- Code blocks only when code is the direct answer
- If the user says "deep dive" or "expand", you may respond fully
`.trim()

export class LLMRouter {
  private claude: Anthropic
  private gemini: GoogleGenerativeAI

  constructor(anthropicKey: string, geminiKey: string) {
    this.claude = new Anthropic({ apiKey: anthropicKey })
    this.gemini = new GoogleGenerativeAI(geminiKey)
  }

  async chat(messages: Array<{ role: 'user' | 'assistant'; content: string }>, contextBlock: string) {
    const system = `${SHORT_RESPONSE_CONTRACT}\n\n## Prior context\n\n${contextBlock}`
    const response = await this.claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system,
      messages,
    })
    return (response.content[0] as { text: string }).text
  }

  async summarise(content: string): Promise<string> {
    const model = this.gemini.getGenerativeModel({ model: 'gemini-2.0-flash' })
    const result = await model.generateContent(
      `Write a 2-3 sentence session summary of this conversation. Be specific about decisions made and next steps.\n\n${content}`
    )
    return result.response.text()
  }

  async generateFrontmatter(title: string, body: string, type: string): Promise<{ tags: string[]; summary: string }> {
    const model = this.gemini.getGenerativeModel({ model: 'gemini-2.0-flash' })
    const result = await model.generateContent(
      `Given this ${type} titled "${title}", generate:
1. A one-sentence summary (max 20 words)
2. 3-5 lowercase tags

Respond as JSON only: {"summary": "...", "tags": ["...", "..."]}

Content: ${body.slice(0, 500)}`
    )
    try {
      return JSON.parse(result.response.text().replace(/```json\n?|\n?```/g, ''))
    } catch {
      return { summary: title, tags: [] }
    }
  }
}
```

**Step 2: Create chat route**

```typescript
// apps/api/src/routes/chat.ts
import { Hono } from 'hono'
import { stream } from 'hono/streaming'
import { requireAuth } from './auth.js'
import type { LLMRouter } from '../llm/router.js'
import type { IndexCache } from '../store/index-cache.js'
import { assembleContext, formatContextBlock } from '../llm/context.js'

export function chatRoutes(llm: LLMRouter, cache: IndexCache) {
  const app = new Hono()

  app.post('/api/chat', requireAuth(), async (c) => {
    const { messages, query, relatedToId } = await c.req.json()
    const contextEntries = assembleContext(cache.all(), query, relatedToId)
    const contextBlock = formatContextBlock(contextEntries)
    const reply = await llm.chat(messages, contextBlock)
    return c.json({ reply, context: contextEntries.map(e => ({ id: e.id, title: e.title })) })
  })

  app.post('/api/chat/summarise', requireAuth(), async (c) => {
    const { conversation } = await c.req.json()
    const summary = await llm.summarise(conversation)
    return c.json({ summary })
  })

  app.post('/api/chat/frontmatter', requireAuth(), async (c) => {
    const { title, body, type } = await c.req.json()
    const result = await llm.generateFrontmatter(title, body, type)
    return c.json(result)
  })

  return app
}
```

**Step 3: Wire into index.ts**

```typescript
import { LLMRouter } from './llm/router.js'
import { chatRoutes } from './routes/chat.js'
// ...
const llm = new LLMRouter(process.env.ANTHROPIC_API_KEY!, process.env.GEMINI_API_KEY!)
app.route('/', chatRoutes(llm, cache))
```

**Step 4: Commit**

```bash
git add apps/api/src/llm/ apps/api/src/routes/chat.ts apps/api/src/index.ts
git commit -m "feat: add llm router and chat api route"
```

---

## Phase 6 — Scheduled Analysis

### Task 13: Parked idea pattern detection job

**Files:**
- Create: `apps/api/src/jobs/parked-analysis.ts`
- Modify: `apps/api/src/index.ts`

**Step 1: Create job**

```typescript
// apps/api/src/jobs/parked-analysis.ts
import type { LLMRouter } from '../llm/router.js'
import type { IndexCache } from '../store/index-cache.js'
import type { GitHubClient } from '../github/client.js'
import { buildDocument } from '../content/document.js'
import { ulid } from 'ulid'

export async function runParkedAnalysis(llm: LLMRouter, cache: IndexCache, github: GitHubClient) {
  const parked = cache.byStatus('parked').filter(e => e.type === 'idea')
  if (parked.length < 3) {
    console.log('Parked analysis: fewer than 3 parked ideas, skipping')
    return
  }

  const summariesText = parked.map(e => `- [${e.id}] ${e.title}: ${e.summary}`).join('\n')
  const model = (llm as any).gemini.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const result = await model.generateContent(
    `Analyse these parked ideas for recurring themes. If 3+ ideas share a theme, identify the pattern.
Respond as JSON: { "patterns": [{ "theme": "...", "ids": ["...", "..."], "insight": "One sentence about what this pattern means" }] }
If no patterns found, respond: { "patterns": [] }

Ideas:
${summariesText}`
  )

  let patterns: Array<{ theme: string; ids: string[]; insight: string }> = []
  try {
    const parsed = JSON.parse(result.response.text().replace(/```json\n?|\n?```/g, ''))
    patterns = parsed.patterns ?? []
  } catch {
    return
  }

  for (const pattern of patterns) {
    if (pattern.ids.length < 3) continue
    const id = ulid()
    const title = `Pattern: ${pattern.theme}`
    const body = `## Recurring Theme Detected\n\n${pattern.insight}\n\n## Related Ideas\n\n${pattern.ids.map(i => `- ${i}`).join('\n')}`
    const doc = buildDocument({
      type: 'idea',
      title,
      tags: ['insight', 'pattern', 'adhd'],
      summary: pattern.insight,
      body,
    })
    const branchName = `insight/${id.toLowerCase()}-pattern`
    await github.createBranch(branchName)
    await github.upsertFile(doc.path.replace('ideas/', 'ideas/').replace(doc.branchName, branchName), body, `insight: ${title}`, branchName)
    await github.createPR(`[insight] ${title}`, branchName)
    console.log(`Parked analysis: created insight PR for theme "${pattern.theme}"`)
  }
}
```

**Step 2: Wire cron job into index.ts**

```typescript
import cron from 'node-cron'
import { runParkedAnalysis } from './jobs/parked-analysis.js'
// ...after server starts:
const analysisCron = process.env.PARKED_ANALYSIS_CRON ?? '0 9 * * 1'
cron.schedule(analysisCron, () => runParkedAnalysis(llm, cache, github))
console.log(`Parked analysis scheduled: ${analysisCron}`)
```

**Step 3: Commit**

```bash
git add apps/api/src/jobs/ apps/api/src/index.ts
git commit -m "feat: add scheduled parked idea pattern analysis"
```

---

## Phase 7 — SvelteKit PWA Frontend

### Task 14: API client + auth store

**Files:**
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/lib/stores/auth.ts`

**Step 1: Create typed API client**

```typescript
// apps/web/src/lib/api.ts
const BASE = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:8744'

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...options })
  if (res.status === 401) { window.location.href = `${BASE}/auth/login`; throw new Error('unauthorized') }
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export type ContentType = 'idea' | 'plan' | 'discussion' | 'solution' | 'insight'
export type ContentStatus = 'draft' | 'active' | 'parked' | 'promoted' | 'done' | 'dismissed'

export interface IndexEntry {
  id: string; type: ContentType; title: string; status: ContentStatus
  tags: string[]; summary: string; created: string; updated: string
  branch?: string; pr?: number; path: string; session_summary?: string
}

export interface ContentDetail extends IndexEntry { body: string }
export interface InFlightItem { pr: number; branch: string; title: string }

export const api = {
  me: () => req<{ email: string; name: string } | null>('/auth/me'),
  logout: () => req('/auth/logout', { method: 'POST' }),
  content: (params?: { type?: string; status?: string; q?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString()
    return req<IndexEntry[]>(`/api/content${qs ? '?' + qs : ''}`)
  },
  contentById: (id: string) => req<ContentDetail>(`/api/content/${id}`),
  inflight: () => req<InFlightItem[]>('/api/content/inflight'),
  capture: (input: unknown) => req<{ id: string; pr: number; branch: string }>('/api/capture', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  }),
  commit: (id: string) => req(`/api/content/${id}/commit`, { method: 'POST' }),
  dismiss: (id: string) => req(`/api/content/${id}/dismiss`, { method: 'POST' }),
  chat: (messages: unknown[], query?: string, relatedToId?: string) =>
    req<{ reply: string; context: Array<{ id: string; title: string }> }>('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, query, relatedToId }),
    }),
  summarise: (conversation: string) => req<{ summary: string }>('/api/chat/summarise', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation }),
  }),
}
```

**Step 2: Create auth store**

```typescript
// apps/web/src/lib/stores/auth.ts
import { writable } from 'svelte/store'
import { api } from '$lib/api.js'

export const user = writable<{ email: string; name: string } | null>(null)

export async function loadUser() {
  const me = await api.me()
  user.set(me)
  return me
}
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/
git commit -m "feat: add api client and auth store"
```

---

### Task 15: Browse page

**Files:**
- Create: `apps/web/src/routes/+layout.svelte`
- Create: `apps/web/src/routes/+layout.ts`
- Create: `apps/web/src/routes/+page.svelte`
- Create: `apps/web/src/lib/components/EntryList.svelte`
- Create: `apps/web/src/lib/components/StatusDot.svelte`

**Step 1: Create layout**

```svelte
<!-- apps/web/src/routes/+layout.ts -->
```
```typescript
// apps/web/src/routes/+layout.ts
import { loadUser } from '$lib/stores/auth.js'
export const load = async () => ({ user: await loadUser() })
```

```svelte
<!-- apps/web/src/routes/+layout.svelte -->
<script lang="ts">
  import { user } from '$lib/stores/auth.js'
</script>

{#if $user}
  <slot />
{:else}
  <main style="display:grid;place-items:center;height:100vh">
    <a href="/auth/login">Sign in with Google</a>
  </main>
{/if}
```

**Step 2: Create StatusDot component**

```svelte
<!-- apps/web/src/lib/components/StatusDot.svelte -->
<script lang="ts">
  export let status: string
  const colors: Record<string, string> = {
    draft: '#666', active: '#4ade80', parked: '#facc15',
    promoted: '#60a5fa', done: '#a3e635', dismissed: '#ef4444',
  }
</script>
<span style="
  display:inline-block;width:8px;height:8px;border-radius:50%;
  background:{colors[status] ?? '#666'};flex-shrink:0
"></span>
```

**Step 3: Create EntryList component**

```svelte
<!-- apps/web/src/lib/components/EntryList.svelte -->
<script lang="ts">
  import StatusDot from './StatusDot.svelte'
  import type { IndexEntry } from '$lib/api.js'
  export let entries: IndexEntry[]
  export let onSelect: (entry: IndexEntry) => void
</script>

<ul style="list-style:none;padding:0;margin:0">
  {#each entries as entry (entry.id)}
    <li
      on:click={() => onSelect(entry)}
      style="padding:12px 16px;border-bottom:1px solid #222;cursor:pointer;display:flex;flex-direction:column;gap:4px"
    >
      <div style="display:flex;align-items:center;gap:8px">
        <StatusDot status={entry.status} />
        <span style="font-weight:500;flex:1">{entry.title}</span>
        <span style="font-size:11px;color:#666">{entry.type}</span>
      </div>
      <p style="margin:0;font-size:12px;color:#888">{entry.summary}</p>
      {#if entry.tags?.length}
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          {#each entry.tags as tag}
            <span style="font-size:10px;background:#1a1a1a;padding:2px 6px;border-radius:99px;color:#aaa">#{tag}</span>
          {/each}
        </div>
      {/if}
    </li>
  {/each}
</ul>
```

**Step 4: Create main browse page**

```svelte
<!-- apps/web/src/routes/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { api } from '$lib/api.js'
  import EntryList from '$lib/components/EntryList.svelte'
  import type { IndexEntry } from '$lib/api.js'

  const TYPES = ['all', 'idea', 'plan', 'discussion', 'solution', 'insight']
  let activeType = 'all'
  let query = ''
  let entries: IndexEntry[] = []
  let inflightCount = 0

  async function load() {
    const [items, inflight] = await Promise.all([
      api.content({ type: activeType === 'all' ? undefined : activeType, q: query || undefined }),
      api.inflight(),
    ])
    entries = items
    inflightCount = inflight.length
  }

  onMount(load)

  function onSelect(entry: IndexEntry) { goto(`/chat/${entry.id}`) }
</script>

<div style="max-width:480px;margin:0 auto;font-family:system-ui">
  <header style="padding:16px;border-bottom:1px solid #222;display:flex;align-items:center;justify-content:space-between">
    <strong>minime</strong>
    {#if inflightCount > 0}
      <a href="/review" style="font-size:12px;color:#facc15">⚑ {inflightCount} in-flight</a>
    {/if}
    <a href="/chat/new" style="font-size:20px;text-decoration:none">＋</a>
  </header>

  <div style="padding:8px 16px;border-bottom:1px solid #222">
    <input
      bind:value={query}
      on:input={load}
      placeholder="Search..."
      style="width:100%;background:#111;border:1px solid #333;color:#fff;padding:8px;border-radius:6px;font-size:14px"
    />
  </div>

  <div style="display:flex;gap:0;overflow-x:auto;border-bottom:1px solid #222">
    {#each TYPES as t}
      <button
        on:click={() => { activeType = t; load() }}
        style="padding:8px 12px;border:none;background:{activeType===t?'#1a1a1a':'transparent'};color:{activeType===t?'#fff':'#666'};cursor:pointer;font-size:12px;white-space:nowrap"
      >{t}</button>
    {/each}
  </div>

  <EntryList {entries} {onSelect} />
</div>
```

**Step 5: Commit**

```bash
git add apps/web/src/
git commit -m "feat: add browse page with type tabs and search"
```

---

### Task 16: Chat page

**Files:**
- Create: `apps/web/src/routes/chat/[id]/+page.svelte`
- Create: `apps/web/src/routes/chat/new/+page.svelte`

**Step 1: Create chat page for existing item**

```svelte
<!-- apps/web/src/routes/chat/[id]/+page.svelte -->
<script lang="ts">
  import { page } from '$app/stores'
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { api } from '$lib/api.js'
  import type { ContentDetail, IndexEntry } from '$lib/api.js'

  let item: ContentDetail | null = null
  let messages: Array<{ role: 'user' | 'assistant'; content: string }> = []
  let input = ''
  let loading = false
  let contextTitles: string[] = []

  const id = $page.params.id

  onMount(async () => {
    item = await api.contentById(id)
    if (item?.session_summary) {
      messages = [{ role: 'assistant', content: `Continuing from last session:\n\n${item.session_summary}` }]
    }
  })

  async function send() {
    if (!input.trim()) return
    const userMsg = { role: 'user' as const, content: input }
    messages = [...messages, userMsg]
    input = ''
    loading = true
    try {
      const res = await api.chat(messages, item?.title, id)
      messages = [...messages, { role: 'assistant', content: res.reply }]
      contextTitles = res.context.map(c => c.title)
    } finally { loading = false }
  }

  async function finish() {
    const conversation = messages.map(m => `${m.role}: ${m.content}`).join('\n')
    const { summary } = await api.summarise(conversation)
    // TODO: save summary back to document via API
    await api.commit(id)
    goto('/')
  }
</script>

<div style="max-width:480px;margin:0 auto;display:flex;flex-direction:column;height:100vh">
  <header style="padding:12px 16px;border-bottom:1px solid #222;display:flex;align-items:center;gap:8px">
    <a href="/" style="color:#aaa">←</a>
    <span style="flex:1;font-weight:500;font-size:14px">{item?.title ?? '...'}</span>
    {#if item?.pr}
      <button on:click={finish} style="font-size:12px;background:#1a3a1a;color:#4ade80;border:1px solid #4ade80;padding:4px 10px;border-radius:6px;cursor:pointer">Commit ✓</button>
    {/if}
  </header>

  {#if contextTitles.length}
    <div style="padding:6px 16px;font-size:11px;color:#666;border-bottom:1px solid #111">
      Context: {contextTitles.join(', ')}
    </div>
  {/if}

  <div style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px">
    {#each messages as msg}
      <div style="
        align-self:{msg.role==='user'?'flex-end':'flex-start'};
        max-width:85%;background:{msg.role==='user'?'#1a3a5c':'#1a1a1a'};
        padding:10px 14px;border-radius:12px;font-size:14px;white-space:pre-wrap
      ">{msg.content}</div>
    {/each}
    {#if loading}
      <div style="align-self:flex-start;color:#666;font-size:14px">...</div>
    {/if}
  </div>

  <div style="padding:12px 16px;border-top:1px solid #222;display:flex;gap:8px">
    <textarea
      bind:value={input}
      on:keydown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
      placeholder="Message..."
      rows="2"
      style="flex:1;background:#111;border:1px solid #333;color:#fff;padding:8px;border-radius:8px;font-size:14px;resize:none"
    ></textarea>
    <button on:click={send} disabled={loading}
      style="background:#1a3a5c;color:#60a5fa;border:none;padding:8px 14px;border-radius:8px;cursor:pointer">→</button>
  </div>
</div>
```

**Step 2: New chat page (capture flow)**

```svelte
<!-- apps/web/src/routes/chat/new/+page.svelte -->
<script lang="ts">
  import { goto } from '$app/navigation'
  import { api } from '$lib/api.js'

  let title = ''
  let type: 'idea' | 'plan' | 'discussion' | 'solution' = 'idea'
  let body = ''
  let saving = false

  async function capture() {
    if (!title.trim()) return
    saving = true
    try {
      const fm = await api.summarise(body || title)
      const { id } = await api.capture({ type, title, tags: [], summary: fm.summary, body })
      goto(`/chat/${id}`)
    } finally { saving = false }
  }
</script>

<div style="max-width:480px;margin:0 auto;padding:16px">
  <header style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
    <a href="/" style="color:#aaa">←</a>
    <strong>New capture</strong>
  </header>

  <select bind:value={type} style="width:100%;background:#111;border:1px solid #333;color:#fff;padding:8px;border-radius:6px;margin-bottom:8px">
    <option value="idea">Idea</option>
    <option value="plan">Plan</option>
    <option value="discussion">Discussion</option>
    <option value="solution">Solution</option>
  </select>

  <input bind:value={title} placeholder="Title..." style="width:100%;background:#111;border:1px solid #333;color:#fff;padding:8px;border-radius:6px;margin-bottom:8px;font-size:16px" />

  <textarea bind:value={body} placeholder="What's on your mind? (optional — Claude will structure it)" rows="6"
    style="width:100%;background:#111;border:1px solid #333;color:#fff;padding:8px;border-radius:6px;resize:none;font-size:14px;margin-bottom:12px"></textarea>

  <button on:click={capture} disabled={saving || !title.trim()}
    style="width:100%;background:#1a3a5c;color:#60a5fa;border:none;padding:12px;border-radius:8px;font-size:16px;cursor:pointer">
    {saving ? 'Capturing...' : 'Capture →'}
  </button>
</div>
```

**Step 3: Commit**

```bash
git add apps/web/src/routes/
git commit -m "feat: add chat page for existing items and new capture flow"
```

---

## Phase 8 — Claude Code Skills

### Task 17: minime:capture skill

**Files:**
- Create: `skills/minime-capture.md`
- Create: `scripts/minime-capture.sh`

**Step 1: Create capture script**

```bash
#!/usr/bin/env bash
# scripts/minime-capture.sh
# Usage: ./scripts/minime-capture.sh
# Prints a context block for the capture skill prompt

echo "=== MINIME CAPTURE CONTEXT ==="
echo "Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""
echo "Content types: idea | plan | discussion | solution"
echo "Statuses: draft | active | parked | promoted | done | dismissed"
echo ""
echo "API endpoint: POST /api/capture"
echo "Required fields: type, title, tags[], summary, body"
```

```bash
chmod +x scripts/minime-capture.sh
```

**Step 2: Create skill file**

```markdown
<!-- skills/minime-capture.md -->
# minime:capture

Capture a new idea, plan, discussion, or solution into Minime.

## Script
Run: `./scripts/minime-capture.sh`

## Instructions
1. Run the script to get context
2. Ask the user: what type and title?
3. Write a concise markdown body (no preamble, just content)
4. Generate 3-5 tags and a one-sentence summary
5. Call POST /api/capture with the structured payload

## Response contract
- Confirm capture in one line: "Captured: [title] as [type]"
- Show the PR number
- No other output unless user asks
```

**Step 3: Create remaining skills following same pattern**

Create `skills/minime-continue.md` + `scripts/minime-continue.sh`:

```bash
#!/usr/bin/env bash
# scripts/minime-continue.sh <id-or-title>
# Fetches context packet for resuming work on an item

QUERY="$1"
API="${MINIME_API_URL:-http://localhost:8744}"

echo "=== MINIME CONTEXT PACKET ==="
curl -s "${API}/api/content?q=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${QUERY}')")" \
  | python3 -c "
import json, sys
data = json.load(sys.stdin)[:3]
for item in data:
  print(f\"[{item['type'].upper()}] {item['title']} ({item['status']})\")
  print(f\"  Summary: {item.get('summary', 'none')}\")
  print(f\"  Last session: {item.get('session_summary', 'none')}\")
  print()
"
```

**Step 4: Commit**

```bash
git add skills/ scripts/
git commit -m "feat: add minime claude code skills and scripts"
```

---

## Phase 9 — Final Wiring & Deployment

### Task 18: GitHub repo initialisation

**Step 1: Create the private GitHub repo**

```bash
gh repo create minime-wiki --private --clone=false
```

**Step 2: Create initial repo structure via API or push**

Push the current code repo and create a separate wiki repo:
```bash
# The app code goes here (minime)
# The wiki storage needs its own private repo
gh repo create minime-wiki --private
```

**Step 3: Set up GitHub webhook**

In the wiki repo settings → Webhooks → Add webhook:
- Payload URL: `https://your-ddns.example.com:8744/webhook/github`
- Content type: `application/json`
- Secret: generate with `openssl rand -hex 32`
- Events: Pull requests only

**Step 4: Configure Google OAuth**

In Google Cloud Console → APIs → Credentials → Create OAuth 2.0 Client:
- Authorised redirect URIs: `https://your-ddns.example.com:8744/auth/callback`

---

### Task 19: Portainer stack deployment

**Step 1: In Portainer → Stacks → Add Stack**

Point to GitHub repo URL (or paste `docker-compose.yml` content).

**Step 2: Fill environment variables in Portainer stack UI**

```
PWA_PORT=8743
API_PORT=8744
GOOGLE_CLIENT_ID=<from google console>
GOOGLE_CLIENT_SECRET=<from google console>
ALLOWED_GOOGLE_EMAIL=<your gmail>
SESSION_SECRET=<openssl rand -hex 32>
GITHUB_TOKEN=<fine-grained PAT with contents+PRs write>
GITHUB_OWNER=<your github username>
GITHUB_REPO=minime-wiki
GITHUB_WEBHOOK_SECRET=<same as webhook config>
ANTHROPIC_API_KEY=<from console.anthropic.com>
GEMINI_API_KEY=<from aistudio.google.com>
```

**Step 3: Configure Synology reverse proxy**

Synology DSM → Control Panel → Application Portal → Reverse Proxy:
- Source: HTTPS `minime.your-ddns.com` port 443
- Destination: HTTP `localhost` port 8743

**Step 4: Verify deployment**

```bash
curl https://minime.your-ddns.com/health  # via reverse proxy
# Expected: redirects to Google auth login
```

**Step 5: Install PWA on phone**

Open `https://minime.your-ddns.com` in Chrome/Safari → "Add to Home Screen"

---

### Task 20: Save memory file

**Files:**
- Create: `/home/nokternol/.claude/projects/-home-nokternol-repos-minime/memory/MEMORY.md`

```markdown
# Minime Project Memory

## Project
Personal ADHD knowledge base PWA. Design doc: docs/plans/2026-03-03-minime-design.md
Implementation plan: docs/plans/2026-03-03-minime-implementation.md

## Stack
- SvelteKit PWA (port 8743) + Hono API (port 8744)
- TypeScript monorepo: apps/web + apps/api
- GitHub API for storage (no git binary)
- Claude Sonnet for reasoning, Gemini Flash for summaries
- Google OAuth single-account allowlist
- Docker Compose, Portainer managed stack on Synology NAS

## Key files
- apps/api/src/index.ts — API entry point
- apps/api/src/github/client.ts — GitHub REST API client
- apps/api/src/store/index-cache.ts — in-memory frontmatter index
- apps/api/src/llm/router.ts — Claude + Gemini routing
- apps/api/src/llm/context.ts — context assembler
- apps/web/src/lib/api.ts — typed frontend API client
- docker-compose.yml — container setup
- skills/ — minime:* Claude Code skills
- scripts/ — deterministic shell scripts for skills

## Principles
- Scripts for determinism, LLMs for reasoning
- Short-response contract on all skills (max 5 bullets, lead with answer)
- All git ops via GitHub REST API
- index.json rebuilt on every PR merge via webhook
- Scheduled jobs are a first-class extensibility pattern
```

**Commit:**

```bash
git add .
git commit -m "chore: complete initial implementation"
```

---

## Open Items (from design)

- Verify Anthropic API billing tracked separately from Claude Code usage
- Confirm Gemini free tier rate limits sufficient for scheduled analysis
- PR commit card detail design — defer until real usage
- Response length per skill — tune based on usage
- `minime:save` skill needs API endpoint to update `session_summary` in-branch
- Review page (`/review`) for in-flight PR management — stub exists in browse, needs own route
