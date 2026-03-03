import { describe, expect, it, vi } from 'vitest';
import type { GitHubClient } from '../github/client.js';
import type { IndexEntry } from '../index-builder/build.js';
import { IndexCache } from './index-cache.js';

function makeEntry(overrides: Partial<IndexEntry> = {}): IndexEntry {
  return {
    id: '01JTEST',
    type: 'idea',
    title: 'Test',
    status: 'active',
    tags: ['test'],
    summary: 'A test entry',
    created: '2026-01-01T00:00:00Z',
    updated: '2026-01-01T00:00:00Z',
    path: 'ideas/test.md',
    ...overrides,
  };
}

const mockGitHub = {
  listFiles: vi.fn(),
  getFile: vi.fn(),
} as unknown as GitHubClient;

describe('IndexCache', () => {
  it('starts empty before load', () => {
    const cache = new IndexCache(mockGitHub);
    expect(cache.all()).toHaveLength(0);
    expect(cache.getLastBuilt()).toBeNull();
  });

  it('loads entries via buildIndex', async () => {
    mockGitHub.listFiles = vi
      .fn()
      .mockResolvedValueOnce([{ name: 'test.md', path: 'ideas/test.md', type: 'file' }]);
    mockGitHub.getFile = vi.fn().mockResolvedValueOnce({
      content: Buffer.from(`---
id: 01JTEST
type: idea
title: Test Idea
status: active
tags: [test]
summary: A test idea
created: 2026-01-01T00:00:00Z
updated: 2026-01-01T00:00:00Z
---`).toString('base64'),
      sha: 'abc',
      encoding: 'base64',
    });
    // Remaining dirs return empty
    mockGitHub.listFiles = vi
      .fn()
      .mockResolvedValueOnce([{ name: 'test.md', path: 'ideas/test.md', type: 'file' }])
      .mockRejectedValue(new Error('not found'));

    const cache = new IndexCache(mockGitHub);
    await cache.load();
    expect(cache.all()).toHaveLength(1);
    expect(cache.getLastBuilt()).toBeInstanceOf(Date);
  });

  it('byType filters correctly', () => {
    const cache = new IndexCache(mockGitHub);
    // @ts-expect-error accessing private for test setup
    cache.entries = [
      makeEntry({ type: 'idea' }),
      makeEntry({ id: '01JPLAN', type: 'plan', path: 'plans/p.md' }),
    ];
    expect(cache.byType('idea')).toHaveLength(1);
    expect(cache.byType('plan')).toHaveLength(1);
    expect(cache.byType('solution')).toHaveLength(0);
  });

  it('byStatus filters correctly', () => {
    const cache = new IndexCache(mockGitHub);
    // @ts-expect-error accessing private for test setup
    cache.entries = [
      makeEntry({ status: 'active' }),
      makeEntry({ id: '01JPARK', status: 'parked', path: 'ideas/p.md' }),
    ];
    expect(cache.byStatus('active')).toHaveLength(1);
    expect(cache.byStatus('parked')).toHaveLength(1);
  });

  it('search matches title, summary and tags', () => {
    const cache = new IndexCache(mockGitHub);
    // @ts-expect-error accessing private for test setup
    cache.entries = [
      makeEntry({ title: 'Authentication Design', summary: 'OAuth flow', tags: ['auth'] }),
      makeEntry({
        id: '01JOTHER',
        title: 'Unrelated',
        summary: 'Nothing here',
        tags: ['misc'],
        path: 'ideas/other.md',
      }),
    ];
    expect(cache.search('auth')).toHaveLength(1);
    expect(cache.search('oauth')).toHaveLength(1);
    expect(cache.search('unrelated')).toHaveLength(1);
    expect(cache.search('xyz')).toHaveLength(0);
  });

  it('findById returns correct entry', () => {
    const cache = new IndexCache(mockGitHub);
    const entry = makeEntry({ id: 'FIND-ME' });
    // @ts-expect-error accessing private for test setup
    cache.entries = [entry, makeEntry({ id: 'OTHER', path: 'ideas/other.md' })];
    expect(cache.findById('FIND-ME')).toBe(entry);
    expect(cache.findById('NOPE')).toBeUndefined();
  });
});
