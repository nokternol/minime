<script lang="ts">
import { goto } from '$app/navigation';
import { api } from '$lib/api.js';
import type { IndexEntry } from '$lib/api.js';
import EntryList from '$lib/components/EntryList.svelte';
import { onMount } from 'svelte';

const TYPES = ['all', 'idea', 'plan', 'discussion', 'solution', 'insight'];
const STATUSES = ['all', 'draft', 'active', 'parked', 'promoted', 'done', 'dismissed'];
let activeType = 'all';
let activeStatus = 'all';
let query = '';
let entries: IndexEntry[] = [];
let inflightCount = 0;
let searchTimer: ReturnType<typeof setTimeout> | null = null;

async function load() {
  const [items, inflight] = await Promise.all([
    api.content({
      type: activeType === 'all' ? undefined : activeType,
      status: activeStatus === 'all' ? undefined : activeStatus,
      q: query || undefined,
    }),
    api.inflight(),
  ]);
  entries = items;
  inflightCount = inflight.length;
}

function onSearchInput() {
  if (searchTimer !== null) clearTimeout(searchTimer);
  searchTimer = setTimeout(load, 200);
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
      on:input={onSearchInput}
      placeholder="Search..."
      style="width:100%;background:#111;border:1px solid #333;color:#fff;padding:8px;border-radius:6px;font-size:14px;box-sizing:border-box"
    />
  </div>

  <div style="display:flex;gap:0;overflow-x:auto;border-bottom:1px solid #111">
    {#each TYPES as t}
      <button
        on:click={() => { activeType = t; load() }}
        style="padding:8px 12px;border:none;background:{activeType===t?'#1a1a1a':'transparent'};color:{activeType===t?'#fff':'#666'};cursor:pointer;font-size:12px;white-space:nowrap"
      >{t}</button>
    {/each}
  </div>

  <div aria-label="Status filter" style="display:flex;gap:0;overflow-x:auto;border-bottom:1px solid #222">
    {#each STATUSES as s}
      <button
        on:click={() => { activeStatus = s; load() }}
        style="padding:6px 10px;border:none;background:{activeStatus===s?'#1a1a1a':'transparent'};color:{activeStatus===s?'#ccc':'#555'};cursor:pointer;font-size:11px;white-space:nowrap"
      >{s}</button>
    {/each}
  </div>

  <EntryList {entries} {onSelect} />
</div>
