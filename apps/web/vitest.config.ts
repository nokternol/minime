import { defineConfig } from 'vitest/config'
import { sveltekit } from '@sveltejs/kit/vite'

export default defineConfig({
  plugins: [sveltekit()],
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
  resolve: {
    conditions: ['browser'],
  },
})
