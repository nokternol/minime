import { ulid } from 'ulid'
import type { LLMRouter } from '../llm/router.js'
import type { IndexCache } from '../store/index-cache.js'
import type { GitHubClient } from '../github/client.js'
import { buildDocument } from '../content/document.js'

export async function runParkedAnalysis(llm: LLMRouter, cache: IndexCache, github: GitHubClient) {
  const parked = cache.byStatus('parked').filter(e => e.type === 'idea')
  if (parked.length < 3) {
    console.log('Parked analysis: fewer than 3 parked ideas, skipping')
    return
  }

  const summariesText = parked.map(e => `- [${e.id}] ${e.title}: ${e.summary}`).join('\n')
  const gemini = (llm as any).gemini
  const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const result = await model.generateContent(
    `Analyse these parked ideas for recurring themes. If 3+ ideas share a theme, identify the pattern.
Respond as JSON: { "patterns": [{ "theme": "...", "ids": ["...", "..."], "insight": "One sentence about what this pattern means" }] }
If no patterns found, respond: { "patterns": [] }

Ideas:
${summariesText}`
  )

  let patterns: Array<{ theme: string; ids: string[]; insight: string }> = []
  try {
    const parsed = JSON.parse(result.response.text().replace(/```json\n?|\n?```/g, ''))
    patterns = parsed.patterns ?? []
  } catch {
    return
  }

  for (const pattern of patterns) {
    if (pattern.ids.length < 3) continue
    const id = ulid()
    const title = `Pattern: ${pattern.theme}`
    const body = `## Recurring Theme Detected\n\n${pattern.insight}\n\n## Related Ideas\n\n${pattern.ids.map(i => `- ${i}`).join('\n')}`
    const doc = buildDocument({
      type: 'idea',
      title,
      tags: ['insight', 'pattern', 'adhd'],
      summary: pattern.insight,
      body,
    })
    const branchName = `insight/${id.toLowerCase()}-pattern`
    await github.createBranch(branchName)
    await github.upsertFile(doc.path, body, `insight: ${title}`, branchName)
    await github.createPR(`[insight] ${title}`, branchName)
    console.log(`Parked analysis: created insight PR for theme "${pattern.theme}"`)
  }
}
