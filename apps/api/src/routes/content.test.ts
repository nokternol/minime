import { Hono } from 'hono';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { GoogleAuth } from '../auth/google.js';
import type { GitHubClient } from '../github/client.js';
import type { IndexEntry } from '../index-builder/build.js';
import type { IndexCache } from '../store/index-cache.js';
import { authRoutes } from './auth.js';
import { contentRoutes } from './content.js';

const ENTRIES: IndexEntry[] = [
  {
    id: 'idea-1',
    type: 'idea',
    title: 'TypeScript Idea',
    status: 'active',
    tags: ['ts'],
    summary: 'An idea',
    created: '2026-01-01T00:00:00Z',
    updated: '2026-01-02T00:00:00Z',
    path: 'ideas/ts-idea.md',
  },
  {
    id: 'plan-1',
    type: 'plan',
    title: 'My Plan',
    status: 'parked',
    tags: ['planning'],
    summary: 'A plan',
    created: '2026-01-01T00:00:00Z',
    updated: '2026-01-01T00:00:00Z',
    path: 'plans/my-plan.md',
  },
];

const mockCache = {
  all: vi.fn().mockReturnValue(ENTRIES),
  search: vi.fn((q: string) =>
    ENTRIES.filter((e) => e.title.toLowerCase().includes(q) || e.summary.toLowerCase().includes(q))
  ),
  findById: vi.fn((id: string) => ENTRIES.find((e) => e.id === id)),
  findByBranch: vi.fn().mockReturnValue(undefined),
} as unknown as IndexCache;

const mockGithub = {
  listOpenPRs: vi
    .fn()
    .mockResolvedValue([{ number: 42, title: 'Draft Idea', head: { ref: 'idea/abc-draft' } }]),
  getFile: vi.fn().mockResolvedValue({
    encoding: 'base64',
    content: Buffer.from(
      '---\nid: idea-1\ntype: idea\ntitle: TypeScript Idea\nstatus: active\ntags: [ts]\nsummary: An idea\ncreated: 2026-01-01T00:00:00Z\nupdated: 2026-01-02T00:00:00Z\n---\nThe body'
    ).toString('base64'),
  }),
} as unknown as GitHubClient;

const mockAuth = {
  getAuthUrl: () => '',
  exchange: vi.fn().mockResolvedValue({ email: 'u@test.com', name: 'U', picture: '' }),
};

let sessionCookie = '';
let app: Hono;

beforeAll(async () => {
  app = new Hono();
  app.route('/', authRoutes(mockAuth as unknown as GoogleAuth));
  app.route('/', contentRoutes(mockCache, mockGithub));
  const res = await app.request('/auth/callback?code=x');
  const match = (res.headers.get('set-cookie') ?? '').match(/session=([^;]+)/);
  sessionCookie = match ? `session=${match[1]}` : '';
});

const authed = (path: string) => app.request(path, { headers: { cookie: sessionCookie } });

describe('GET /api/content', () => {
  it('returns 401 without auth', async () => {
    expect((await app.request('/api/content')).status).toBe(401);
  });

  it('returns all entries', async () => {
    const res = await authed('/api/content');
    expect(res.status).toBe(200);
    const data = (await res.json()) as IndexEntry[];
    expect(data).toHaveLength(2);
  });

  it('filters by type', async () => {
    vi.mocked(mockCache.all).mockReturnValueOnce(ENTRIES);
    const res = await authed('/api/content?type=idea');
    const data = (await res.json()) as IndexEntry[];
    expect(data.every((e) => e.type === 'idea')).toBe(true);
  });

  it('filters by status', async () => {
    vi.mocked(mockCache.all).mockReturnValueOnce(ENTRIES);
    const res = await authed('/api/content?status=parked');
    const data = (await res.json()) as IndexEntry[];
    expect(data.every((e) => e.status === 'parked')).toBe(true);
  });

  it('delegates to cache.search when q provided', async () => {
    const res = await authed('/api/content?q=typescript');
    await res.json();
    expect(vi.mocked(mockCache.search)).toHaveBeenCalledWith('typescript');
  });
});

describe('GET /api/content/inflight', () => {
  it('returns mapped PR list without id when no cache match', async () => {
    const res = await authed('/api/content/inflight');
    const data = (await res.json()) as Array<{ pr: number; branch: string; title: string }>;
    expect(data).toHaveLength(1);
    expect(data[0]).toEqual({ pr: 42, branch: 'idea/abc-draft', title: 'Draft Idea' });
  });

  it('includes id and type when cache has matching branch entry', async () => {
    vi.mocked(mockCache.findByBranch).mockReturnValueOnce(ENTRIES[0]);
    const res = await authed('/api/content/inflight');
    const data = (await res.json()) as Array<{
      pr: number;
      branch: string;
      title: string;
      id?: string;
      type?: string;
    }>;
    expect(data[0].id).toBe('idea-1');
    expect(data[0].type).toBe('idea');
  });
});

describe('GET /api/content/:id', () => {
  it('returns 404 for unknown id', async () => {
    const res = await authed('/api/content/nonexistent');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not found' });
  });

  it('returns decoded content for known id', async () => {
    const res = await authed('/api/content/idea-1');
    expect(res.status).toBe(200);
    const data = (await res.json()) as IndexEntry & { body: string };
    expect(data.id).toBe('idea-1');
    expect(data.body).toContain('The body');
    expect(data.path).toBe('ideas/ts-idea.md');
  });
});
