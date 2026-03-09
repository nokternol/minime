import { normalizeDocument } from '../content/normalize.js';
import type { GitHubClient } from '../github/client.js';
import { CONTENT_DIRS } from '../index-builder/build.js';

export async function runNormalizeBrain(
  github: GitHubClient
): Promise<{ scanned: number; updated: number }> {
  let scanned = 0;
  let updated = 0;
  for (const dir of CONTENT_DIRS) {
    const files = await github.listFiles(dir, 'main').catch(() => []);
    for (const f of files) {
      if (f.type !== 'file' || !f.path.endsWith('.md')) continue;
      scanned++;
      try {
        const { content: raw, encoding, sha } = await github.getFile(f.path, 'main');
        const decoded = encoding === 'base64' ? Buffer.from(raw, 'base64').toString('utf-8') : raw;
        const normalized = normalizeDocument(decoded);
        if (normalized !== decoded) {
          await github.upsertFile(f.path, normalized, 'chore: normalize schema', 'main', sha);
          updated++;
        }
      } catch {
        // skip individual file errors
      }
    }
  }
  return { scanned, updated };
}
