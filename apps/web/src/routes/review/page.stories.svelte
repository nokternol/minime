<script module>
import { defineMeta } from '@storybook/addon-svelte-csf';
import { http, HttpResponse } from 'msw';
import Page from './+page.svelte';

const { Story } = defineMeta({
  title: 'Routes/Review',
  component: Page,
});
</script>

<!-- Default handler returns [] so no overrides needed -->
<Story name="Empty" />

<Story
  name="Idea — full triage"
  parameters={{
    msw: {
      handlers: [
        http.get('http://localhost:8744/api/content/inflight', () =>
          HttpResponse.json([
            {
              pr: 12,
              branch: 'idea/focus-system',
              title: '[idea] Build a focus system',
              id: '01JR4KFOCUS',
              type: 'idea',
            },
          ])
        ),
      ],
    },
  }}
/>

<Story
  name="Plan — no promote"
  parameters={{
    msw: {
      handlers: [
        http.get('http://localhost:8744/api/content/inflight', () =>
          HttpResponse.json([
            {
              pr: 9,
              branch: 'plan/api-refactor',
              title: '[plan] Refactor API client',
              id: '01JR4KPLAN',
              type: 'plan',
            },
          ])
        ),
      ],
    },
  }}
/>

<Story
  name="No id — discard only"
  parameters={{
    msw: {
      handlers: [
        http.get('http://localhost:8744/api/content/inflight', () =>
          HttpResponse.json([
            { pr: 15, branch: 'idea/unmatched', title: '[idea] Unmatched draft' },
          ])
        ),
      ],
    },
  }}
/>

<Story
  name="Mixed queue"
  parameters={{
    msw: {
      handlers: [
        http.get('http://localhost:8744/api/content/inflight', () =>
          HttpResponse.json([
            {
              pr: 12,
              branch: 'idea/focus-system',
              title: '[idea] Build a focus system',
              id: '01JR4KFOCUS',
              type: 'idea',
            },
            {
              pr: 9,
              branch: 'plan/api-refactor',
              title: '[plan] Refactor API client',
              id: '01JR4KPLAN',
              type: 'plan',
            },
            { pr: 15, branch: 'idea/unmatched', title: '[idea] Unmatched draft' },
          ])
        ),
      ],
    },
  }}
/>
