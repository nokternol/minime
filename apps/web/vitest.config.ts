import { resolve } from 'node:path';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: {
      '$env/dynamic/public': resolve(import.meta.dirname, './src/tests/env.ts'),
    },
    conditions: ['browser'],
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'happy-dom',
    setupFiles: ['./src/tests/setup.ts'],
    globals: false,
    server: {
      deps: {
        conditions: ['browser'],
      },
    },
  },
});
