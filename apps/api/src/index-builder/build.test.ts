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
