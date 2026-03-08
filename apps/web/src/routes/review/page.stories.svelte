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
  name="Items without chat link"
  parameters={{
    msw: {
      handlers: [
        http.get('http://localhost:8744/api/content/inflight', () =>
          HttpResponse.json([
            { pr: 12, branch: 'idea/focus-system', title: '[idea] Build a focus system' },
            { pr: 9, branch: 'plan/api-refactor', title: '[plan] Refactor API client' },
          ])
        ),
      ],
    },
  }}
/>

<Story
  name="Items with chat links"
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
            },
            { pr: 9, branch: 'plan/api-refactor', title: '[plan] Refactor API client' },
          ])
        ),
      ],
    },
  }}
/>
