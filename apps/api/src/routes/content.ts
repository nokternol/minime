import { zValidator } from '@hono/zod-validator';
import matter from 'gray-matter';
import { Hono } from 'hono';
import { z } from 'zod';
import type { GitHubClient } from '../github/client.js';
import type { IndexCache } from '../store/index-cache.js';
import { requireAuth } from './auth.js';

const patchSchema = z.object({
  session_summary: z.string().min(1).max(2000).optional(),
  body: z.string().max(50000).optional(),
});

export function contentRoutes(cache: IndexCache, github: GitHubClient) {
  const app = new Hono();

  // List all — supports ?type=plan&status=active&q=search
  app.get('/api/content', requireAuth(), (c) => {
    let entries = cache.all();
    const type = c.req.query('type');
    const status = c.req.query('status');
    const q = c.req.query('q');
    if (type) entries = entries.filter((e) => e.type === type);
    if (status) entries = entries.filter((e) => e.status === status);
    if (q)
      entries = cache
        .search(q)
        .filter((e) => (!type || e.type === type) && (!status || e.status === status));
    return c.json(entries);
  });

  // Get in-flight (open PRs cross-referenced with index)
  app.get('/api/content/inflight', requireAuth(), async (c) => {
    const prs = await github.listOpenPRs();
    return c.json(
      prs.map((pr) => {
        const entry = cache.findByBranch(pr.head.ref);
        return {
          pr: pr.number,
          branch: pr.head.ref,
          title: pr.title,
          ...(entry ? { id: entry.id, type: entry.type } : {}),
        };
      })
    );
  });

  // Get full body of a single item by id
  app.get('/api/content/:id', requireAuth(), async (c) => {
    const id = c.req.param('id');
    const entry = cache.findById(id);
    if (!entry) return c.json({ error: 'not found' }, 404);

    const { content, encoding } = await github.getFile(entry.path, entry.branch ?? 'main');
    const decoded =
      encoding === 'base64' ? Buffer.from(content, 'base64').toString('utf-8') : content;

    const { data, content: body } = matter(decoded);
    return c.json({ ...entry, ...data, body });
  });

  // Patch a single item — writes session_summary into frontmatter and pushes to branch
  app.patch('/api/content/:id', requireAuth(), zValidator('json', patchSchema), async (c) => {
    const id = c.req.param('id');
    const entry = cache.findById(id);
    if (!entry) return c.json({ error: 'not found' }, 404);
    const input = c.req.valid('json');

    const { content, encoding, sha } = await github.getFile(entry.path, entry.branch ?? 'main');
    const decoded =
      encoding === 'base64' ? Buffer.from(content, 'base64').toString('utf-8') : content;

    const { data, content: existingBody } = matter(decoded);
    const updated = matter.stringify(input.body ?? existingBody, {
      ...data,
      ...(input.session_summary ? { session_summary: input.session_summary } : {}),
    });

    await github.upsertFile(
      entry.path,
      updated,
      'chore: save session summary',
      entry.branch ?? 'main',
      sha
    );
    return c.json({ ok: true });
  });

  return app;
}
