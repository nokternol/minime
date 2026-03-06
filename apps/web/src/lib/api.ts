import { PUBLIC_API_URL } from '$env/static/public';
const BASE = PUBLIC_API_URL;

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...options });
  if (res.status === 401) {
    window.location.href = `${BASE}/auth/login`;
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
}

export const api = {
  me: () => req<{ email: string; name: string } | null>('/auth/me'),
  logout: () => req('/auth/logout', { method: 'POST' }),
  content: (params?: { type?: string; status?: string; q?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
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
  dismiss: (id: string) => req(`/api/content/${id}/dismiss`, { method: 'POST' }),
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
