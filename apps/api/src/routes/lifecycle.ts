import { zValidator } from '@hono/zod-validator';
import matter from 'gray-matter';
import { Hono } from 'hono';
import { z } from 'zod';
import { buildDocument } from '../content/document.js';
import type { GitHubClient } from '../github/client.js';
import { runNormalizeBrain } from '../jobs/normalize-brain.js';
import type { IndexCache } from '../store/index-cache.js';
import { requireAuth } from './auth.js';

// eslint-disable-next-line no-control-regex
const NULL_CHAR_RE = new RegExp(String.fromCharCode(0), 'g');
const SAFE_STRING = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .transform((s) => s.replace(NULL_CHAR_RE, '').trim());

const captureSchema = z.object({
  type: z.enum(['idea', 'plan', 'discussion', 'solution']),
  title: SAFE_STRING(200),
  tags: z.array(z.string().max(50)).max(20).default([]),
  summary: z.string().max(500).default(''),
  body: z.string().max(50000).default(''),
  related_to: z.string().optional(),
  promoted_from: z.array(z.string()).optional(),
  language: z.string().max(50).optional(),
  problem: z.string().max(2000).optional(),
});

export function lifecycleRoutes(github: GitHubClient, cache: IndexCache) {
  const app = new Hono();

  // Capture new item
  app.post('/api/capture', requireAuth(), zValidator('json', captureSchema), async (c) => {
    const input = c.req.valid('json');
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
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // Commit to memory (merge PR)
  app.post('/api/content/:id/commit', requireAuth(), async (c) => {
    const entry = cache.findById(c.req.param('id'));
    if (!entry?.pr) return c.json({ error: 'no open PR' }, 404);
    try {
      await github.mergePR(entry.pr);
    } catch (err) {
      console.error('[commit] mergePR failed', err);
      return c.json({ error: 'Internal server error' }, 500);
    }
    try {
      if (entry.branch) await github.deleteBranch(entry.branch);
    } catch (err) {
      // Branch deletion failure is non-fatal — PR is already merged
      console.warn('[commit] deleteBranch failed (non-fatal)', err);
    }
    cache.upsert({ ...entry, pr: undefined, branch: undefined, status: 'done' });
    return c.json({ ok: true });
  });

  // Dismiss (close PR without merge)
  app.post('/api/content/:id/dismiss', requireAuth(), async (c) => {
    const entry = cache.findById(c.req.param('id'));
    if (!entry?.pr) return c.json({ error: 'no open PR' }, 404);
    try {
      await github.closePR(entry.pr);
    } catch (err) {
      console.error('[dismiss] closePR failed', err);
      return c.json({ error: 'Internal server error' }, 500);
    }
    try {
      if (entry.branch) await github.deleteBranch(entry.branch);
    } catch (err) {
      console.warn('[dismiss] deleteBranch failed (non-fatal)', err);
    }
    cache.upsert({ ...entry, pr: undefined, branch: undefined, status: 'dismissed' });
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

  // Discard orphan PR — by PR number, no cache entry required
  app.post('/api/inflight/:pr/discard', requireAuth(), async (c) => {
    const pr = Number(c.req.param('pr'));
    if (!Number.isFinite(pr)) return c.json({ error: 'invalid pr' }, 400);
    try {
      await github.closePR(pr);
      return c.json({ ok: true });
    } catch (err) {
      console.error('[discard-orphan]', err);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // Admin: normalize all committed content on main
  app.post('/api/admin/normalize', requireAuth(), async (c) => {
    const { scanned, updated } = await runNormalizeBrain(github);
    return c.json({ scanned, updated });
  });

  return app;
}
