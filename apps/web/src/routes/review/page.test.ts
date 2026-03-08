import { render, screen, waitFor } from '@testing-library/svelte';
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { server } from '../../tests/server';
import Page from './+page.svelte';

describe('/review', () => {
  test('shows empty state when no in-flight items', async () => {
    render(Page);
    await waitFor(() => expect(screen.getByText(/no in-flight items/i)).toBeInTheDocument());
  });

  test('shows PR info for each in-flight item', async () => {
    server.use(
      http.get('http://localhost:8744/api/content/inflight', () =>
        HttpResponse.json([{ pr: 7, branch: 'idea/abc', title: 'My draft idea' }])
      )
    );

    render(Page);

    await waitFor(() => expect(screen.getByText('My draft idea')).toBeInTheDocument());
    expect(screen.getByText(/PR #7/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /open chat/i })).toBeNull();
  });

  test('shows Open chat link when item has an id', async () => {
    server.use(
      http.get('http://localhost:8744/api/content/inflight', () =>
        HttpResponse.json([{ pr: 7, branch: 'idea/abc', title: 'Linked idea', id: 'idea-xyz' }])
      )
    );

    render(Page);

    await waitFor(() =>
      expect(screen.getByRole('link', { name: /open chat/i })).toHaveAttribute(
        'href',
        '/chat/idea-xyz'
      )
    );
  });
});
