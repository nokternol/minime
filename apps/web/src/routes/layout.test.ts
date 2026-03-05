import { render, waitFor } from '@testing-library/svelte';
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { server } from '../tests/server';
import Layout from './+layout.svelte';

describe('+layout.svelte', () => {
  test('calls GET /auth/me on mount', async () => {
    let requested = false;
    server.use(
      http.get('http://localhost:8744/auth/me', () => {
        requested = true;
        return HttpResponse.json({ email: 'u@test.com', name: 'User' });
      })
    );

    render(Layout);

    await waitFor(() => expect(requested).toBe(true));
  });
});
