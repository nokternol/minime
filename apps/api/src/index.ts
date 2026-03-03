import { serve } from '@hono/node-server';
import { Hono } from 'hono';

const app = new Hono();

app.get('/health', (c) => c.json({ status: 'ok' }));

const port = Number.parseInt(process.env.API_PORT ?? '8744');
serve({ fetch: app.fetch, port });
console.log(`API running on port ${port}`);
