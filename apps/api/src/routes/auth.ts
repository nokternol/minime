import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { GoogleAuth } from '../auth/google.js';

const SESSIONS_FILE = process.env.SESSIONS_FILE ?? '/tmp/minime-sessions.json';
const SESSION_SECRET = process.env.SESSION_SECRET ?? '';

function signToken(id: string): string {
  const sig = createHmac('sha256', SESSION_SECRET).update(id).digest('hex');
  return `${id}.${sig}`;
}

function verifyToken(token: string): string | null {
  const dot = token.lastIndexOf('.');
  if (dot === -1) return null;
  const id = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac('sha256', SESSION_SECRET).update(id).digest('hex');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
  return id;
}

function loadSessions(): Map<string, { email: string; name: string }> {
  try {
    const raw = readFileSync(SESSIONS_FILE, 'utf8');
    return new Map(Object.entries(JSON.parse(raw)));
  } catch {
    return new Map();
  }
}

function saveSessions(sessions: Map<string, { email: string; name: string }>) {
  writeFileSync(SESSIONS_FILE, JSON.stringify(Object.fromEntries(sessions)));
}

const SESSIONS = loadSessions();

export function authRoutes(auth: GoogleAuth) {
  const app = new Hono();

  app.get('/auth/login', (c) => {
    return c.redirect(auth.getAuthUrl());
  });

  app.get('/auth/callback', async (c) => {
    const code = c.req.query('code');
    if (!code) return c.json({ error: 'no code' }, 400);
    try {
      const user = await auth.exchange(code);
      const sessionId = crypto.randomUUID();
      SESSIONS.set(sessionId, user);
      saveSessions(SESSIONS);
      const token = signToken(sessionId);
      setCookie(c, 'session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      });
      return c.redirect(process.env.PWA_ORIGIN ?? 'http://localhost:8743');
    } catch {
      return c.json({ error: 'auth failed' }, 403);
    }
  });

  app.get('/auth/me', (c) => {
    const token = getCookie(c, 'session');
    if (!token) return c.json(null);
    const sessionId = verifyToken(token);
    if (!sessionId) return c.json(null);
    const user = SESSIONS.get(sessionId);
    return c.json(user ?? null);
  });

  app.post('/auth/logout', (c) => {
    const token = getCookie(c, 'session');
    if (token) {
      const sessionId = verifyToken(token);
      if (sessionId) {
        SESSIONS.delete(sessionId);
        saveSessions(SESSIONS);
      }
    }
    deleteCookie(c, 'session');
    return c.json({ ok: true });
  });

  return app;
}

export function requireAuth(): MiddlewareHandler {
  return async (c, next) => {
    const token = getCookie(c, 'session');
    if (!token) return c.json({ error: 'unauthorized' }, 401);
    const sessionId = verifyToken(token);
    if (!sessionId || !SESSIONS.has(sessionId)) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    c.set('user', SESSIONS.get(sessionId));
    await next();
  };
}
