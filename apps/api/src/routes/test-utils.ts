import { Hono } from 'hono';
import { vi } from 'vitest';
import type { GoogleAuth } from '../auth/google.js';
import { authRoutes } from './auth.js';

export const mockAuth = {
  getAuthUrl: () => '',
  exchange: vi.fn().mockResolvedValue({ email: 'u@test.com', name: 'U', picture: '' }),
};

/** Mount authRoutes + additional routes, perform login, return {app, sessionCookie}. */
export async function makeAuthedApp(...routes: Hono[]): Promise<{ app: Hono; sessionCookie: string }> {
  const app = new Hono();
  app.onError((err, c) => c.json({ error: 'Internal server error' }, 500));
  app.route('/', authRoutes(mockAuth as unknown as GoogleAuth));
  for (const r of routes) app.route('/', r);
  const res = await app.request('/auth/callback?code=x');
  const match = (res.headers.get('set-cookie') ?? '').match(/session=([^;]+)/);
  const sessionCookie = match ? `session=${match[1]}` : '';
  return { app, sessionCookie };
}

export function authedPost(app: Hono, sessionCookie: string, path: string, body?: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: { cookie: sessionCookie, 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
