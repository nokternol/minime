import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

describe('global error handler', () => {
  it('returns generic 500 for thrown errors without leaking details', async () => {
    const app = new Hono();
    app.onError((err, c) => {
      console.error('[api-error]', err);
      return c.json({ error: 'Internal server error' }, 500);
    });
    app.get('/boom', () => {
      throw new Error('secret token = abc123');
    });

    const res = await app.request('/boom');
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('abc123');
  });
});
