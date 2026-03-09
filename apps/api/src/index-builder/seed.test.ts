import { describe, expect, it, vi } from 'vitest';
import type { GitHubClient } from '../github/client.js';
import type { IndexCache } from '../store/index-cache.js';
import { seedDraftEntries } from './seed.js';

const RAW_DOC = Buffer.from(`---
id: "01JTEST"
type: idea
title: Draft Idea
status: draft
tags:
  - ts
summary: A draft
created: "2026-01-01T00:00:00Z"
updated: "2026-01-01T00:00:00Z"
---
Body
`).toString('base64');

function makeMocks() {
  const mockGitHub = {
    listOpenPRs: vi
      .fn()
      .mockResolvedValue([
        { number: 7, title: 'Draft Idea', head: { ref: 'idea/01jtest-draft-idea' } },
      ]),
    listFiles: vi.fn().mockImplementation((_dir: string, _branch: string) => {
      if (_dir === 'ideas') {
        return Promise.resolve([{ name: 'draft.md', path: 'ideas/draft.md', type: 'file' }]);
      }
      return Promise.resolve([]);
    }),
    getFile: vi.fn().mockResolvedValue({ content: RAW_DOC, encoding: 'base64', sha: 'abc' }),
    upsertFile: vi.fn().mockResolvedValue({}),
  } as unknown as GitHubClient;

  const mockCache = {
    upsert: vi.fn(),
  } as unknown as IndexCache;

  return { mockGitHub, mockCache };
}

describe('seedDraftEntries', () => {
  it('upserts cache entry for each open PR file', async () => {
    const { mockGitHub, mockCache } = makeMocks();
    await seedDraftEntries(mockGitHub, mockCache);
    expect(mockCache.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: '01JTEST', branch: 'idea/01jtest-draft-idea', pr: 7 })
    );
  });

  it('skips files with missing required frontmatter', async () => {
    const badDoc = Buffer.from(`---
type: idea
title: T
---
`).toString('base64');
    const { mockGitHub, mockCache } = makeMocks();
    vi.mocked(mockGitHub.getFile).mockResolvedValueOnce({
      content: badDoc,
      encoding: 'base64',
      sha: 'abc',
    });
    await seedDraftEntries(mockGitHub, mockCache);
    expect(mockCache.upsert).not.toHaveBeenCalled();
  });

  it('writes back normalized document when content differs', async () => {
    // Doc without tags — normalizeDocument will add tags: []
    const missingTagsDoc = Buffer.from(`---
id: "01JTEST"
type: idea
title: Draft Idea
status: draft
summary: A draft
created: "2026-01-01T00:00:00Z"
updated: "2026-01-01T00:00:00Z"
---
Body
`).toString('base64');
    const { mockGitHub, mockCache } = makeMocks();
    vi.mocked(mockGitHub.getFile).mockResolvedValueOnce({
      content: missingTagsDoc,
      encoding: 'base64',
      sha: 'sha-xyz',
    });
    await seedDraftEntries(mockGitHub, mockCache);
    expect(mockGitHub.upsertFile).toHaveBeenCalledWith(
      'ideas/draft.md',
      expect.stringContaining('tags'),
      'chore: migrate document to current schema',
      'idea/01jtest-draft-idea',
      'sha-xyz'
    );
  });

  it('upserts cache entry even when document is already normalized (no write-back needed)', async () => {
    // Use a doc that is already in gray-matter canonical form (already passed through once)
    // so normalized === decoded and upsertFile is NOT called
    const { normalizeDocument } = await import('../content/normalize.js');
    const canonicalDoc = normalizeDocument(Buffer.from(RAW_DOC, 'base64').toString('utf-8'));
    const canonicalB64 = Buffer.from(canonicalDoc).toString('base64');

    const { mockGitHub, mockCache } = makeMocks();
    vi.mocked(mockGitHub.getFile).mockResolvedValueOnce({
      content: canonicalB64,
      encoding: 'base64',
      sha: 'abc',
    });
    await seedDraftEntries(mockGitHub, mockCache);
    expect(mockGitHub.upsertFile).not.toHaveBeenCalled();
    expect(mockCache.upsert).toHaveBeenCalled();
  });

  it('handles empty PR list gracefully', async () => {
    const { mockGitHub, mockCache } = makeMocks();
    vi.mocked(mockGitHub.listOpenPRs).mockResolvedValueOnce([]);
    await seedDraftEntries(mockGitHub, mockCache);
    expect(mockCache.upsert).not.toHaveBeenCalled();
  });

  it('handles listOpenPRs failure gracefully', async () => {
    const { mockGitHub, mockCache } = makeMocks();
    vi.mocked(mockGitHub.listOpenPRs).mockRejectedValueOnce(new Error('network'));
    await expect(seedDraftEntries(mockGitHub, mockCache)).resolves.toBeUndefined();
    expect(mockCache.upsert).not.toHaveBeenCalled();
  });
});
