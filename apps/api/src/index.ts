import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { GitHubClient } from './github/client.js'
import { IndexCache } from './store/index-cache.js'
import { GoogleAuth } from './auth/google.js'
import { authRoutes } from './routes/auth.js'
import { webhookRoutes } from './routes/webhook.js'
import { contentRoutes } from './routes/content.js'
import { lifecycleRoutes } from './routes/lifecycle.js'

const app = new Hono()

app.use('*', cors({ origin: process.env.PWA_ORIGIN ?? 'http://localhost:8743', credentials: true }))

const github = new GitHubClient(
  process.env.GITHUB_TOKEN!,
  process.env.GITHUB_OWNER!,
  process.env.GITHUB_REPO!
)
const cache = new IndexCache(github)
await cache.load()

const googleAuth = new GoogleAuth(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  `${process.env.PUBLIC_URL ?? 'http://localhost:8744'}/auth/callback`,
  process.env.ALLOWED_GOOGLE_EMAIL!
)

app.route('/', authRoutes(googleAuth))
app.route('/', webhookRoutes(cache, process.env.GITHUB_WEBHOOK_SECRET!))
app.route('/', contentRoutes(cache, github))
app.route('/', lifecycleRoutes(github, cache))
app.get('/health', (c) => c.json({ status: 'ok' }))

const port = Number.parseInt(process.env.API_PORT ?? '8744', 10)
if (Number.isNaN(port)) throw new Error(`Invalid API_PORT: "${process.env.API_PORT}"`)
serve({ fetch: app.fetch, port })
console.log(`API running on port ${port}`)
