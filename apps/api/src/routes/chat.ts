import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { assembleContext, formatContextBlock } from '../llm/context.js';
import type { LLMRouter } from '../llm/router.js';
import type { IndexCache } from '../store/index-cache.js';
import { requireAuth } from './auth.js';

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(50000),
});

const chatSchema = z.object({
  messages: z.array(messageSchema).min(1).max(100),
  query: z.string().max(500).optional(),
  relatedToId: z.string().optional(),
});

const summariseSchema = z.object({
  conversation: z.string().max(100000),
});

const frontmatterSchema = z.object({
  title: z.string().max(200),
  body: z.string().max(50000),
  type: z.string().max(50),
});

export function chatRoutes(llm: LLMRouter, cache: IndexCache) {
  const app = new Hono();

  app.post('/api/chat', requireAuth(), zValidator('json', chatSchema), async (c) => {
    const { messages, query, relatedToId } = c.req.valid('json');
    const contextEntries = assembleContext(cache.all(), query, relatedToId);
    const contextBlock = formatContextBlock(contextEntries);
    const { streamSSE } = await import('hono/streaming');
    return streamSSE(c, async (stream) => {
      // First event: context metadata
      await stream.writeSSE({
        event: 'context',
        data: JSON.stringify(contextEntries.map((e) => ({ id: e.id, title: e.title }))),
      });
      // Stream tokens
      for await (const chunk of llm.stream(messages, contextBlock)) {
        await stream.writeSSE({ data: chunk });
      }
      // Done sentinel
      await stream.writeSSE({ data: '[DONE]' });
    });
  });

  app.post('/api/chat/summarise', requireAuth(), zValidator('json', summariseSchema), async (c) => {
    const { conversation } = c.req.valid('json');
    try {
      const summary = await llm.summarise(conversation);
      return c.json({ summary });
    } catch (err) {
      const traceId = crypto.randomUUID().slice(0, 8);
      console.error(`[summarise] traceId=${traceId}`, err);
      return c.json({ error: 'Internal server error', traceId }, 500);
    }
  });

  app.post(
    '/api/chat/frontmatter',
    requireAuth(),
    zValidator('json', frontmatterSchema),
    async (c) => {
      const { title, body, type } = c.req.valid('json');
      const result = await llm.generateFrontmatter(title, body, type);
      return c.json(result);
    }
  );

  return app;
}
