import { initialize, mswLoader } from 'msw-storybook-addon';
import { defaultHandlers } from '../src/tests/handlers.js';
import { withDarkTheme } from './decorators.js';
import type { Preview } from '@storybook/sveltekit';

// Boot the MSW browser service worker.
// 'bypass' (not 'error'): Storybook makes its own internal Vite/HMR requests
// that must not be intercepted. Use 'error' in Vitest but 'bypass' here.
initialize({ onUnhandledRequest: 'bypass' });

const preview: Preview = {
  // mswLoader (NOT mswDecorator — mswDecorator was removed in msw-storybook-addon v2)
  loaders: [mswLoader],
  // withDarkTheme is global — applies to every story automatically
  decorators: [withDarkTheme],
  parameters: {
    msw: { handlers: defaultHandlers },
    backgrounds: {
      default: 'app-dark',
      values: [{ name: 'app-dark', value: '#0f0f0f' }],
    },
    a11y: {
      // Run checks automatically on each story render — results appear in the
      // Accessibility panel. Manual = false means no user click required.
      manual: false,
    },
  },
  // beforeEach returns a teardown function called after each story unmounts.
  // This is the correct place to clean up decorator side effects.
  // onDestroy from 'svelte' does NOT work in plain decorator function contexts.
  beforeEach: () => {
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.background = '';
        document.body.style.color = '';
      }
    };
  },
};

export default preview;
