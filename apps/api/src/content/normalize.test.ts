import { describe, expect, it } from 'vitest';
import { normalizeDocument } from './normalize.js';

const FULL_DOC = `---
id: "01JTEST"
type: idea
title: Test
status: draft
tags:
  - ts
summary: A test
created: "2026-01-01T00:00:00Z"
updated: "2026-01-01T00:00:00Z"
---
Body text here.
`;

describe('normalizeDocument', () => {
  it('is idempotent — calling twice returns the same string', () => {
    const once = normalizeDocument(FULL_DOC);
    const twice = normalizeDocument(once);
    expect(twice).toBe(once);
  });

  it('fills missing status with draft', () => {
    const raw = `---
id: "01J"
type: idea
title: T
tags: []
summary: s
created: "2026-01-01T00:00:00Z"
updated: "2026-01-01T00:00:00Z"
---
Body
`;
    const result = normalizeDocument(raw);
    expect(result).toContain('status: draft');
  });

  it('fills missing tags with empty array', () => {
    const raw = `---
id: "01J"
type: idea
title: T
status: draft
summary: s
created: "2026-01-01T00:00:00Z"
updated: "2026-01-01T00:00:00Z"
---
Body
`;
    const result = normalizeDocument(raw);
    expect(result).toContain('tags:');
  });

  it('does not overwrite existing status', () => {
    const raw = `---
id: "01J"
type: idea
title: T
status: parked
tags: []
summary: s
created: "2026-01-01T00:00:00Z"
updated: "2026-01-01T00:00:00Z"
---
`;
    const result = normalizeDocument(raw);
    expect(result).toContain('status: parked');
    expect(result).not.toContain('status: draft');
  });

  it('preserves body content', () => {
    const result = normalizeDocument(FULL_DOC);
    expect(result).toContain('Body text here.');
  });

  it('preserves existing tags', () => {
    const result = normalizeDocument(FULL_DOC);
    expect(result).toContain('ts');
  });
});
