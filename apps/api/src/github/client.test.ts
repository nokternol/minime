import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubClient } from './client.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

describe('GitHubClient', () => {
  let client: GitHubClient;

  beforeEach(() => {
    client = new GitHubClient('test-token', 'test-owner', 'test-repo');
    mockFetch.mockReset();
  });

  it('exposes owner and repo', () => {
    expect(client.owner).toBe('test-owner');
    expect(client.repo).toBe('test-repo');
  });

  it('getFile sends correct request', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ content: 'aGVsbG8=', sha: 'abc123', encoding: 'base64' })
    );
    const result = await client.getFile('ideas/test.md');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/test-owner/test-repo/contents/ideas/test.md?ref=main',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    );
    expect(result.sha).toBe('abc123');
  });

  it('upsertFile sends PUT with base64 content', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ content: { sha: 'new-sha' } }));
    await client.upsertFile('ideas/test.md', '# Hello', 'add: test', 'idea/branch');
    const call = mockFetch.mock.calls[0];
    const body = JSON.parse(call[1].body as string);
    expect(body.content).toBe(Buffer.from('# Hello').toString('base64'));
    expect(body.branch).toBe('idea/branch');
    expect(body.message).toBe('add: test');
  });

  it('createBranch fetches main SHA then creates ref', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ object: { sha: 'main-sha' } }))
      .mockResolvedValueOnce(mockResponse({ ref: 'refs/heads/new-branch' }));
    await client.createBranch('new-branch');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const secondCall = mockFetch.mock.calls[1];
    const body = JSON.parse(secondCall[1].body as string);
    expect(body.ref).toBe('refs/heads/new-branch');
    expect(body.sha).toBe('main-sha');
  });

  it('createPR sends correct payload', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ number: 42, html_url: 'https://github.com/...' })
    );
    const result = await client.createPR('My PR', 'feature-branch');
    expect(result.number).toBe(42);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.head).toBe('feature-branch');
    expect(body.base).toBe('main');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ message: 'Not Found' }, 404));
    await expect(client.getFile('missing.md')).rejects.toThrow('GitHub API error: 404');
  });
});
