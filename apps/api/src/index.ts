import { serve } from '@hono/node-server';
import { Hono } from 'hono';

const app = new Hono();

app.get('/health', (c) => c.json({ status: 'ok' }));

const port = Number.parseInt(process.env.API_PORT ?? '8744', 10);
if (Number.isNaN(port)) throw new Error(`Invalid API_PORT: "${process.env.API_PORT}"`);
serve({ fetch: app.fetch, port });
console.log(`API running on port ${port}`);
