import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from './build.js';

const SAMPLE_MD = `---
id: 01JNXK2MTEST
type: idea
title: Test Idea
status: draft
tags: [typescript, test]
summary: A test idea summary
created: 2026-03-03T00:00:00Z
updated: 2026-03-03T00:00:00Z
---
# Body content here
More content`;

describe('parseFrontmatter', () => {
  it('extracts id, type, title, status', () => {
    const result = parseFrontmatter(SAMPLE_MD, 'ideas/test.md');
    expect(result.id).toBe('01JNXK2MTEST');
    expect(result.type).toBe('idea');
    expect(result.title).toBe('Test Idea');
    expect(result.status).toBe('draft');
  });

  it('extracts tags as array', () => {
    const result = parseFrontmatter(SAMPLE_MD, 'ideas/test.md');
    expect(result.tags).toEqual(['typescript', 'test']);
  });

  it('extracts summary', () => {
    const result = parseFrontmatter(SAMPLE_MD, 'ideas/test.md');
    expect(result.summary).toBe('A test idea summary');
  });

  it('sets path from argument', () => {
    const result = parseFrontmatter(SAMPLE_MD, 'ideas/test.md');
    expect(result.path).toBe('ideas/test.md');
  });

  it('does not include body content in result', () => {
    const result = parseFrontmatter(SAMPLE_MD, 'ideas/test.md');
    expect((result as unknown as Record<string, unknown>).body).toBeUndefined();
    expect((result as unknown as Record<string, unknown>).content).toBeUndefined();
  });

  it('handles optional idea-specific fields', () => {
    const md = `---
id: 01JNXK2M
type: idea
title: Promoted Idea
status: promoted
tags: []
summary: Was promoted
created: 2026-01-01T00:00:00Z
updated: 2026-01-01T00:00:00Z
promoted_to: 01JNXK2MPLAN
---`;
    const result = parseFrontmatter(md, 'ideas/promoted.md');
    expect(result.promoted_to).toBe('01JNXK2MPLAN');
  });

  it('handles plan-specific fields', () => {
    const md = `---
id: 01JNXK2MPLAN
type: plan
title: My Plan
status: active
tags: [typescript]
summary: A plan
created: 2026-01-01T00:00:00Z
updated: 2026-01-01T00:00:00Z
priority: high
promoted_from: [01JNXK2MIDEA1, 01JNXK2MIDEA2]
---`;
    const result = parseFrontmatter(md, 'plans/my-plan.md');
    expect(result.priority).toBe('high');
    expect(result.promoted_from).toEqual(['01JNXK2MIDEA1', '01JNXK2MIDEA2']);
  });

  it('returns entry with undefined required fields when frontmatter is absent', () => {
    const md = '# Just a heading\n\nNo frontmatter here.';
    const result = parseFrontmatter(md, 'ideas/no-fm.md');
    expect(result.id).toBeUndefined();
    expect(result.type).toBeUndefined();
    expect(result.path).toBe('ideas/no-fm.md');
  });

  it('path argument overrides any path field in frontmatter', () => {
    const md = `---
id: 01JTEST
type: idea
title: Override Test
status: draft
tags: []
summary: test
created: 2026-01-01T00:00:00Z
updated: 2026-01-01T00:00:00Z
path: wrong/path.md
---`;
    const result = parseFrontmatter(md, 'ideas/correct-path.md');
    expect(result.path).toBe('ideas/correct-path.md');
  });

  it('handles insight-specific fields', () => {
    const md = `---
id: 01JINSIGHT
type: insight
title: Pattern Detected
status: active
tags: [pattern]
summary: You keep coming back to this
created: 2026-01-01T00:00:00Z
updated: 2026-01-01T00:00:00Z
subtype: pattern
generated_by: gemini-flash
references: [01JIDEA1, 01JIDEA2, 01JIDEA3]
---`;
    const result = parseFrontmatter(md, 'ideas/insight.md');
    expect(result.subtype).toBe('pattern');
    expect(result.generated_by).toBe('gemini-flash');
    expect(result.references).toEqual(['01JIDEA1', '01JIDEA2', '01JIDEA3']);
  });
});

