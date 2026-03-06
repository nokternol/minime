<script lang="ts">
import { goto } from '$app/navigation';
import { api } from '$lib/api.js';
import type { IndexEntry } from '$lib/api.js';
import EntryList from '$lib/components/EntryList.svelte';
import { onMount } from 'svelte';

const TYPES = ['all', 'idea', 'plan', 'discussion', 'solution', 'insight'];
// biome-ignore lint/style/useConst: Svelte bind:value and on:click reassignment require let
let activeType = 'all';
// biome-ignore lint/style/useConst: Svelte bind:value requires let (two-way binding mutates this)
let query = '';
let entries: IndexEntry[] = [];
let inflightCount = 0;

async function load() {
  const [items, inflight] = await Promise.all([
    api.content({ type: activeType === 'all' ? undefined : activeType, q: query || undefined }),
    api.inflight(),
  ]);
  entries = items;
  inflightCount = inflight.length;
}

onMount(load);

function onSelect(entry: IndexEntry) {
  goto(`/chat/${entry.id}`);
}
</script>

<div style="max-width:480px;margin:0 auto;font-family:system-ui;background:#0f0f0f;min-height:100vh;color:#fff">
  <header style="padding:16px;border-bottom:1px solid #222;display:flex;align-items:center;justify-content:space-between">
    <strong>minime</strong>
    {#if inflightCount > 0}
      <a href="/review" style="font-size:12px;color:#facc15">⚑ {inflightCount} in-flight</a>
    {/if}
    <a href="/chat/new" style="font-size:20px;text-decoration:none;color:#fff">＋</a>
  </header>

  <div style="padding:8px 16px;border-bottom:1px solid #222">
    <input
      bind:value={query}
      on:input={load}
      placeholder="Search..."
      style="width:100%;background:#111;border:1px solid #333;color:#fff;padding:8px;border-radius:6px;font-size:14px;box-sizing:border-box"
    />
  </div>

  <div style="display:flex;gap:0;overflow-x:auto;border-bottom:1px solid #222">
    {#each TYPES as t}
      <button
        on:click={() => { activeType = t; load() }}
        style="padding:8px 12px;border:none;background:{activeType===t?'#1a1a1a':'transparent'};color:{activeType===t?'#fff':'#666'};cursor:pointer;font-size:12px;white-space:nowrap"
      >{t}</button>
    {/each}
  </div>

  <EntryList {entries} {onSelect} />
</div>
