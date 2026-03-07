<script module>
import { defineMeta } from '@storybook/addon-svelte-csf';
import { withAuth } from '../../../.storybook/decorators.js';
import EntryList from './EntryList.svelte';

const mockEntries = [
  {
    id: 'a1',
    type: 'idea',
    title: 'Build a habit tracker',
    status: 'active',
    tags: ['habits', 'productivity'],
    summary: 'Integrates with the daily note.',
    created: '2026-03-01',
    updated: '2026-03-06',
    path: 'wiki/a1.md',
  },
  {
    id: 'a2',
    type: 'plan',
    title: 'Refactor API client',
    status: 'draft',
    tags: [],
    summary: 'Split api.ts into domain-specific modules.',
    created: '2026-03-05',
    updated: '2026-03-07',
    path: 'wiki/a2.md',
  },
  {
    id: 'a3',
    type: 'insight',
    title: 'Async error handling pattern',
    status: 'done',
    tags: ['typescript', 'patterns'],
    summary: 'Use Result types over thrown exceptions.',
    created: '2026-02-20',
    updated: '2026-02-20',
    path: 'wiki/a3.md',
  },
];

const { Story } = defineMeta({
  title: 'Components/EntryList',
  component: EntryList,
  decorators: [withAuth],
  // onSelect is a callback prop — Storybook Actions auto-generates a spy for it.
  // Clicking a row calls onSelect(entry) internally and the spy logs it to the Actions panel.
});
</script>

<Story name="Multiple entries" args={{ entries: mockEntries }} />

<Story name="Empty state" args={{ entries: [] }} />

<Story name="Single entry" args={{ entries: [mockEntries[0]] }} />

<Story name="Many tags" args={{
  entries: [
    {
      id: 'tags',
      type: 'discussion',
      title: 'Tag overflow stress test',
      status: 'parked',
      tags: ['svelte', 'typescript', 'performance', 'ux', 'mobile', 'pwa', 'offline'],
      summary: 'Testing tag chip wrapping behaviour across breakpoints.',
      created: '2026-03-07',
      updated: '2026-03-07',
      path: 'wiki/tags.md',
    },
  ],
}} />
