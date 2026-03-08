import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, test, vi } from 'vitest';
import { server } from '../../../tests/server';
import Page from './+page.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

describe('/chat/new', () => {
  test('POSTs type:idea and has no type selector', async () => {
    let capturedBody: Record<string, unknown> = {};
    server.use(
      http.post('http://localhost:8744/api/capture', async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 'x', pr: 1, branch: 'b' });
      })
    );

    render(Page);

    expect(screen.queryByRole('combobox')).toBeNull();

    await userEvent.type(screen.getByPlaceholderText(/title/i), 'My first idea');
    await userEvent.click(screen.getByRole('button', { name: /capture/i }));

    await waitFor(() => expect(capturedBody.type).toBe('idea'));
  });

  test('shows error message when capture API returns 500', async () => {
    server.use(
      http.post('http://localhost:8744/api/capture', () =>
        HttpResponse.json({ error: 'server error' }, { status: 500 })
      )
    );

    render(Page);
    await userEvent.type(screen.getByPlaceholderText(/title/i), 'Bad idea');
    await userEvent.click(screen.getByRole('button', { name: /capture/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  test('captures successfully even when summarise returns 500', async () => {
    const { goto } = await import('$app/navigation');
    server.use(
      http.post('http://localhost:8744/api/chat/summarise', () =>
        HttpResponse.json({ error: 'llm error' }, { status: 500 })
      )
    );

    render(Page);
    await userEvent.type(screen.getByPlaceholderText(/title/i), 'Resilient idea');
    await userEvent.click(screen.getByRole('button', { name: /capture/i }));

    await waitFor(() => expect(goto).toHaveBeenCalledWith('/chat/new-id'));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
