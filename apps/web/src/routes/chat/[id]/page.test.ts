import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, test, vi } from 'vitest';
import { server } from '../../../tests/server';
import Page from './+page.svelte';

vi.mock('$app/stores', async () => {
  const { readable } = await import('svelte/store');
  return {
    page: readable({
      params: { id: 'test-id' },
      url: new URL('http://localhost/chat/test-id'),
      route: { id: '/chat/[id]' },
    }),
  };
});
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

describe('/chat/[id]', () => {
  test('shows Commit button when contentById returns a pr field', async () => {
    server.use(
      http.get('http://localhost:8744/api/content/test-id', () =>
        HttpResponse.json({
          id: 'test-id',
          type: 'idea',
          title: 'Test idea',
          status: 'draft',
          tags: [],
          summary: '',
          created: '2026-01-01',
          updated: '2026-01-01',
          path: 'wiki/test-id.md',
          body: '',
          pr: 42,
          branch: 'feat/test-id',
        })
      )
    );

    render(Page);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /commit/i })).toBeInTheDocument()
    );
  });

  test('finish() calls summarise → patch → commit in order', async () => {
    vi.stubGlobal('confirm', () => true);
    const calls: string[] = [];

    server.use(
      http.get('http://localhost:8744/api/content/test-id', () =>
        HttpResponse.json({
          id: 'test-id',
          type: 'idea',
          title: 'Test',
          status: 'draft',
          tags: [],
          summary: '',
          created: '2026-01-01',
          updated: '2026-01-01',
          path: 'wiki/test-id.md',
          body: '',
          pr: 42,
          branch: 'feat/test-id',
        })
      ),
      http.post('http://localhost:8744/api/chat/summarise', () => {
        calls.push('summarise');
        return HttpResponse.json({ summary: 'session text' });
      }),
      http.patch('http://localhost:8744/api/content/test-id', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.session_summary).toBe('session text');
        calls.push('patch');
        return HttpResponse.json({ ok: true });
      }),
      http.post('http://localhost:8744/api/content/test-id/commit', () => {
        calls.push('commit');
        return HttpResponse.json({ ok: true });
      })
    );

    render(Page);
    await waitFor(() => screen.getByRole('button', { name: /commit/i }));
    await userEvent.click(screen.getByRole('button', { name: /commit/i }));

    await waitFor(() => expect(calls).toEqual(['summarise', 'patch', 'commit']));
  });

  test('shows error message when chat send fails', async () => {
    server.use(
      http.post('http://localhost:8744/api/chat', () =>
        HttpResponse.json({ error: 'server error' }, { status: 500 })
      )
    );

    render(Page);
    await waitFor(() => screen.getByPlaceholderText(/message/i));
    await userEvent.type(screen.getByPlaceholderText(/message/i), 'hello');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