import { vi } from 'vitest'
import { buildIndex } from './build.js'
import type { GitHubClient } from '../github/client.js'

function makeGithub(overrides: Partial<typeof GitHubClient.prototype> = {}): GitHubClient {
  return {
    listFiles: vi.fn(),
    getFile: vi.fn(),
    ...overrides,
  } as unknown as GitHubClient
}

const VALID_MD = Buffer.from(`---
id: 01JTEST
type: idea
title: My Idea
status: active
tags: [typescript]
summary: A summary
created: 2026-03-01T00:00:00Z
updated: 2026-03-02T00:00:00Z
---
Body`).toString('base64')

describe('buildIndex', () => {
  it('returns empty array when all dirs throw (repo empty)', async () => {
    const github = makeGithub({ listFiles: vi.fn().mockRejectedValue(new Error('404')) })
    expect(await buildIndex(github)).toEqual([])
  })

  it('skips non-.md files', async () => {
    const github = makeGithub({
      listFiles: vi.fn().mockResolvedValue([{ path: 'ideas/image.png', type: 'file' }]),
    })
    expect(await buildIndex(github)).toEqual([])
  })

  it('skips files where getFile throws', async () => {
    const github = makeGithub({
      listFiles: vi.fn().mockResolvedValue([{ path: 'ideas/broken.md', type: 'file' }]),
      getFile: vi.fn().mockRejectedValue(new Error('500')),
    })
    expect(await buildIndex(github)).toEqual([])
  })

  it('skips files with missing required frontmatter fields', async () => {
    const noId = Buffer.from('---\ntype: idea\ntitle: T\n---').toString('base64')
    const github = makeGithub({
      listFiles: vi.fn().mockResolvedValue([{ path: 'ideas/noid.md', type: 'file' }]),
      getFile: vi.fn().mockResolvedValue({ content: noId, encoding: 'base64' }),
    })
    expect(await buildIndex(github)).toEqual([])
  })

  it('includes valid files and sets path', async () => {
    const github = makeGithub({
      listFiles: vi.fn().mockImplementation((dir: string) =>
        dir === 'ideas' ? [{ path: 'ideas/valid.md', type: 'file' }] : []
      ),
      getFile: vi.fn().mockResolvedValue({ content: VALID_MD, encoding: 'base64' }),
    })
    const result = await buildIndex(github)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('01JTEST')
    expect(result[0].path).toBe('ideas/valid.md')
  })

  it('sorts results by updated descending', async () => {
    const older = Buffer.from(`---\nid: OLD\ntype: idea\ntitle: Old\nstatus: draft\ntags: []\nsummary: s\ncreated: "2026-01-01T00:00:00Z"\nupdated: "2026-01-01T00:00:00Z"\n---`).toString('base64')
    const newer = Buffer.from(`---\nid: NEW\ntype: idea\ntitle: New\nstatus: draft\ntags: []\nsummary: s\ncreated: "2026-03-01T00:00:00Z"\nupdated: "2026-03-01T00:00:00Z"\n---`).toString('base64')
    const files = { 'ideas/older.md': older, 'ideas/newer.md': newer }
    const github = makeGithub({
      listFiles: vi.fn().mockImplementation((dir: string) =>
        dir === 'ideas' ? [{ path: 'ideas/older.md', type: 'file' }, { path: 'ideas/newer.md', type: 'file' }] : []
      ),
      getFile: vi.fn().mockImplementation((path: string) =>
        Promise.resolve({ content: files[path as keyof typeof files], encoding: 'base64' })
      ),
    })
    const result = await buildIndex(github)
    expect(result[0].id).toBe('NEW')
    expect(result[1].id).toBe('OLD')
  })
})
