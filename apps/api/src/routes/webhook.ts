import { createHmac, timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { normalizeDocument } from '../content/normalize.js';
import type { GitHubClient } from '../github/client.js';
import type { IndexCache } from '../store/index-cache.js';

export function webhookRoutes(cache: IndexCache, github: GitHubClient, secret: string): Hono {
  const app = new Hono();

  app.post('/webhook/github', bodyLimit({ maxSize: 256 * 1024 }), async (c) => {
    const sig = c.req.header('x-hub-signature-256') ?? '';
    const body = await c.req.text();

    const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

    // Use timing-safe comparison to prevent timing attacks
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    const valid = sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);

    if (!valid) return c.json({ error: 'invalid signature' }, 401);

    const event = c.req.header('x-github-event');
    const payload = JSON.parse(body) as {
      action?: string;
      pull_request?: { merged?: boolean; head?: { ref?: string } };
    };

    if (event === 'pull_request' && payload.action === 'closed' && payload.pull_request?.merged) {
      const branch = payload.pull_request.head?.ref;
      const entry = branch ? cache.findByBranch(branch) : undefined;
      // Respond immediately; rebuild asynchronously to avoid GitHub 10s timeout + retry race
      setImmediate(() => {
        (async () => {
          // Normalize the just-merged file before rebuilding the index
          if (entry) {
            try {
              const { content: raw, encoding, sha } = await github.getFile(entry.path, 'main');
              const decoded =
                encoding === 'base64' ? Buffer.from(raw, 'base64').toString('utf-8') : raw;
              const normalized = normalizeDocument(decoded);
              if (normalized !== decoded) {
                await github.upsertFile(
                  entry.path,
                  normalized,
                  'chore: normalize schema',
                  'main',
                  sha
                );
              }
            } catch (err) {
              console.warn('[webhook] normalize failed (non-fatal):', err);
            }
          }
          cache.load().catch((err) => console.error('[webhook] index rebuild failed:', err));
        })();
      });
    }

    return c.json({ ok: true }, 202);
  });

  return app;
}
