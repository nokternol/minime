import { createHmac } from 'node:crypto';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { GitHubClient } from '../github/client.js';
import type { IndexCache } from '../store/index-cache.js';
import { webhookRoutes } from './webhook.js';

const SECRET = 'test-webhook-secret';

function sign(body: string): string {
  return `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`;
}

const mockCache = {
  load: async () => {},
  findByBranch: () => undefined,
} as unknown as IndexCache;

const mockGitHub = {
  getFile: async () => ({ content: '', encoding: 'utf-8', sha: 'abc' }),
} as unknown as GitHubClient;

function makeApp() {
  const app = new Hono();
  app.route('/', webhookRoutes(mockCache, mockGitHub, SECRET));
  return app;
}

describe('webhookRoutes', () => {
  it('returns 401 with invalid signature', async () => {
    const app = makeApp();
    const body = JSON.stringify({ action: 'closed', pull_request: { merged: true } });
    const res = await app.request('/webhook/github', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': 'sha256=bad',
        'x-github-event': 'pull_request',
      },
      body,
    });
    expect(res.status).toBe(401);
  });

  it('returns 202 with valid signature on non-merge event', async () => {
    const app = makeApp();
    const body = JSON.stringify({ action: 'opened', pull_request: { merged: false } });
    const res = await app.request('/webhook/github', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': sign(body),
        'x-github-event': 'pull_request',
      },
      body,
    });
    expect(res.status).toBe(202);
  });

  it('schedules cache.load on PR merged event and returns 202 immediately', async () => {
    let loadCalled = false;
    const cache = {
      load: async () => {
        loadCalled = true;
      },
    } as unknown as IndexCache;
    const app = new Hono();
    app.route('/', webhookRoutes(cache, mockGitHub, SECRET));

    const body = JSON.stringify({ action: 'closed', pull_request: { merged: true } });
    const res = await app.request('/webhook/github', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': sign(body),
        'x-github-event': 'pull_request',
      },
      body,
    });
    expect(res.status).toBe(202);
    // Allow setImmediate callback to run
    await new Promise((resolve) => setImmediate(resolve));
    expect(loadCalled).toBe(true);
  });
});
