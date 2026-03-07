import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { LLMRouter } from '../llm/router.js';
import type { IndexCache } from '../store/index-cache.js';
import { chatRoutes } from './chat.js';
import { authedPost, makeAuthedApp } from './test-utils.js';

const mockCache = {
  all: vi.fn().mockReturnValue([]),
} as unknown as IndexCache;

const mockLlm = {
  chat: vi.fn().mockResolvedValue('assistant reply'),
  summarise: vi.fn().mockResolvedValue('session summary'),
  generateFrontmatter: vi.fn().mockResolvedValue({ tags: ['a'], summary: 'a summary' }),
} as unknown as LLMRouter;

let app: import('hono').Hono;
let sessionCookie: string;

beforeAll(async () => {
  const result = await makeAuthedApp(chatRoutes(mockLlm, mockCache));
  app = result.app;
  sessionCookie = result.sessionCookie;
});

const validMessages = [{ role: 'user' as const, content: 'hello' }];

describe('POST /api/chat', () => {
  it('returns 401 without auth', async () => {
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: validMessages }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing messages', async () => {
    const res = await authedPost(app, sessionCookie, '/api/chat', {});
    expect(res.status).toBe(400);
  });

  it('returns 400 for empty messages array', async () => {
    const res = await authedPost(app, sessionCookie, '/api/chat', { messages: [] });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid role', async () => {
    const res = await authedPost(app, sessionCookie, '/api/chat', {
      messages: [{ role: 'system', content: 'hi' }],
    });
    expect(res.status).toBe(400);
  });

  it('returns reply and context on valid request', async () => {
    const res = await authedPost(app, sessionCookie, '/api/chat', { messages: validMessages });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { reply: string; context: unknown[] };
    expect(data.reply).toBe('assistant reply');
    expect(Array.isArray(data.context)).toBe(true);
  });

  it('propagates LLM error as 500 via global error handler', async () => {
    vi.mocked(mockLlm.chat).mockRejectedValueOnce(new Error('LLM timeout'));
    const res = await authedPost(app, sessionCookie, '/api/chat', { messages: validMessages });
    expect(res.status).toBe(500);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe('Internal server error');
    expect(data.error).not.toContain('LLM timeout');
  });
});

describe('POST /api/chat/summarise', () => {
  it('returns 401 without auth', async () => {
    const res = await app.request('/api/chat/summarise', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ conversation: 'hi' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing conversation', async () => {
    const res = await authedPost(app, sessionCookie, '/api/chat/summarise', {});
    expect(res.status).toBe(400);
  });

  it('returns summary on valid request', async () => {
    const res = await authedPost(app, sessionCookie, '/api/chat/summarise', {
      conversation: 'user: hello\nassistant: hi',
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { summary: string };
    expect(data.summary).toBe('session summary');
  });

  it('returns 500 and safe message when summarise throws', async () => {
    vi.mocked(mockLlm.summarise).mockRejectedValueOnce(new Error('Gemini error'));
    const res = await authedPost(app, sessionCookie, '/api/chat/summarise', {
      conversation: 'user: hello',
    });
    expect(res.status).toBe(500);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe('Internal server error');
    expect(data.error).not.toContain('Gemini');
  });
});

describe('POST /api/chat/frontmatter', () => {
  it('returns 401 without auth', async () => {
    const res = await app.request('/api/chat/frontmatter', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 't', body: 'b', type: 'idea' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing fields', async () => {
    const res = await authedPost(app, sessionCookie, '/api/chat/frontmatter', { title: 'T' });
    expect(res.status).toBe(400);
  });

  it('returns tags and summary on valid request', async () => {
    const res = await authedPost(app, sessionCookie, '/api/chat/frontmatter', {
      title: 'My Idea',
      body: 'some content',
      type: 'idea',
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { tags: string[]; summary: string };
    expect(data.tags).toEqual(['a']);
    expect(data.summary).toBe('a summary');
  });
});
