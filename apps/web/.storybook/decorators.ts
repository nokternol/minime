import { user } from '../src/lib/stores/auth.js';
import type { Decorator } from '@storybook/sveltekit';

/**
 * Apply per-story via `decorators: [withAuth]` in defineMeta.
 * Sets the user store to a fixture value before the story renders.
 * Do NOT apply globally — stories testing the unauthenticated state must NOT use this.
 */
export const withAuth: Decorator = (Story, context) => {
  user.set({ email: 'dev@example.com', name: 'Dev User' });
  return Story(context);
};

/**
 * Applied globally in preview.ts.
 * Sets document.body background/color to match the app's dark theme.
 * EntryList buttons use `color: inherit` — without this they are white-on-white.
 *
 * Cleanup (resetting body styles) is done via `beforeEach` in preview.ts, not here.
 * `onDestroy` from 'svelte' does NOT work in decorator functions — Storybook invokes
 * decorators as plain JS functions, not as Svelte component lifecycle contexts.
 */
export const withDarkTheme: Decorator = (Story, context) => {
  if (typeof document !== 'undefined') {
    document.body.style.background = '#0f0f0f';
    document.body.style.color = '#fff';
  }
  return Story(context);
};
