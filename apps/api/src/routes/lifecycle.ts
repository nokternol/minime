import { Hono } from 'hono';
import { buildDocument } from '../content/document.js';
import type { GitHubClient } from '../github/client.js';
import type { IndexCache } from '../store/index-cache.js';
import { requireAuth } from './auth.js';

export function lifecycleRoutes(github: GitHubClient, cache: IndexCache) {
  const app = new Hono();

  // Capture new item
  app.post('/api/capture', requireAuth(), async (c) => {
    const input = await c.req.json();
    try {
      const doc = buildDocument(input);
      await github.createBranch(doc.branchName);
      await github.upsertFile(doc.path, doc.content, `capture: ${input.title}`, doc.branchName);
      const pr = await github.createPR(`[${input.type}] ${input.title}`, doc.branchName);
      const now = new Date().toISOString();
      cache.upsert({
        id: doc.id,
        type: input.type,
        title: input.title,
        status: 'draft',
        tags: input.tags ?? [],
        summary: input.summary ?? '',
        created: now,
        updated: now,
        path: doc.path,
        branch: doc.branchName,
        pr: pr.number,
      });
      return c.json({ id: doc.id, path: doc.path, pr: pr.number, branch: doc.branchName });
    } catch (err) {
      console.error('[capture]', err);
      return c.json({ error: String(err) }, 500);
    }
  });

  // Commit to memory (merge PR)
  app.post('/api/content/:id/commit', requireAuth(), async (c) => {
    const entry = cache.findById(c.req.param('id'));
    if (!entry?.pr) return c.json({ error: 'no open PR' }, 404);
    await github.mergePR(entry.pr);
    if (entry.branch) await github.deleteBranch(entry.branch);
    return c.json({ ok: true });
  });

  // Dismiss (close PR without merge)
  app.post('/api/content/:id/dismiss', requireAuth(), async (c) => {
    const entry = cache.findById(c.req.param('id'));
    if (!entry?.pr) return c.json({ error: 'no open PR' }, 404);
    await github.closePR(entry.pr);
    if (entry.branch) await github.deleteBranch(entry.branch);
    return c.json({ ok: true });
  });

  // Park (status update handled by next save)
  app.post('/api/content/:id/park', requireAuth(), (c) => {
    const entry = cache.findById(c.req.param('id'));
    if (!entry) return c.json({ error: 'not found' }, 404);
    return c.json({ ok: true, note: 'status updated via next save' });
  });

  return app;
}
