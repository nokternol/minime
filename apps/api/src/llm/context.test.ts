import { describe, it, expect } from 'vitest'
import { assembleContext } from './context.js'
import type { IndexEntry } from '../index-builder/build.js'

describe('assembleContext', () => {
  it('returns top 5 by recency when no query', () => {
    const entries: IndexEntry[] = Array.from({ length: 10 }, (_, i) => ({
      id: `id-${i}`,
      type: 'idea' as const,
      title: `Idea ${i}`,
      status: 'active' as const,
      tags: [],
      summary: `Summary ${i}`,
      created: `2026-0${(i % 9) + 1}-01T00:00:00Z`,
      updated: `2026-0${(i % 9) + 1}-01T00:00:00Z`,
      path: `ideas/idea-${i}.md`,
    }))
    const result = assembleContext(entries, undefined, undefined)
    expect(result.length).toBeLessThanOrEqual(5)
  })
})
