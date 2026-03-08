<script lang="ts">
import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { api } from '$lib/api.js';
import type { ContentDetail } from '$lib/api.js';
import { onMount } from 'svelte';

let item: ContentDetail | null = null;
let messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
let input = '';
let loading = false;
let finishing = false;
let parking = false;
let promoting = false;
let contextTitles: string[] = [];
let error = '';

const idParam = $page.params.id;
if (!idParam) throw new Error('Missing route param: id');
const id = idParam;

onMount(async () => {
  item = await api.contentById(id);
  if (item?.session_summary) {
    messages = [
      { role: 'assistant', content: `Continuing from last session:\n\n${item.session_summary}` },
    ];
  }
});

async function send() {
  if (!input.trim()) return;
  const userMsg = { role: 'user' as const, content: input };
  messages = [...messages, userMsg];
  input = '';
  loading = true;
  error = '';
  try {
    const res = await api.chat(messages, item?.title, id);
    messages = [...messages, { role: 'assistant', content: res.reply }];
    contextTitles = res.context.map((c) => c.title);
  } catch {
    error = 'Failed to send message. Please try again.';
  } finally {
    loading = false;
  }
}

async function park() {
  parking = true;
  error = '';
  try {
    await api.park(id);
    goto('/');
  } catch {
    error = 'Failed to park. Please try again.';
    parking = false;
  }
}

async function promote() {
  if (!item) return;
  promoting = true;
  error = '';
  try {
    const { id: planId } = await api.promote(id, item.title, item.summary);
    goto(`/chat/${planId}`);
  } catch {
    error = 'Failed to promote. Please try again.';
    promoting = false;
  }
}

async function finish() {
  if (!confirm('Commit this session to GitHub?')) return;
  finishing = true;
  error = '';
  try {
    const conversation = messages.map((m) => `${m.role}: ${m.content}`).join('\n');
    const { summary } = await api.summarise(conversation);
    await api.patch(id, { session_summary: summary });
    await api.commit(id);
    goto('/');
  } catch {
    error = 'Failed to commit session. Please try again.';
    finishing = false;
  }
}
</script>

<div style="max-width:480px;margin:0 auto;display:flex;flex-direction:column;height:100vh;font-family:system-ui;background:#0f0f0f;color:#fff">
  <header style="padding:12px 16px;border-bottom:1px solid #222;display:flex;align-items:center;gap:8px">
    <a href="/" style="color:#aaa;text-decoration:none">←</a>
    <span style="flex:1;font-weight:500;font-size:14px">{item?.title ?? '...'}</span>
    {#if item}
      {#if item.type === 'idea'}
        <button on:click={promote} disabled={promoting || finishing} style="font-size:12px;background:#1a2a3a;color:#a78bfa;border:1px solid #a78bfa;padding:4px 10px;border-radius:6px;cursor:pointer">{promoting ? '...' : '→ Plan'}</button>
      {/if}
      <button on:click={park} disabled={parking || finishing} style="font-size:12px;background:#2a2a1a;color:#facc15;border:1px solid #facc15;padding:4px 10px;border-radius:6px;cursor:pointer">{parking ? '...' : 'Park'}</button>
      {#if item.pr}
        <button on:click={finish} disabled={finishing || parking} style="font-size:12px;background:#1a3a1a;color:#4ade80;border:1px solid #4ade80;padding:4px 10px;border-radius:6px;cursor:pointer">{finishing ? '...' : 'Commit ✓'}</button>
      {/if}
    {/if}
  </header>

  {#if contextTitles.length}
    <div style="padding:6px 16px;font-size:11px;color:#666;border-bottom:1px solid #111">
      Context: {contextTitles.join(', ')}
    </div>
  {/if}

  <div style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px">
    {#each messages as msg}
      <div style="
        align-self:{msg.role==='user'?'flex-end':'flex-start'};
        max-width:85%;background:{msg.role==='user'?'#1a3a5c':'#1a1a1a'};
        padding:10px 14px;border-radius:12px;font-size:14px;white-space:pre-wrap
      ">{msg.content}</div>
    {/each}
    {#if loading}
      <div style="align-self:flex-start;color:#666;font-size:14px">...</div>
    {/if}
    {#if error}
      <p role="alert" style="color:#f87171;font-size:13px;padding:0 4px">{error}</p>
    {/if}
  </div>

  <div style="padding:12px 16px;border-top:1px solid #222;display:flex;gap:8px">
    <textarea
      bind:value={input}
      on:keydown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
      placeholder="Message..."
      rows="2"
      style="flex:1;background:#111;border:1px solid #333;color:#fff;padding:8px;border-radius:8px;font-size:14px;resize:none"
    ></textarea>
    <button on:click={send} disabled={loading}
      style="background:#1a3a5c;color:#60a5fa;border:none;padding:8px 14px;border-radius:8px;cursor:pointer">→</button>
  </div>
</div>
