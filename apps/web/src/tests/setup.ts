import { server } from './server';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/svelte';
import { afterAll, afterEach, beforeAll } from 'vitest';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
