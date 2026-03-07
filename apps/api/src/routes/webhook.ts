import { createHmac, timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { IndexCache } from '../store/index-cache.js';

export function webhookRoutes(cache: IndexCache, secret: string): Hono {
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
    const payload = JSON.parse(body) as { action?: string; pull_request?: { merged?: boolean } };

    if (event === 'pull_request' && payload.action === 'closed' && payload.pull_request?.merged) {
      // Respond immediately; rebuild asynchronously to avoid GitHub 10s timeout + retry race
      setImmediate(() => {
        cache.load().catch((err) => console.error('[webhook] index rebuild failed:', err));
      });
    }

    return c.json({ ok: true }, 202);
  });

  return app;
}
