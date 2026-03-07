import matter from 'gray-matter';
import type { GitHubClient } from '../github/client.js';

export type ContentType = 'idea' | 'plan' | 'discussion' | 'solution' | 'insight';
export type ContentStatus = 'draft' | 'active' | 'parked' | 'promoted' | 'done' | 'dismissed';

export interface IndexEntry {
  id: string;
  type: ContentType;
  title: string;
  status: ContentStatus;
  tags: string[];
  summary: string;
  created: string;
  updated: string;
  path: string;
  // optional shared
  branch?: string;
  pr?: number;
  // idea-specific
  promoted_to?: string;
  // plan-specific
  promoted_from?: string[];
  priority?: 'low' | 'medium' | 'high' | 'critical';
  related_solutions?: string[];
  // discussion-specific
  related_to?: string;
  session_summary?: string;
  // solution-specific
  language?: string;
  problem?: string;
  related_plan?: string;
  // insight-specific
  subtype?: 'pattern' | 'milestone' | 'review';
  generated_by?: string;
  references?: string[];
}

export function parseFrontmatter(content: string, path: string): IndexEntry {
  const { data } = matter(content);
  const entry = data as Record<string, unknown>;

  // Normalize tags: scalar string → single-element array; coerce all elements to string
  if (!Array.isArray(entry.tags)) {
    entry.tags = entry.tags != null ? [String(entry.tags)] : [];
  } else {
    entry.tags = (entry.tags as unknown[]).map((t) => String(t));
  }

  // Normalize id: YAML parses bare integers as numbers; coerce to string
  if (typeof entry.id === 'number') {
    entry.id = String(entry.id);
  }

  return { ...(entry as Omit<IndexEntry, 'path'>), path };
}

const CONTENT_DIRS = ['ideas', 'plans', 'discussions', 'solutions', 'insights'] as const;

async function fetchEntry(
  github: GitHubClient,
  file: { path: string; type: string }
): Promise<IndexEntry | null> {
  if (file.type !== 'file' || !file.path.endsWith('.md')) return null;
  try {
    const { content, encoding } = await github.getFile(file.path);
    const decoded =
      encoding === 'base64' ? Buffer.from(content, 'base64').toString('utf-8') : content;
    const entry = parseFrontmatter(decoded, file.path);
    if (!entry.id || !entry.type || !entry.title) {
      console.warn(`[index-builder] skipping ${file.path}: missing required frontmatter fields`);
      return null;
    }
    return entry;
  } catch (err) {
    console.warn(
      `[index-builder] skipping ${file.path}:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

export async function buildIndex(github: GitHubClient): Promise<IndexEntry[]> {
  const dirResults = await Promise.allSettled(CONTENT_DIRS.map((dir) => github.listFiles(dir)));

  const fileResults = await Promise.allSettled(
    dirResults.flatMap((result, i) => {
      if (result.status === 'rejected') return []; // directory may not exist yet
      return result.value.map((file) => fetchEntry(github, file));
    })
  );

  const entries = fileResults
    .filter((r): r is PromiseFulfilledResult<IndexEntry | null> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((e): e is IndexEntry => e !== null);

  return entries.sort(
    (a, b) => new Date(b.updated as string).getTime() - new Date(a.updated as string).getTime()
  );
}
