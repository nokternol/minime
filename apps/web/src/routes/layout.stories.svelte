<script module>
import { defineMeta } from '@storybook/addon-svelte-csf';
import Layout from './+layout.svelte';

/**
 * VITELFINAL FORCING FUNCTION:
 * +layout.svelte → api.ts → $env/dynamic/public
 *
 * If this story fails to compile, the viteFinal alias for $env/dynamic/public
 * is misconfigured. Fix main.ts viteFinal before debugging any other story.
 *
 * Auth note: layout uses `$: user.set(data.user)` (Svelte 4 reactive).
 * Pass data as args — do NOT use withAuth decorator here.
 * The layout derives user state from the data prop, not the store directly.
 */
const { Story } = defineMeta({
  title: 'Routes/Layout',
  component: Layout,
});
</script>

<!-- Primary visual story: the sign-in screen that unauthenticated users see -->
<Story name="Logged out" args={{ data: { user: null } }} />

<!-- Verifies the authenticated branch renders without error.
     Canvas is intentionally empty — slot has no children in isolation.
     This is the correct and expected behaviour. -->
<Story name="Logged in (empty slot)" args={{ data: { user: { email: 'dev@example.com', name: 'Dev' } } }} />
