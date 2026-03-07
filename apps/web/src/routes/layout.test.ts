import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { server } from '../tests/server';
import { load } from './+layout.js';

describe('+layout load', () => {
  test('calls GET /auth/me and returns user', async () => {
    let requested = false;
    server.use(
      http.get('http://localhost:8744/auth/me', () => {
        requested = true;
        return HttpResponse.json({ email: 'u@test.com', name: 'User' });
      })
    );

    const result = await load();

    expect(requested).toBe(true);
    expect(result.user).toEqual({ email: 'u@test.com', name: 'User' });
  });
});
