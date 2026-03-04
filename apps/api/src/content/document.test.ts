import { describe, it, expect } from 'vitest'
import { buildDocument } from './document.js'

describe('buildDocument', () => {
  it('generates a valid id, path, and branchName', () => {
    const result = buildDocument({ type: 'idea', title: 'My Test Idea', tags: ['ts'], summary: 's', body: 'body' })
    expect(result.id).toBeTruthy()
    expect(result.path).toMatch(/^ideas\/\d{4}-\d{2}-\d{2}-my-test-idea\.md$/)
    expect(result.branchName).toMatch(/^idea\/[a-z0-9]+-my-test-idea$/)
  })

  it('content contains frontmatter block and body', () => {
    const result = buildDocument({ type: 'plan', title: 'A Plan', tags: [], summary: 'sum', body: 'the body' })
    expect(result.content).toMatch(/^---\n/)
    expect(result.content).toContain('---\n\nthe body')
    expect(result.content).toContain('status: "draft"')
    expect(result.content).toContain('type: "plan"')
  })

  it('serialises tags as YAML array', () => {
    const result = buildDocument({ type: 'idea', title: 'T', tags: ['a', 'b', 'c'], summary: 's', body: '' })
    expect(result.content).toContain('tags: [a, b, c]')
  })

  it('includes optional fields only when provided', () => {
    const withOpts = buildDocument({
      type: 'solution', title: 'Fix', tags: [], summary: 's', body: '',
      language: 'typescript', problem: 'crashes', related_to: 'ID1', promoted_from: ['X', 'Y'],
    })
    expect(withOpts.content).toContain('language: "typescript"')
    expect(withOpts.content).toContain('problem: "crashes"')
    expect(withOpts.content).toContain('related_to: "ID1"')
    expect(withOpts.content).toContain('promoted_from: [X, Y]')

    const withoutOpts = buildDocument({ type: 'idea', title: 'T', tags: [], summary: 's', body: '' })
    expect(withoutOpts.content).not.toContain('language')
    expect(withoutOpts.content).not.toContain('related_to')
  })

  it('slugifies title: lowercases and replaces non-alphanumeric with hyphens', () => {
    const result = buildDocument({ type: 'discussion', title: 'Hello World! & Things', tags: [], summary: 's', body: '' })
    expect(result.path).toContain('hello-world-things')
    expect(result.branchName).toContain('hello-world-things')
  })

  it('path uses correct plural directory for each type', () => {
    for (const type of ['idea', 'plan', 'discussion', 'solution'] as const) {
      const result = buildDocument({ type, title: 'T', tags: [], summary: 's', body: '' })
      expect(result.path).toMatch(new RegExp(`^${type}s/`))
    }
  })

  it('unique ids across calls', () => {
    const a = buildDocument({ type: 'idea', title: 'A', tags: [], summary: 's', body: '' })
    const b = buildDocument({ type: 'idea', title: 'B', tags: [], summary: 's', body: '' })
    expect(a.id).not.toBe(b.id)
  })
})
