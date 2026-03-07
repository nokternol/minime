import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LLMRouter } from './router.js';

vi.mock('@anthropic-ai/sdk');
vi.mock('@google/generative-ai');

const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn().mockReturnValue({ generateContent: mockGenerateContent });

vi.mocked(GoogleGenerativeAI).mockImplementation(
  () => ({ getGenerativeModel: mockGetGenerativeModel }) as unknown as GoogleGenerativeAI
);

const mockCreate = vi.fn();
vi.mocked(Anthropic).mockImplementation(
  () => ({ messages: { create: mockCreate } }) as unknown as Anthropic
);

function makeRouter() {
  return new LLMRouter('test-anthropic-key', 'test-gemini-key');
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetGenerativeModel.mockReturnValue({ generateContent: mockGenerateContent });
});

describe('LLMRouter — chat', () => {
  it('calls claude with system prompt and messages', async () => {
    mockCreate.mockResolvedValue({ content: [{ text: 'hello back' }] });
    const router = makeRouter();
    const reply = await router.chat([{ role: 'user', content: 'hello' }], 'context block');
    expect(reply).toBe('hello back');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-4-6',
        messages: [{ role: 'user', content: 'hello' }],
        system: expect.stringContaining('context block'),
      })
    );
  });

  it('propagates LLM error', async () => {
    mockCreate.mockRejectedValue(new Error('rate limited'));
    const router = makeRouter();
    await expect(router.chat([{ role: 'user', content: 'hi' }], '')).rejects.toThrow('rate limited');
  });
});

describe('LLMRouter — summarise', () => {
  it('returns text from Gemini response', async () => {
    mockGenerateContent.mockResolvedValue({ response: { text: () => 'a summary' } });
    const router = makeRouter();
    const summary = await router.summarise('user: hi\nassistant: hello');
    expect(summary).toBe('a summary');
  });
});

describe('LLMRouter — generateFrontmatter', () => {
  it('parses valid JSON response', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => '{"summary":"short","tags":["a","b"]}' },
    });
    const router = makeRouter();
    const result = await router.generateFrontmatter('My Title', 'body', 'idea');
    expect(result).toEqual({ summary: 'short', tags: ['a', 'b'] });
  });

  it('strips markdown code fences before parsing', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => '```json\n{"summary":"fenced","tags":["x"]}\n```' },
    });
    const router = makeRouter();
    const result = await router.generateFrontmatter('Title', 'body', 'plan');
    expect(result).toEqual({ summary: 'fenced', tags: ['x'] });
  });

  it('falls back to title + empty tags when JSON is invalid', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => 'not json at all' },
    });
    const router = makeRouter();
    const result = await router.generateFrontmatter('My Title', 'body', 'idea');
    expect(result).toEqual({ summary: 'My Title', tags: [] });
  });
});

describe('LLMRouter — constructor', () => {
  it('calls getGenerativeModel once at construction, not per call', async () => {
    mockGenerateContent.mockResolvedValue({ response: { text: () => 'ok' } });
    const router = makeRouter();
    await router.summarise('a');
    await router.summarise('b');
    await router.generate('c');
    // Model wrapper created once in constructor
    expect(mockGetGenerativeModel).toHaveBeenCalledTimes(1);
  });
});
