<script module>
import { defineMeta } from '@storybook/addon-svelte-csf';
import { http, HttpResponse } from 'msw';
import Page from './+page.svelte';

const { Story } = defineMeta({
  title: 'Routes/Browse',
  component: Page,
});
</script>

<!-- Default handler returns [] -->
<Story name="Empty" />

<Story
  name="Default — mixed entries"
  parameters={{
    msw: {
      handlers: [
        http.get('http://localhost:8744/api/content', () =>
          HttpResponse.json([
            {
              id: '01JIDEA1',
              type: 'idea',
              title: 'Build a focus system',
              status: 'active',
              tags: ['productivity'],
              summary: 'An idea for focusing better',
              created: '2026-03-01T00:00:00Z',
              updated: '2026-03-01T00:00:00Z',
              path: 'ideas/focus.md',
            },
            {
              id: '01JPLAN1',
              type: 'plan',
              title: 'Plan: Refactor API',
              status: 'parked',
              tags: ['api', 'tech'],
              summary: 'Structured plan to refactor the API layer',
              created: '2026-03-02T00:00:00Z',
              updated: '2026-03-02T00:00:00Z',
              path: 'plans/api-refactor.md',
            },
            {
              id: '01JIDEA2',
              type: 'idea',
              title: 'Add dark mode',
              status: 'done',
              tags: ['ui'],
              summary: 'Ship dark mode toggle',
              created: '2026-03-03T00:00:00Z',
              updated: '2026-03-03T00:00:00Z',
              path: 'ideas/dark-mode.md',
            },
          ])
        ),
      ],
    },
  }}
/>

<Story
  name="Status filter — parked only"
  parameters={{
    msw: {
      handlers: [
        http.get('http://localhost:8744/api/content', () =>
          HttpResponse.json([
            {
              id: '01JPLAN1',
              type: 'plan',
              title: 'Plan: Refactor API',
              status: 'parked',
              tags: ['api'],
              summary: 'Structured plan to refactor the API layer',
              created: '2026-03-02T00:00:00Z',
              updated: '2026-03-02T00:00:00Z',
              path: 'plans/api-refactor.md',
            },
          ])
        ),
      ],
    },
  }}
/>

<Story
  name="In-flight badge"
  parameters={{
    msw: {
      handlers: [
        http.get('http://localhost:8744/api/content', () => HttpResponse.json([])),
        http.get('http://localhost:8744/api/content/inflight', () =>
          HttpResponse.json([
            { pr: 7, branch: 'idea/abc', title: 'Draft idea' },
            { pr: 8, branch: 'idea/xyz', title: 'Another draft' },
          ])
        ),
      ],
    },
  }}
/>
