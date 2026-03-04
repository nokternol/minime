import { Hono } from 'hono'
import { requireAuth } from './auth.js'
import type { LLMRouter } from '../llm/router.js'
import type { IndexCache } from '../store/index-cache.js'
import { assembleContext, formatContextBlock } from '../llm/context.js'

export function chatRoutes(llm: LLMRouter, cache: IndexCache) {
  const app = new Hono()

  app.post('/api/chat', requireAuth(), async (c) => {
    const { messages, query, relatedToId } = await c.req.json()
    const contextEntries = assembleContext(cache.all(), query, relatedToId)
    const contextBlock = formatContextBlock(contextEntries)
    const reply = await llm.chat(messages, contextBlock)
    return c.json({ reply, context: contextEntries.map(e => ({ id: e.id, title: e.title })) })
  })

  app.post('/api/chat/summarise', requireAuth(), async (c) => {
    const { conversation } = await c.req.json()
    const summary = await llm.summarise(conversation)
    return c.json({ summary })
  })

  app.post('/api/chat/frontmatter', requireAuth(), async (c) => {
    const { title, body, type } = await c.req.json()
    const result = await llm.generateFrontmatter(title, body, type)
    return c.json(result)
  })

  return app
}
