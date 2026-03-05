import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import cron from 'node-cron';
import { GoogleAuth } from './auth/google.js';
import { GitHubClient } from './github/client.js';
import { runParkedAnalysis } from './jobs/parked-analysis.js';
import { LLMRouter } from './llm/router.js';
import { authRoutes } from './routes/auth.js';
import { chatRoutes } from './routes/chat.js';
import { contentRoutes } from './routes/content.js';
import { lifecycleRoutes } from './routes/lifecycle.js';
import { webhookRoutes } from './routes/webhook.js';
import { IndexCache } from './store/index-cache.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const app = new Hono();

app.use(
  '*',
  cors({ origin: process.env.PWA_ORIGIN ?? 'http://localhost:8743', credentials: true })
);

const github = new GitHubClient(
  requireEnv('GITHUB_TOKEN'),
  requireEnv('GITHUB_OWNER'),
  requireEnv('GITHUB_REPO')
);
const cache = new IndexCache(github);
await cache.load();

const googleAuth = new GoogleAuth(
  requireEnv('GOOGLE_CLIENT_ID'),
  requireEnv('GOOGLE_CLIENT_SECRET'),
  `${process.env.PUBLIC_URL ?? 'http://localhost:8744'}/auth/callback`,
  requireEnv('ALLOWED_GOOGLE_EMAIL')
);

app.route('/', authRoutes(googleAuth));
app.route('/', webhookRoutes(cache, requireEnv('GITHUB_WEBHOOK_SECRET')));
app.route('/', contentRoutes(cache, github));
app.route('/', lifecycleRoutes(github, cache));
const llm = new LLMRouter(requireEnv('ANTHROPIC_API_KEY'), requireEnv('GEMINI_API_KEY'));
app.route('/', chatRoutes(llm, cache));
app.get('/health', (c) => c.json({ status: 'ok' }));

const port = Number.parseInt(process.env.API_PORT ?? '8744', 10);
if (Number.isNaN(port)) throw new Error(`Invalid API_PORT: "${process.env.API_PORT}"`);
serve({ fetch: app.fetch, port });
console.log(`API running on port ${port}`);

const analysisCron = process.env.PARKED_ANALYSIS_CRON ?? '0 9 * * 1';
cron.schedule(analysisCron, () => runParkedAnalysis(llm, cache, github));
console.log(`Parked analysis scheduled: ${analysisCron}`);
