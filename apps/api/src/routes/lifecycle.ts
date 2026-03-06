import { Hono } from 'hono';
import matter from 'gray-matter';
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

  // Park — set status to parked in GitHub and cache
  app.post('/api/content/:id/park', requireAuth(), async (c) => {
    const entry = cache.findById(c.req.param('id'));
    if (!entry) return c.json({ error: 'not found' }, 404);

    try {
      const { content, encoding, sha } = await github.getFile(entry.path, entry.branch ?? 'main');
      const decoded =
        encoding === 'base64' ? Buffer.from(content, 'base64').toString('utf-8') : content;
      const { data, content: body } = matter(decoded);
      const updated = matter.stringify(body, { ...data, status: 'parked' });
      await github.upsertFile(
        entry.path,
        updated,
        'chore: park entry',
        entry.branch ?? 'main',
        sha
      );
      cache.upsert({ ...entry, status: 'parked' });
      return c.json({ ok: true });
    } catch (err) {
      console.error('[park]', err);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  return app;
}
