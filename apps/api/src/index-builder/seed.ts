import { normalizeDocument } from '../content/normalize.js';
import type { GitHubClient } from '../github/client.js';
import type { IndexCache } from '../store/index-cache.js';
import { parseFrontmatter } from './build.js';

const CONTENT_DIRS = ['ideas', 'plans', 'discussions', 'solutions', 'insights'] as const;

export async function seedDraftEntries(github: GitHubClient, cache: IndexCache): Promise<void> {
  const prs = await github.listOpenPRs().catch(() => []);
  await Promise.allSettled(
    prs.map(async (pr) => {
      await Promise.allSettled(
        CONTENT_DIRS.map(async (dir) => {
          const files = await github.listFiles(dir, pr.head.ref).catch(() => []);
          await Promise.allSettled(
            files
              .filter((f) => f.type === 'file' && f.path.endsWith('.md'))
              .map(async (f) => {
                try {
                  const { content: raw, encoding, sha } = await github.getFile(f.path, pr.head.ref);
                  const decoded =
                    encoding === 'base64' ? Buffer.from(raw, 'base64').toString('utf-8') : raw;
                  const entry = parseFrontmatter(decoded, f.path);
                  if (!entry.id || !entry.type || !entry.title) return;
                  const normalized = normalizeDocument(decoded);
                  if (normalized !== decoded) {
                    await github.upsertFile(
                      f.path,
                      normalized,
                      'chore: migrate document to current schema',
                      pr.head.ref,
                      sha
                    );
                  }
                  cache.upsert({ ...entry, branch: pr.head.ref, pr: pr.number });
                } catch {
                  // skip individual file errors
                }
              })
          );
        })
      );
    })
  );
}
