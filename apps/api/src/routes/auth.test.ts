import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { GoogleAuth } from '../auth/google.js';
import { authRoutes, requireAuth } from './auth.js';

const mockGoogleAuth = {
  getAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/oauth'),
  exchange: vi.fn().mockResolvedValue({ email: 'user@test.com', name: 'Test User', picture: '' }),
};

function buildApp() {
  const app = new Hono();
  app.route('/', authRoutes(mockGoogleAuth as unknown as GoogleAuth));
  app.get('/protected', requireAuth(), (c) => c.json({ ok: true }));
  return app;
}

async function getSessionCookie(app: Hono): Promise<string> {
  const res = await app.request('/auth/callback?code=testcode');
  const setCookie = res.headers.get('set-cookie') ?? '';
  const match = setCookie.match(/session=([^;]+)/);
  return match ? `session=${match[1]}` : '';
}

describe('requireAuth', () => {
  it('returns 401 with no cookie', async () => {
    const app = buildApp();
    const res = await app.request('/protected');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('returns 401 with unknown session id', async () => {
    const app = buildApp();
    const res = await app.request('/protected', { headers: { cookie: 'session=unknown-id' } });
    expect(res.status).toBe(401);
  });

  it('passes through with valid session', async () => {
    const app = buildApp();
    const cookie = await getSessionCookie(app);
    const res = await app.request('/protected', { headers: { cookie } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe('authRoutes', () => {
  it('GET /auth/login redirects to oauth url', async () => {
    const app = buildApp();
    const res = await app.request('/auth/login');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://accounts.google.com/oauth');
  });

  it('GET /auth/callback without code returns 400', async () => {
    const app = buildApp();
    const res = await app.request('/auth/callback');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'no code' });
  });

  it('GET /auth/callback with valid code sets session cookie and redirects', async () => {
    const app = buildApp();
    const res = await app.request('/auth/callback?code=abc');
    expect(res.status).toBe(302);
    expect(res.headers.get('set-cookie')).toMatch(/session=/);
  });

  it('GET /auth/callback with failing exchange returns 403', async () => {
    const app = buildApp();
    mockGoogleAuth.exchange.mockRejectedValueOnce(new Error('not allowed'));
    const res = await app.request('/auth/callback?code=bad');
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'auth failed' });
  });

  it('GET /auth/me returns null without session', async () => {
    const app = buildApp();
    const res = await app.request('/auth/me');
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it('GET /auth/me returns user with valid session', async () => {
    const app = buildApp();
    const cookie = await getSessionCookie(app);
    const res = await app.request('/auth/me', { headers: { cookie } });
    expect(await res.json()).toMatchObject({ email: 'user@test.com', name: 'Test User' });
  });

  it('POST /auth/logout clears session so subsequent /auth/me returns null', async () => {
    const app = buildApp();
    const cookie = await getSessionCookie(app);
    await app.request('/auth/logout', { method: 'POST', headers: { cookie } });
    const res = await app.request('/auth/me', { headers: { cookie } });
    expect(await res.json()).toBeNull();
  });
});
