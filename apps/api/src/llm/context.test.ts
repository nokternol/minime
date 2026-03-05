import { describe, expect, it } from 'vitest';
import type { IndexEntry } from '../index-builder/build.js';
import { assembleContext, formatContextBlock } from './context.js';

function makeEntry(
  id: string,
  title: string,
  summary: string,
  tags: string[],
  updated = '2026-01-01T00:00:00Z'
): IndexEntry {
  return {
    id,
    type: 'idea',
    title,
    status: 'active',
    tags,
    summary,
    created: updated,
    updated,
    path: `ideas/${id}.md`,
  };
}

describe('assembleContext', () => {
  it('returns top 5 by recency when no query', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      ...makeEntry(`id-${i}`, `Idea ${i}`, `Summary ${i}`, []),
      updated: `2026-0${(i % 9) + 1}-01T00:00:00Z`,
    }));
    const result = assembleContext(entries, undefined, undefined);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('scores title match higher than summary match higher than tag match', () => {
    const entries = [
      makeEntry('tag-only', 'Other', 'Other', ['typescript']),
      makeEntry('summary-only', 'Other', 'about typescript', []),
      makeEntry('title-only', 'Typescript Guide', 'other', []),
    ];
    const result = assembleContext(entries, 'typescript', undefined, 10);
    const ids = result.map((e) => e.id);
    expect(ids.indexOf('title-only')).toBeLessThan(ids.indexOf('summary-only'));
    expect(ids.indexOf('summary-only')).toBeLessThan(ids.indexOf('tag-only'));
  });

  it('boosts entries with matching related_to', () => {
    const related = { ...makeEntry('related', 'Related', 'sum', []), related_to: 'target-id' };
    const unrelated = makeEntry('unrelated', 'Unrelated', 'sum', []);
    const result = assembleContext([unrelated, related], undefined, 'target-id', 10);
    expect(result[0].id).toBe('related');
  });

  it('boosts entries with matching promoted_from', () => {
    const promoted = { ...makeEntry('promo', 'Promoted', 'sum', []), promoted_from: ['target-id'] };
    const other = makeEntry('other', 'Other', 'sum', []);
    const result = assembleContext([other, promoted], undefined, 'target-id', 10);
    expect(result[0].id).toBe('promo');
  });

  it('boosts entries with matching references', () => {
    const ref = { ...makeEntry('ref', 'Ref', 'sum', []), references: ['target-id'] };
    const other = makeEntry('other', 'Other', 'sum', []);
    const result = assembleContext([other, ref], undefined, 'target-id', 10);
    expect(result[0].id).toBe('ref');
  });

  it('respects the limit parameter', () => {
    const entries = Array.from({ length: 20 }, (_, i) => makeEntry(`id-${i}`, `T${i}`, 's', []));
    expect(assembleContext(entries, undefined, undefined, 3).length).toBe(3);
  });

  it('maps to ContextEntry shape (no extra fields)', () => {
    const entry = makeEntry('x', 'Title', 'Sum', ['t1']);
    const [result] = assembleContext([entry], undefined, undefined);
    expect(Object.keys(result).sort()).toEqual(
      ['id', 'session_summary', 'status', 'summary', 'tags', 'title', 'type'].sort()
    );
  });
});

describe('formatContextBlock', () => {
  it('returns fallback string for empty list', () => {
    expect(formatContextBlock([])).toBe('No relevant prior context found.');
  });

  it('formats entries with type, title, status, summary, tags', () => {
    const block = formatContextBlock([
      {
        id: '1',
        type: 'idea',
        title: 'My Idea',
        status: 'active',
        tags: ['a', 'b'],
        summary: 'Good idea',
      },
    ]);
    expect(block).toContain('[IDEA] My Idea (active)');
    expect(block).toContain('Summary: Good idea');
    expect(block).toContain('Tags: a, b');
  });

  it('includes session_summary when present', () => {
    const block = formatContextBlock([
      {
        id: '1',
        type: 'plan',
        title: 'T',
        status: 'draft',
        tags: [],
        summary: 's',
        session_summary: 'Last time we discussed X',
      },
    ]);
    expect(block).toContain('Last session: Last time we discussed X');
  });

  it('omits Last session line when session_summary absent', () => {
    const block = formatContextBlock([
      { id: '1', type: 'idea', title: 'T', status: 'draft', tags: [], summary: 's' },
    ]);
    expect(block).not.toContain('Last session');
  });

  it('joins multiple entries with double newline', () => {
    const entries = [
      { id: '1', type: 'idea', title: 'A', status: 'draft', tags: [], summary: 's1' },
      { id: '2', type: 'plan', title: 'B', status: 'active', tags: [], summary: 's2' },
    ];
    const block = formatContextBlock(entries);
    expect(block).toContain('\n\n');
    expect(block).toContain('[IDEA]');
    expect(block).toContain('[PLAN]');
  });
});
