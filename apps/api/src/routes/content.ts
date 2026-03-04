import { Hono } from 'hono'
import matter from 'gray-matter'
import { requireAuth } from './auth.js'
import type { IndexCache } from '../store/index-cache.js'
import type { GitHubClient } from '../github/client.js'

export function contentRoutes(cache: IndexCache, github: GitHubClient) {
  const app = new Hono()

  // List all — supports ?type=plan&status=active&q=search
  app.get('/api/content', requireAuth(), (c) => {
    let entries = cache.all()
    const type = c.req.query('type')
    const status = c.req.query('status')
    const q = c.req.query('q')
    if (type) entries = entries.filter(e => e.type === type)
    if (status) entries = entries.filter(e => e.status === status)
    if (q) entries = cache.search(q).filter(e =>
      (!type || e.type === type) && (!status || e.status === status)
    )
    return c.json(entries)
  })

  // Get in-flight (open PRs cross-referenced with index)
  app.get('/api/content/inflight', requireAuth(), async (c) => {
    const prs = await github.listOpenPRs()
    return c.json(prs.map(pr => ({
      pr: pr.number,
      branch: pr.head.ref,
      title: pr.title,
    })))
  })

  // Get full body of a single item by id
  app.get('/api/content/:id', requireAuth(), async (c) => {
    const id = c.req.param('id')
    const entry = cache.findById(id)
    if (!entry) return c.json({ error: 'not found' }, 404)

    const { content, encoding } = await github.getFile(entry.path)
    const decoded = encoding === 'base64'
      ? Buffer.from(content, 'base64').toString('utf-8')
      : content

    const { data, content: body } = matter(decoded)
    return c.json({ ...data, body, path: entry.path })
  })

  return app
}
