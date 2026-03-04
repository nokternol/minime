import { Hono } from 'hono'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import { readFileSync, writeFileSync } from 'node:fs'
import type { GoogleAuth } from '../auth/google.js'

const SESSIONS_FILE = process.env.SESSIONS_FILE ?? '/tmp/minime-sessions.json'

function loadSessions(): Map<string, { email: string; name: string }> {
  try {
    const raw = readFileSync(SESSIONS_FILE, 'utf8')
    return new Map(Object.entries(JSON.parse(raw)))
  } catch {
    return new Map()
  }
}

function saveSessions(sessions: Map<string, { email: string; name: string }>) {
  writeFileSync(SESSIONS_FILE, JSON.stringify(Object.fromEntries(sessions)))
}

const SESSIONS = loadSessions()

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
      saveSessions(SESSIONS)
      setCookie(c, 'session', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      })
      return c.redirect(process.env.PWA_ORIGIN ?? 'http://localhost:8743')
    } catch {
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
    if (sessionId) { SESSIONS.delete(sessionId); saveSessions(SESSIONS) }
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
