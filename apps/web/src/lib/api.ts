import { env } from '$env/dynamic/public';
const BASE = env.PUBLIC_API_URL;

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...options });
  if (res.status === 401) {
    if (typeof window !== 'undefined') window.location.href = `${BASE}/auth/login`;
    throw new Error('unauthorized');
  }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export type ContentType = 'idea' | 'plan' | 'discussion' | 'solution' | 'insight';
export type ContentStatus = 'draft' | 'active' | 'parked' | 'promoted' | 'done' | 'dismissed';

export interface IndexEntry {
  id: string;
  type: ContentType;
  title: string;
  status: ContentStatus;
  tags: string[];
  summary: string;
  created: string;
  updated: string;
  branch?: string;
  pr?: number;
  path: string;
  session_summary?: string;
}

export interface ContentDetail extends IndexEntry {
  body: string;
}
export interface InFlightItem {
  pr: number;
  branch: string;
  title: string;
  id?: string;
  type?: ContentType;
}

export const api = {
  me: () => req<{ email: string; name: string } | null>('/auth/me'),
  logout: () => req('/auth/logout', { method: 'POST' }),
  content: (params?: { type?: string; status?: string; q?: string }) => {
    const defined = Object.fromEntries(
      Object.entries(params ?? {}).filter(([, v]) => v !== undefined)
    );
    const qs = new URLSearchParams(defined as Record<string, string>).toString();
    return req<IndexEntry[]>(`/api/content${qs ? `?${qs}` : ''}`);
  },
  contentById: (id: string) => req<ContentDetail>(`/api/content/${id}`),
  inflight: () => req<InFlightItem[]>('/api/content/inflight'),
  capture: (input: unknown) =>
    req<{ id: string; pr: number; branch: string }>('/api/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  patch: (id: string, body: { session_summary: string }) =>
    req<{ ok: boolean }>(`/api/content/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  commit: (id: string) => req(`/api/content/${id}/commit`, { method: 'POST' }),
  park: (id: string) => req(`/api/content/${id}/park`, { method: 'POST' }),
  dismiss: (id: string) => req(`/api/content/${id}/dismiss`, { method: 'POST' }),
  discardPR: (pr: number) => req(`/api/inflight/${pr}/discard`, { method: 'POST' }),
  promote: (id: string, title: string, summary: string) =>
    req<{ id: string; pr: number; branch: string }>('/api/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'plan',
        title: `Plan: ${title}`,
        tags: [],
        summary,
        promoted_from: [id],
        body: `## Goal\n${summary || title}\n\n## Steps\n- (to be refined)\n\n## Success criteria\n- (to be refined)`,
      }),
    }),
  chat: (messages: unknown[], query?: string, relatedToId?: string) =>
    req<{ reply: string; context: Array<{ id: string; title: string }> }>('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, query, relatedToId }),
    }),
  summarise: (conversation: string) =>
    req<{ summary: string }>('/api/chat/summarise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation }),
    }),
};
