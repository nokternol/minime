import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubClient } from './client.js';

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
    mockFetch.mockResolvedValueOnce(mockResponse({ sha: 'new-sha' }));
    await client.upsertFile('ideas/test.md', '# Hello', 'add: test', 'idea/branch');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
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
    // First call: fetch the ref — must use plural /refs/
    expect(mockFetch.mock.calls[0][0]).toContain('/git/refs/heads/main');
    const secondBody = JSON.parse(mockFetch.mock.calls[1][1].body as string);
    expect(secondBody.ref).toBe('refs/heads/new-branch');
    expect(secondBody.sha).toBe('main-sha');
  });

  it('createPR sends correct payload', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ number: 42, html_url: 'https://github.com/pr/42' })
    );
    const result = await client.createPR('My PR', 'feature-branch');
    expect(result.number).toBe(42);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.head).toBe('feature-branch');
    expect(body.base).toBe('main');
  });

  it('mergePR sends squash PUT', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ sha: 'merge-sha', merged: true, message: 'ok' })
    );
    const result = await client.mergePR(42);
    expect(result.merged).toBe(true);
    expect(mockFetch.mock.calls[0][0]).toContain('/pulls/42/merge');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.merge_method).toBe('squash');
  });

  it('closePR sends PATCH state closed', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ number: 42, state: 'closed' }));
    await client.closePR(42);
    expect(mockFetch.mock.calls[0][0]).toContain('/pulls/42');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.state).toBe('closed');
  });

  it('deleteBranch sends DELETE to correct path', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: () => Promise.resolve(null),
      text: () => Promise.resolve(''),
    });
    await client.deleteBranch('idea/my-branch');
    expect(mockFetch.mock.calls[0][0]).toContain('/git/refs/heads/idea/my-branch');
    expect(mockFetch.mock.calls[0][1].method).toBe('DELETE');
  });

  it('listOpenPRs fetches open PRs', async () => {
    const prs = [{ number: 1, title: 'PR 1', head: { ref: 'branch-1' } }];
    mockFetch.mockResolvedValueOnce(mockResponse(prs));
    const result = await client.listOpenPRs();
    expect(result).toHaveLength(1);
    expect(mockFetch.mock.calls[0][0]).toContain('?state=open&per_page=100');
  });

  it('listFiles returns array of file entries', async () => {
    const files = [{ name: 'test.md', path: 'ideas/test.md', type: 'file' }];
    mockFetch.mockResolvedValueOnce(mockResponse(files));
    const result = await client.listFiles('ideas');
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('ideas/test.md');
  });

  it('throws on non-ok response including body', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ message: 'Not Found' }, 404));
    await expect(client.getFile('missing.md')).rejects.toThrow(
      'GitHub API error: 404 {"message":"Not Found"}'
    );
  });
});
