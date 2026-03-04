# minime

A Claude-first personal knowledge base for ADHD brains. Claude writes and organises; GitHub is the storage layer.

**Stack:** SvelteKit PWA · Hono API · GitHub REST API (no git binary) · Claude Sonnet · Gemini Flash · Google OAuth

---

## How it works

Ideas, plans, discussions and solutions are stored as Markdown files with YAML frontmatter in a private GitHub repository. The API maintains an in-memory index rebuilt on every PR merge via GitHub webhook. Claude handles reasoning and writing; Gemini handles summarisation and pattern detection.

Content lifecycle: `capture → branch + PR → chat/refine → commit to main (merge)`.

---

## Configuration

All configuration is via environment variables. Copy `.env.example` to `.env` and fill in each value.

```sh
cp .env.example .env
```

### Google OAuth

Used for single-account authentication. Only the configured email address can sign in.

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**
2. Create an **OAuth 2.0 Client ID** (application type: Web application)
3. Add an authorised redirect URI:
   - Local: `http://localhost:8744/auth/callback`
   - Production: `https://your-domain.com/auth/callback` (must match `PUBLIC_URL` below)

| Variable | Where to find it |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth client ID from the credential you created |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret from the same credential |
| `ALLOWED_GOOGLE_EMAIL` | Your Gmail address — the only address allowed to sign in |

### GitHub

Used for all content storage. You need a **private** repository for the wiki data (separate from this code repository).

1. Create a private GitHub repo for data (e.g. `yourname/minime-data`) — leave it empty
2. Go to [github.com/settings/tokens](https://github.com/settings/tokens) → **Generate new token (classic)**
3. Grant scopes: `repo` (full), `delete:repo` is not needed

| Variable | Value |
|---|---|
| `GITHUB_TOKEN` | The classic PAT you generated |
| `GITHUB_OWNER` | Your GitHub username |
| `GITHUB_REPO` | Name of the data repository (e.g. `minime-data`) |
| `GITHUB_WEBHOOK_SECRET` | Any random string — you will use this again when configuring the webhook below |

**Webhook setup** (required for the index to refresh on merge):

1. Go to your data repo → **Settings** → **Webhooks** → **Add webhook**
2. Payload URL: `https://your-domain.com/webhook` (or `http://host.docker.internal:8744/webhook` for local testing via a tunnel)
3. Content type: `application/json`
4. Secret: the same value as `GITHUB_WEBHOOK_SECRET`
5. Events: select **Pull requests** only

### LLMs

| Variable | Where to find it |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/) → API Keys |
| `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com/) → Get API key |

Note: Anthropic API billing is separate from Claude Code subscription billing.

### URLs and ports

| Variable | Default | Purpose |
|---|---|---|
| `API_PORT` | `8744` | Port the Hono API listens on |
| `PWA_PORT` | `8743` | Port the SvelteKit app listens on |
| `PUBLIC_URL` | `http://localhost:8744` | External URL of the API — used to build the OAuth callback URL |
| `PWA_ORIGIN` | `http://localhost:8743` | Origin of the web app — used for CORS |
| `PUBLIC_API_URL` | `http://localhost:8744` | URL the browser uses to reach the API (SvelteKit env var) |

In production with a reverse proxy, set `PUBLIC_URL` and `PWA_ORIGIN` to your public HTTPS URLs and `PUBLIC_API_URL` to the same API URL the browser will use.

### Schedule

| Variable | Default | Purpose |
|---|---|---|
| `PARKED_ANALYSIS_CRON` | `0 9 * * 1` | When to run the parked-idea pattern analysis (Monday 09:00 UTC) |

---

## Deploying to production

The recommended deployment is Docker Compose pulling pre-built images from GHCR. GitHub Actions builds and pushes new images on every push to `main` that touches `apps/api/**` or `apps/web/**`.

Images:
- `ghcr.io/nokternol/minime-api:latest`
- `ghcr.io/nokternol/minime-web:latest`

Create a `docker-compose.prod.yml` on your server:

```yaml
services:
  api:
    image: ghcr.io/nokternol/minime-api:latest
    restart: unless-stopped
    ports:
      - "8744:8744"
    env_file: .env
    environment:
      API_PORT: "8744"

  web:
    image: ghcr.io/nokternol/minime-web:latest
    restart: unless-stopped
    ports:
      - "8743:8743"
    env_file: .env
    environment:
      PORT: "8743"
    depends_on:
      - api
```

Deploy:

```sh
# Pull latest images and restart
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

**Reverse proxy:** Point your reverse proxy (nginx, Caddy, Traefik) at ports 8743 (web) and 8744 (api). Both services must be reachable from the browser — the web app calls the API directly from the browser, not server-side.

**GHCR authentication:** If the repository is private, log in first:

```sh
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
```

---

## Running locally (development)

### Prerequisites

- Node.js 22+
- A `.env` file with all required values (see Configuration above)

### Install dependencies

```sh
npm install
```

### Start both services

Open two terminals:

```sh
# Terminal 1 — API (hot-reload)
cd apps/api
npm run dev
```

```sh
# Terminal 2 — Web (hot-reload)
cd apps/web
npm run dev
```

API is available at `http://localhost:8744`, web at `http://localhost:8743`.

For Google OAuth to work locally, `http://localhost:8744/auth/callback` must be in your Google OAuth client's authorised redirect URIs.

### Using Claude Code skills

The `skills/` directory contains Claude Code skills for the main workflows:

| Skill | What it does |
|---|---|
| `minime:capture` | Capture a new idea or item |
| `minime:continue` | Resume work on an in-flight item |
| `minime:save` | Save conversation progress back to the document |
| `minime:promote` | Promote an idea to a plan |

---

## Running tests

Tests cover the API only (unit + integration with mocked GitHub client).

```sh
# Run all tests
cd apps/api
npm test

# Run with coverage report
npm run test -- --coverage
```

Coverage is reported in the terminal. Key modules tested: frontmatter parsing, index builder, context assembler, auth middleware, content/lifecycle/chat routes.
