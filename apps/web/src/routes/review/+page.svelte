<script lang="ts">
import { goto } from '$app/navigation';
import { api } from '$lib/api.js';
import type { InFlightItem } from '$lib/api.js';
import { onMount } from 'svelte';

let items: InFlightItem[] = [];
let loading = true;
let acting = new Set<string>();

function itemKey(item: InFlightItem) {
  return item.id ?? `pr-${item.pr}`;
}

onMount(async () => {
  items = await api.inflight();
  loading = false;
});

function remove(item: InFlightItem) {
  items = items.filter((i) => i !== item);
}

async function doCommit(item: InFlightItem) {
  if (!item.id) return;
  if (!confirm('Merge this item to memory?')) return;
  const key = itemKey(item);
  acting = new Set(acting).add(key);
  try {
    await api.commit(item.id);
    remove(item);
  } finally {
    acting = new Set([...acting].filter((k) => k !== key));
  }
}

async function doPark(item: InFlightItem) {
  if (!item.id) return;
  const key = itemKey(item);
  acting = new Set(acting).add(key);
  try {
    await api.park(item.id);
    remove(item);
  } finally {
    acting = new Set([...acting].filter((k) => k !== key));
  }
}

async function doDiscard(item: InFlightItem) {
  if (!confirm('Discard and delete this item?')) return;
  const key = itemKey(item);
  acting = new Set(acting).add(key);
  try {
    if (item.id) {
      await api.dismiss(item.id);
    }
    remove(item);
  } finally {
    acting = new Set([...acting].filter((k) => k !== key));
  }
}

async function doPromote(item: InFlightItem) {
  if (!item.id) return;
  const key = itemKey(item);
  acting = new Set(acting).add(key);
  try {
    const detail = await api.contentById(item.id);
    const { id: planId } = await api.promote(item.id, detail.title, detail.summary);
    goto(`/chat/${planId}`);
  } finally {
    acting = new Set([...acting].filter((k) => k !== key));
  }
}
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
      {#each items as item (itemKey(item))}
        {@const key = itemKey(item)}
        {@const busy = acting.has(key)}
        <li style="padding:12px 16px;border-bottom:1px solid #111;display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;flex-direction:column;gap:4px">
            <span style="font-size:14px;font-weight:500">{item.title}</span>
            <span style="font-size:11px;color:#555">PR #{item.pr} · {item.branch}</span>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            {#if item.id}
              <a
                href="/chat/{item.id}"
                style="font-size:12px;color:#60a5fa;text-decoration:none;padding:4px 8px;border:1px solid #1a3a5c;border-radius:6px"
              >Open →</a>
              {#if item.type === 'idea'}
                <button
                  onclick={() => doPromote(item)}
                  disabled={busy}
                  style="font-size:12px;background:#1a2a3a;color:#a78bfa;border:1px solid #a78bfa;padding:4px 8px;border-radius:6px;cursor:pointer"
                >{busy ? '...' : 'Promote → Plan'}</button>
              {/if}
              <button
                onclick={() => doCommit(item)}
                disabled={busy}
                style="font-size:12px;background:#1a3a1a;color:#4ade80;border:1px solid #4ade80;padding:4px 8px;border-radius:6px;cursor:pointer"
              >{busy ? '...' : 'Commit ✓'}</button>
              <button
                onclick={() => doPark(item)}
                disabled={busy}
                style="font-size:12px;background:#2a2a1a;color:#facc15;border:1px solid #facc15;padding:4px 8px;border-radius:6px;cursor:pointer"
              >{busy ? '...' : 'Park'}</button>
            {/if}
            <button
              onclick={() => doDiscard(item)}
              disabled={busy}
              style="font-size:12px;background:#2a1a1a;color:#f87171;border:1px solid #f87171;padding:4px 8px;border-radius:6px;cursor:pointer"
            >{busy ? '...' : 'Discard'}</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>
