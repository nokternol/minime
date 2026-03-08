import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { server } from '../tests/server';
import Page from './+page.svelte';

const BASE = 'http://localhost:8744';

describe('/ browse', () => {
  test('renders status filter row with all statuses', async () => {
    render(Page);
    const statusFilter = await screen.findByRole('group', { name: /status filter/i }).catch(() =>
      // fallback: find the aria-label div
      screen.findByLabelText(/status filter/i)
    );
    expect(within(statusFilter).getByRole('button', { name: 'parked' })).toBeInTheDocument();
    expect(within(statusFilter).getByRole('button', { name: 'dismissed' })).toBeInTheDocument();
    expect(within(statusFilter).getByRole('button', { name: 'all' })).toBeInTheDocument();
  });

  test('selecting a status filter reloads content with that status', async () => {
    let capturedUrl = '';
    server.use(
      http.get(`${BASE}/api/content`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([]);
      })
    );
    const user = userEvent.setup();
    render(Page);
    const statusFilter = await screen.findByLabelText(/status filter/i);
    await user.click(within(statusFilter).getByRole('button', { name: 'parked' }));
    await waitFor(() => expect(capturedUrl).toContain('status=parked'));
  });

  test('all status filter does not send status param', async () => {
    let capturedUrl = '';
    server.use(
      http.get(`${BASE}/api/content`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([]);
      })
    );
    const user = userEvent.setup();
    render(Page);
    const statusFilter = await screen.findByLabelText(/status filter/i);
    await user.click(within(statusFilter).getByRole('button', { name: 'parked' }));
    await waitFor(() => expect(capturedUrl).toContain('status=parked'));
    await user.click(within(statusFilter).getByRole('button', { name: 'all' }));
    await waitFor(() => expect(capturedUrl).not.toContain('status='));
  });
});
