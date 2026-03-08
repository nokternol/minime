import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, test, vi } from 'vitest';
import { server } from '../../tests/server';
import Page from './+page.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

const BASE = 'http://localhost:8744';

const ideaItem = { pr: 7, branch: 'idea/abc', title: 'My idea', id: 'idea-xyz', type: 'idea' };
const planItem = { pr: 8, branch: 'plan/def', title: 'My plan', id: 'plan-xyz', type: 'plan' };
const noIdItem = { pr: 9, branch: 'idea/unmatched', title: 'Unmatched draft' };

describe('/review', () => {
  test('shows empty state when no in-flight items', async () => {
    render(Page);
    await waitFor(() => expect(screen.getByText(/no in-flight items/i)).toBeInTheDocument());
  });

  test('shows PR info for each in-flight item', async () => {
    server.use(http.get(`${BASE}/api/content/inflight`, () => HttpResponse.json([ideaItem])));
    render(Page);
    await waitFor(() => expect(screen.getByText('My idea')).toBeInTheDocument());
    expect(screen.getByText(/PR #7/)).toBeInTheDocument();
  });

  test('shows Open link and Commit/Park/Discard for item with id', async () => {
    server.use(http.get(`${BASE}/api/content/inflight`, () => HttpResponse.json([ideaItem])));
    render(Page);
    await waitFor(() => expect(screen.getByRole('link', { name: /open/i })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /commit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /park/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument();
  });

  test('shows Promote button for ideas but not plans', async () => {
    server.use(
      http.get(`${BASE}/api/content/inflight`, () => HttpResponse.json([ideaItem, planItem]))
    );
    render(Page);
    await waitFor(() => expect(screen.getAllByRole('button', { name: /commit/i })).toHaveLength(2));
    const promoteButtons = screen.getAllByRole('button', { name: /promote/i });
    expect(promoteButtons).toHaveLength(1);
  });

  test('shows only Discard for item without id', async () => {
    server.use(http.get(`${BASE}/api/content/inflight`, () => HttpResponse.json([noIdItem])));
    render(Page);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument()
    );
    expect(screen.queryByRole('link', { name: /open/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /commit/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /park/i })).toBeNull();
  });

  test('Park button calls park endpoint and removes item', async () => {
    server.use(http.get(`${BASE}/api/content/inflight`, () => HttpResponse.json([ideaItem])));
    const user = userEvent.setup();
    render(Page);
    await waitFor(() => expect(screen.getByRole('button', { name: /park/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /park/i }));
    await waitFor(() => expect(screen.queryByText('My idea')).toBeNull());
  });

  test('Commit button confirms then calls commit endpoint and removes item', async () => {
    server.use(http.get(`${BASE}/api/content/inflight`, () => HttpResponse.json([ideaItem])));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(Page);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /commit/i })).toBeInTheDocument()
    );
    await user.click(screen.getByRole('button', { name: /commit/i }));
    await waitFor(() => expect(screen.queryByText('My idea')).toBeNull());
  });

  test('Discard button confirms then calls dismiss and removes item', async () => {
    server.use(http.get(`${BASE}/api/content/inflight`, () => HttpResponse.json([ideaItem])));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(Page);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument()
    );
    await user.click(screen.getByRole('button', { name: /discard/i }));
    await waitFor(() => expect(screen.queryByText('My idea')).toBeNull());
  });

  test('Promote calls contentById then capture and navigates to new plan', async () => {
    const { goto: mockGoto } = await import('$app/navigation');
    const captureCalled = vi.fn();
    server.use(
      http.get(`${BASE}/api/content/inflight`, () => HttpResponse.json([ideaItem])),
      http.get(`${BASE}/api/content/idea-xyz`, () =>
        HttpResponse.json({
          id: 'idea-xyz',
          type: 'idea',
          title: 'My idea',
          status: 'draft',
          tags: [],
          summary: 'A great idea',
          created: '',
          updated: '',
          path: 'ideas/my-idea.md',
          body: '',
        })
      ),
      http.post(`${BASE}/api/capture`, () => {
        captureCalled();
        return HttpResponse.json({ id: 'new-plan-id', pr: 10, branch: 'plan/new-plan-id' });
      })
    );
    const user = userEvent.setup();
    render(Page);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /promote/i })).toBeInTheDocument()
    );
    await user.click(screen.getByRole('button', { name: /promote/i }));
    await waitFor(() => expect(captureCalled).toHaveBeenCalled());
    expect(mockGoto).toHaveBeenCalledWith('/chat/new-plan-id');
  });
});
