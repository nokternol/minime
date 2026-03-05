<script lang="ts">
import type { IndexEntry } from '$lib/api.js';
import StatusDot from './StatusDot.svelte';
export let entries: IndexEntry[];
export let onSelect: (entry: IndexEntry) => void;
</script>

<ul style="list-style:none;padding:0;margin:0">
  {#each entries as entry (entry.id)}
    <li
      on:click={() => onSelect(entry)}
      style="padding:12px 16px;border-bottom:1px solid #222;cursor:pointer;display:flex;flex-direction:column;gap:4px"
    >
      <div style="display:flex;align-items:center;gap:8px">
        <StatusDot status={entry.status} />
        <span style="font-weight:500;flex:1">{entry.title}</span>
        <span style="font-size:11px;color:#666">{entry.type}</span>
      </div>
      <p style="margin:0;font-size:12px;color:#888">{entry.summary}</p>
      {#if entry.tags?.length}
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          {#each entry.tags as tag}
            <span style="font-size:10px;background:#1a1a1a;padding:2px 6px;border-radius:99px;color:#aaa">#{tag}</span>
          {/each}
        </div>
      {/if}
    </li>
  {/each}
</ul>
