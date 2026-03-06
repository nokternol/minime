import { Hono } from 'hono';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { GoogleAuth } from '../auth/google.js';
import type { GitHubClient } from '../github/client.js';
import type { IndexCache } from '../store/index-cache.js';
import { authRoutes } from './auth.js';
import { lifecycleRoutes } from './lifecycle.js';

const entryWithPR = {
  id: 'idea-1',
  type: 'idea',
  title: 'T',
  status: 'draft',
  tags: [],
  summary: 's',
  created: '',
  updated: '',
  path: 'ideas/t.md',
  pr: 7,
  branch: 'idea/abc',
};
const entryNoPR = { ...entryWithPR, id: 'idea-2', pr: undefined, branch: undefined };

const mockCache = {
  findById: vi.fn((id: string) => {
    if (id === 'idea-1') return entryWithPR;
    if (id === 'idea-2') return entryNoPR;
    return undefined;
  }),
  upsert: vi.fn(),
} as unknown as IndexCache;

const mockGithub = {
  createBranch: vi.fn().mockResolvedValue({}),
  upsertFile: vi.fn().mockResolvedValue({}),
  createPR: vi.fn().mockResolvedValue({ number: 99, html_url: 'https://github.com/pr/99' }),
  mergePR: vi.fn().mockResolvedValue({}),
  closePR: vi.fn().mockResolvedValue({}),
  deleteBranch: vi.fn().mockResolvedValue({}),
  getFile: vi.fn(),
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
  app.route('/', lifecycleRoutes(mockGithub, mockCache));
  const res = await app.request('/auth/callback?code=x');
  const match = (res.headers.get('set-cookie') ?? '').match(/session=([^;]+)/);
  sessionCookie = match ? `session=${match[1]}` : '';
});

function post(path: string, body?: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: { cookie: sessionCookie, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('POST /api/capture', () => {
  it('returns 401 without auth', async () => {
    const res = await app.request('/api/capture', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid type', async () => {
    const res = await post('/api/capture', {
      type: '../../evil',
      title: 'Escape',
      tags: [],
      summary: 's',
      body: 'b',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing title', async () => {
    const res = await post('/api/capture', { type: 'idea', tags: [], summary: 's', body: 'b' });
    expect(res.status).toBe(400);
  });

  it('creates branch, file, and PR then returns ids', async () => {
    const res = await post('/api/capture', {
      type: 'idea',
      title: 'New Idea',
      tags: ['ts'],
      summary: 's',
      body: 'body text',
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { id: string; pr: number; branch: string };
    expect(data.id).toBeTruthy();
    expect(data.pr).toBe(99);
    expect(mockGithub.createBranch).toHaveBeenCalled();
    expect(mockGithub.upsertFile).toHaveBeenCalled();
    expect(mockGithub.createPR).toHaveBeenCalled();
  });
});

describe('POST /api/content/:id/commit', () => {
  it('returns 404 when no open PR on entry', async () => {
    const res = await post('/api/content/idea-2/commit');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no open PR' });
  });

  it('merges PR and deletes branch', async () => {
    vi.mocked(mockGithub.mergePR).mockClear();
    vi.mocked(mockGithub.deleteBranch).mockClear();
    const res = await post('/api/content/idea-1/commit');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockGithub.mergePR).toHaveBeenCalledWith(7);
    expect(mockGithub.deleteBranch).toHaveBeenCalledWith('idea/abc');
  });
});

describe('POST /api/content/:id/dismiss', () => {
  it('returns 404 when no open PR on entry', async () => {
    const res = await post('/api/content/idea-2/dismiss');
    expect(res.status).toBe(404);
  });

  it('closes PR and deletes branch', async () => {
    vi.mocked(mockGithub.closePR).mockClear();
    vi.mocked(mockGithub.deleteBranch).mockClear();
    const res = await post('/api/content/idea-1/dismiss');
    expect(res.status).toBe(200);
    expect(mockGithub.closePR).toHaveBeenCalledWith(7);
    expect(mockGithub.deleteBranch).toHaveBeenCalledWith('idea/abc');
  });
});

describe('POST /api/content/:id/park', () => {
  it('returns 404 for unknown entry', async () => {
    const res = await post('/api/content/unknown/park');
    expect(res.status).toBe(404);
  });

  it('updates frontmatter to parked status and calls upsertFile', async () => {
    vi.mocked(mockGithub.getFile).mockResolvedValueOnce({
      content: Buffer.from(
        '---\nid: "idea-1"\ntitle: "T"\nstatus: "draft"\ntype: "idea"\ntags: []\nsummary: "s"\ncreated: ""\nupdated: ""\nbranch: "idea/abc"\n---\n\nbody'
      ).toString('base64'),
      encoding: 'base64',
      sha: 'abc123',
    });
    vi.mocked(mockGithub.upsertFile).mockClear();
    vi.mocked(mockCache.upsert).mockClear();

    const res = await post('/api/content/idea-1/park');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockGithub.upsertFile).toHaveBeenCalledTimes(1);
    const [, content] = vi.mocked(mockGithub.upsertFile).mock.calls[0];
    expect(content).toContain('status: parked');
    expect(mockCache.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'idea-1', status: 'parked' })
    );
  });
});
