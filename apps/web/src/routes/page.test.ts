import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { server } from '../tests/server';
import Page from './+page.svelte';

const BASE = 'http://localhost:8744';

describe('/ browse', () => {
  test('renders type and status filter rows as radiogroups', async () => {
    render(Page);
    await waitFor(() => {
      expect(screen.getByRole('radiogroup', { name: /type/i })).toBeInTheDocument();
      expect(screen.getByRole('radiogroup', { name: /status/i })).toBeInTheDocument();
    });
    const typeGroup = screen.getByRole('radiogroup', { name: /type/i });
    const statusGroup = screen.getByRole('radiogroup', { name: /status/i });
    expect(within(typeGroup).getByRole('radio', { name: 'idea' })).toBeInTheDocument();
    expect(within(statusGroup).getByRole('radio', { name: 'parked' })).toBeInTheDocument();
    expect(within(statusGroup).getByRole('radio', { name: 'dismissed' })).toBeInTheDocument();
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
    const statusGroup = await screen.findByRole('radiogroup', { name: /status/i });
    await user.click(within(statusGroup).getByRole('radio', { name: 'parked' }));
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
    const statusGroup = await screen.findByRole('radiogroup', { name: /status/i });
    await user.click(within(statusGroup).getByRole('radio', { name: 'parked' }));
    await waitFor(() => expect(capturedUrl).toContain('status=parked'));
    await user.click(within(statusGroup).getByRole('radio', { name: 'all' }));
    await waitFor(() => expect(capturedUrl).not.toContain('status='));
  });
});
