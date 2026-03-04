import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

const SHORT_RESPONSE_CONTRACT = `
You are Minime, a personal knowledge assistant.
Rules:
- Lead with the answer, not the reasoning
- Maximum 5 bullet points unless user asks to expand
- Use [expand] marker if more detail is available but not shown
- Never repeat context back to the user
- Code blocks only when code is the direct answer
- If the user says "deep dive" or "expand", you may respond fully
`.trim()

export class LLMRouter {
  private claude: Anthropic
  private gemini: GoogleGenerativeAI

  constructor(anthropicKey: string, geminiKey: string) {
    this.claude = new Anthropic({ apiKey: anthropicKey })
    this.gemini = new GoogleGenerativeAI(geminiKey)
  }

  async chat(messages: Array<{ role: 'user' | 'assistant'; content: string }>, contextBlock: string) {
    const system = `${SHORT_RESPONSE_CONTRACT}\n\n## Prior context\n\n${contextBlock}`
    const response = await this.claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system,
      messages,
    })
    return (response.content[0] as { text: string }).text
  }

  async summarise(content: string): Promise<string> {
    const model = this.gemini.getGenerativeModel({ model: 'gemini-flash-latest' })
    const result = await model.generateContent(
      `Write a 2-3 sentence session summary of this conversation. Be specific about decisions made and next steps.\n\n${content}`
    )
    return result.response.text()
  }

  async generateFrontmatter(title: string, body: string, type: string): Promise<{ tags: string[]; summary: string }> {
    const model = this.gemini.getGenerativeModel({ model: 'gemini-flash-latest' })
    const result = await model.generateContent(
      `Given this ${type} titled "${title}", generate:
1. A one-sentence summary (max 20 words)
2. 3-5 lowercase tags

Respond as JSON only: {"summary": "...", "tags": ["...", "..."]}

Content: ${body.slice(0, 500)}`
    )
    try {
      return JSON.parse(result.response.text().replace(/```json\n?|\n?```/g, ''))
    } catch {
      return { summary: title, tags: [] }
    }
  }
}
