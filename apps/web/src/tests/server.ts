import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

const BASE = 'http://localhost:8744'

export const server = setupServer(
  http.get(`${BASE}/auth/me`, () =>
    HttpResponse.json({ email: 'test@example.com', name: 'Test User' })
  ),
  http.post(`${BASE}/auth/logout`, () => HttpResponse.json({ ok: true })),
  http.get(`${BASE}/api/content`, () => HttpResponse.json([])),
  http.get(`${BASE}/api/content/inflight`, () => HttpResponse.json([])),
  http.get(`${BASE}/api/content/:id`, ({ params }) =>
    HttpResponse.json({
      id: params.id,
      type: 'idea',
      title: 'Test item',
      status: 'draft',
      tags: [],
      summary: '',
      created: '2026-01-01',
      updated: '2026-01-01',
      path: `wiki/${params.id}.md`,
      body: '',
    })
  ),
  http.post(`${BASE}/api/capture`, () =>
    HttpResponse.json({ id: 'new-id', pr: 1, branch: 'feat/new-id' })
  ),
  http.post(`${BASE}/api/chat/summarise`, () =>
    HttpResponse.json({ summary: 'Session summary text' })
  ),
  http.patch(`${BASE}/api/content/:id`, () => HttpResponse.json({ ok: true })),
  http.post(`${BASE}/api/content/:id/commit`, () => HttpResponse.json({ ok: true })),
  http.post(`${BASE}/api/content/:id/dismiss`, () => HttpResponse.json({ ok: true })),
  http.post(`${BASE}/api/chat`, () =>
    HttpResponse.json({ reply: 'Hello', context: [] })
  ),
)
