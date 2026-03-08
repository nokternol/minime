<script lang="ts">
import { api } from '$lib/api.js';
import type { InFlightItem } from '$lib/api.js';
import { onMount } from 'svelte';

let items: InFlightItem[] = [];
let loading = true;

onMount(async () => {
  items = await api.inflight();
  loading = false;
});
</script>

<div style="max-width:480px;margin:0 auto;font-family:system-ui;background:#0f0f0f;min-height:100vh;color:#fff">
  <header style="padding:12px 16px;border-bottom:1px solid #222;display:flex;align-items:center;gap:8px">
    <a href="/" style="color:#aaa;text-decoration:none">←</a>
    <strong style="flex:1">In-flight</strong>
  </header>

  {#if loading}
    <p style="padding:16px;color:#666">Loading...</p>
  {:else if items.length === 0}
    <p style="padding:16px;color:#666">No in-flight items.</p>
  {:else}
    <ul style="list-style:none;margin:0;padding:0">
      {#each items as item}
        <li style="padding:12px 16px;border-bottom:1px solid #111;display:flex;flex-direction:column;gap:4px">
          <span style="font-size:14px;font-weight:500">{item.title}</span>
          <span style="font-size:11px;color:#555">PR #{item.pr} · {item.branch}</span>
          {#if item.id}
            <a href="/chat/{item.id}" style="font-size:12px;color:#60a5fa;text-decoration:none">Open chat →</a>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>
