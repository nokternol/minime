import { createHmac, timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import type { IndexCache } from '../store/index-cache.js';

export function webhookRoutes(cache: IndexCache, secret: string): Hono {
  const app = new Hono();

  app.post('/webhook/github', async (c) => {
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
      await cache.load();
      console.log('[webhook] index rebuilt after PR merge');
    }

    return c.json({ ok: true });
  });

  return app;
}
