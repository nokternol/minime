import type { StorybookConfig } from '@storybook/sveltekit';
import { mergeConfig } from 'vite';
import { resolve } from 'path';

// .storybook/package.json has "type":"commonjs", so __dirname is available natively.
// This avoids import.meta.url (ESM-only) which breaks Storybook's esbuild-register loader.

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.svelte', '../src/**/*.stories.ts'],
  staticDirs: ['../static'], // serves static/mockServiceWorker.js — required for MSW
  addons: [
    '@storybook/addon-svelte-csf',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
    'msw-storybook-addon',
  ],
  framework: {
    name: '@storybook/sveltekit',
    options: {},
  },
  viteFinal(config) {
    // mergeConfig with array-of-objects alias form.
    // Vite 6 AliasOptions is Alias[], not Record<string,string>.
    // Using a Record cast corrupts the aliases already injected by @sveltejs/kit/vite.
    return mergeConfig(config, {
      resolve: {
        alias: [
          {
            find: '$env/dynamic/public',
            // Same stub used by vitest.config.ts — single source of truth.
            replacement: resolve(__dirname, '../src/tests/env.ts'),
          },
          {
            find: '$lib',
            // EntryList imports '$lib/api.js' for types; without this alias story build fails.
            replacement: resolve(__dirname, '../src/lib'),
          },
        ],
      },
    });
  },
};

export default config;
