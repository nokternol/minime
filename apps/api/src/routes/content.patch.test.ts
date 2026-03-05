import { describe, it, expect, vi, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { authRoutes } from './auth.js'
import { contentRoutes } from './content.js'
import type { IndexCache } from '../store/index-cache.js'
import type { GitHubClient } from '../github/client.js'
import type { IndexEntry } from '../index-builder/build.js'

const ENTRY: IndexEntry = {
  id: 'idea-1', type: 'idea', title: 'Test', status: 'draft',
  tags: [], summary: '', created: '2026-01-01', updated: '2026-01-01',
  path: 'wiki/idea-1.md', branch: 'feat/idea-1',
}

const RAW_CONTENT = '---\nid: idea-1\ntitle: Test\n---\nBody text'

const mockCache = {
  findById: vi.fn().mockReturnValue(ENTRY),
} as unknown as IndexCache

const mockGithub = {
  getFile: vi.fn().mockResolvedValue({
    encoding: 'utf-8',
    content: RAW_CONTENT,
    sha: 'abc123',
  }),
  upsertFile: vi.fn().mockResolvedValue({}),
} as unknown as GitHubClient

const mockAuth = {
  getAuthUrl: () => '',
  exchange: vi.fn().mockResolvedValue({ email: 'u@test.com', name: 'U', picture: '' }),
}

let app: Hono
let sessionCookie = ''

beforeAll(async () => {
  app = new Hono()
  app.route('/', authRoutes(mockAuth as any))
  app.route('/', contentRoutes(mockCache, mockGithub))
  const res = await app.request('/auth/callback?code=x')
  const match = (res.headers.get('set-cookie') ?? '').match(/session=([^;]+)/)
  sessionCookie = match ? `session=${match[1]}` : ''
})

const authed = (path: string, init?: RequestInit) =>
  app.request(path, { ...init, headers: { cookie: sessionCookie, ...(init?.headers as Record<string, string> ?? {}) } })

describe('PATCH /api/content/:id', () => {
  it('returns 404 for unknown id', async () => {
    vi.mocked(mockCache.findById).mockReturnValueOnce(undefined)
    const res = await authed('/api/content/nonexistent', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_summary: 'test' }),
    })
    expect(res.status).toBe(404)
  })

  it('reads file, merges session_summary, and writes back', async () => {
    vi.mocked(mockGithub.upsertFile).mockClear()

    const res = await authed('/api/content/idea-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_summary: 'My session notes' }),
    })

    expect(res.status).toBe(200)
    expect(vi.mocked(mockGithub.upsertFile)).toHaveBeenCalledOnce()

    const [filePath, content, , branch, sha] = vi.mocked(mockGithub.upsertFile).mock.calls[0]
    expect(filePath).toBe('wiki/idea-1.md')
    expect(branch).toBe('feat/idea-1')
    expect(sha).toBe('abc123')
    expect(content).toContain('session_summary: My session notes')
    expect(content).toContain('Body text')
  })
})
