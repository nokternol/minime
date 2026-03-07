import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitHubClient } from '../github/client.js';
import type { LLMRouter } from '../llm/router.js';
import type { IndexCache } from '../store/index-cache.js';
import { runParkedAnalysis } from './parked-analysis.js';

const makeParkedIdeas = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `id-${i}`,
    type: 'idea' as const,
    title: `Idea ${i}`,
    status: 'parked' as const,
    tags: [],
    summary: `summary ${i}`,
    created: '',
    updated: '',
    path: `ideas/idea-${i}.md`,
  }));

describe('runParkedAnalysis', () => {
  let mockLlm: LLMRouter;
  let mockCache: IndexCache;
  let mockGithub: GitHubClient;

  beforeEach(() => {
    mockLlm = {
      generate: vi.fn().mockResolvedValue(
        JSON.stringify({
          patterns: [
            {
              theme: 'Focus',
              ids: ['id-0', 'id-1', 'id-2'],
              insight: 'You keep returning to focus.',
            },
          ],
        })
      ),
    } as unknown as LLMRouter;

    mockCache = {
      byStatus: vi.fn().mockReturnValue(makeParkedIdeas(3)),
      upsert: vi.fn(),
    } as unknown as IndexCache;

    mockGithub = {
      createBranch: vi.fn().mockResolvedValue({}),
      upsertFile: vi.fn().mockResolvedValue({}),
      createPR: vi.fn().mockResolvedValue({ number: 42 }),
    } as unknown as GitHubClient;
  });

  it('skips when fewer than 3 parked ideas', async () => {
    vi.mocked(mockCache.byStatus).mockReturnValue(makeParkedIdeas(2));
    await runParkedAnalysis(mockLlm, mockCache, mockGithub);
    expect(mockGithub.upsertFile).not.toHaveBeenCalled();
  });

  it('passes doc.content (with frontmatter) to upsertFile, not raw body', async () => {
    await runParkedAnalysis(mockLlm, mockCache, mockGithub);
    expect(mockGithub.upsertFile).toHaveBeenCalledTimes(1);
    const [, fileContent] = vi.mocked(mockGithub.upsertFile).mock.calls[0];
    // doc.content must start with YAML frontmatter
    expect(fileContent).toMatch(/^---\n/);
  });

  it('writes insight type (not idea) into frontmatter', async () => {
    await runParkedAnalysis(mockLlm, mockCache, mockGithub);
    const [, fileContent] = vi.mocked(mockGithub.upsertFile).mock.calls[0];
    expect(fileContent).toContain('type: insight');
  });

  it('creates a PR per pattern with 3+ ids', async () => {
    await runParkedAnalysis(mockLlm, mockCache, mockGithub);
    expect(mockGithub.createPR).toHaveBeenCalledTimes(1);
    expect(mockGithub.createPR).toHaveBeenCalledWith(
      expect.stringContaining('[insight]'),
      expect.any(String)
    );
  });

  it('skips patterns with fewer than 3 ids', async () => {
    vi.mocked(mockLlm.generate).mockResolvedValue(
      JSON.stringify({
        patterns: [{ theme: 'Small', ids: ['id-0', 'id-1'], insight: 'Only two.' }],
      })
    );
    await runParkedAnalysis(mockLlm, mockCache, mockGithub);
    expect(mockGithub.upsertFile).not.toHaveBeenCalled();
  });
});
