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
  return { ...(data as Omit<IndexEntry, 'path'>), path };
}

const CONTENT_DIRS = ['ideas', 'plans', 'discussions', 'solutions'] as const;

export async function buildIndex(github: GitHubClient): Promise<IndexEntry[]> {
  const entries: IndexEntry[] = [];

  for (const dir of CONTENT_DIRS) {
    let files: Array<{ path: string; type: string }> = [];
    try {
      files = await github.listFiles(dir);
    } catch {
      // directory may not exist yet — skip silently
      continue;
    }

    for (const file of files) {
      if (file.type !== 'file' || !file.path.endsWith('.md')) continue;
      try {
        const { content, encoding } = await github.getFile(file.path);
        const decoded =
          encoding === 'base64' ? Buffer.from(content, 'base64').toString('utf-8') : content;
        entries.push(parseFrontmatter(decoded, file.path));
      } catch {}
    }
  }

  return entries.sort((a, b) => b.updated.localeCompare(a.updated));
}
