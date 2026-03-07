import type { IndexEntry } from '../index-builder/build.js';

export interface ContextEntry {
  id: string;
  type: string;
  title: string;
  status: string;
  tags: string[];
  summary: string;
  session_summary?: string;
}

export function assembleContext(
  entries: IndexEntry[],
  query: string | undefined,
  relatedToId: string | undefined,
  limit = 5
): ContextEntry[] {
  let scored = entries.map((e) => ({ entry: e, score: 0 }));

  if (query) {
    const q = query.toLowerCase();
    scored = scored.map(({ entry, score }) => ({
      entry,
      score:
        score +
        (entry.title.toLowerCase().includes(q) ? 3 : 0) +
        (entry.summary?.toLowerCase().includes(q) ? 2 : 0) +
        (entry.tags?.some((t) => t.toLowerCase().includes(q)) ? 1 : 0),
    }));
  }

  if (relatedToId) {
    scored = scored.map(({ entry, score }) => ({
      entry,
      score:
        score +
        (entry.related_to === relatedToId ||
        entry.promoted_from?.includes(relatedToId) ||
        entry.references?.includes(relatedToId)
          ? 4
          : 0),
    }));
  }

  return scored
    .sort(
      (a, b) =>
        b.score - a.score ||
        new Date(b.entry.updated)
          .toISOString()
          .localeCompare(new Date(a.entry.updated).toISOString())
    )
    .slice(0, limit)
    .map(({ entry }) => ({
      id: entry.id,
      type: entry.type,
      title: entry.title,
      status: entry.status,
      tags: entry.tags,
      summary: entry.summary,
      session_summary: entry.session_summary,
    }));
}

export function formatContextBlock(entries: ContextEntry[]): string {
  if (!entries.length) return 'No relevant prior context found.';
  return entries
    .map(
      (e) =>
        `[${e.type.toUpperCase()}] ${e.title} (${e.status})\nSummary: ${e.summary}\n${e.session_summary ? `Last session: ${e.session_summary}\n` : ''}Tags: ${e.tags.join(', ')}`
    )
    .join('\n\n');
}
