<script module>
import { defineMeta } from '@storybook/addon-svelte-csf';
import StatusDot from './StatusDot.svelte';

const { Story } = defineMeta({
  title: 'Components/StatusDot',
  component: StatusDot,
  argTypes: {
    status: {
      control: 'select',
      options: ['draft', 'active', 'parked', 'promoted', 'done', 'dismissed'],
    },
  },
});
</script>

<Story name="Draft" args={{ status: 'draft' }} />
<Story name="Active" args={{ status: 'active' }} />
<Story name="Parked" args={{ status: 'parked' }} />
<Story name="Promoted" args={{ status: 'promoted' }} />
<Story name="Done" args={{ status: 'done' }} />
<Story name="Dismissed" args={{ status: 'dismissed' }} />

<Story name="All statuses">
  {#snippet template()}
    <!--
      Use {#snippet template()} not {#snippet children()}.
      'children' = static markup only, ignores args.
      'template' = dynamic, receives args and context.
      Verified against addon-svelte-csf v5 source.
    -->
    <div style="display:flex;gap:16px;align-items:center;padding:16px">
      {#each ['draft', 'active', 'parked', 'promoted', 'done', 'dismissed'] as s}
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
          <StatusDot status={s} />
          <span style="font-size:10px;color:#888;font-family:system-ui">{s}</span>
        </div>
      {/each}
    </div>
  {/snippet}
</Story>
