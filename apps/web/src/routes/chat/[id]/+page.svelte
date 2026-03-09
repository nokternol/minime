<script lang="ts">
import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { api } from '$lib/api.js';
import type { ContentDetail } from '$lib/api.js';
import { afterUpdate, onMount } from 'svelte';
import { marked } from 'marked';

let item: ContentDetail | null = null;
let messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
// Rendered HTML for completed assistant messages (populated after stream ends)
let renderedHtml: string[] = [];

let bottomAnchor: HTMLElement;
afterUpdate(() => { bottomAnchor?.scrollIntoView({ behavior: 'instant' }); });

let input = '';
let loading = false;
let finishing = false;
let parking = false;
let promoting = false;
let contextTitles: string[] = [];
let error = '';
let saving = false;
let savedAt: Date | null = null;

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
  renderedHtml = messages.map((m) =>
    m.role === 'assistant' ? String(marked.parse(m.content)) : ''
  );
});

async function save() {
  if (messages.length === 0) return;
  saving = true;
  error = '';
  try {
    const conversation = messages.map((m) => `${m.role}: ${m.content}`).join('\n');
    const { summary } = await api.summarise(conversation);
    // Format conversation as markdown and append to existing document body
    const sessionMd = [
      `## Session — ${new Date().toLocaleString()}`,
      '',
      ...messages.map((m) =>
        m.role === 'user' ? `**You:** ${m.content}` : `**Minime:** ${m.content}`
      ),
    ].join('\n\n');
    const currentBody = (item?.body ?? '').trimEnd();
    const newBody = currentBody ? `${currentBody}\n\n${sessionMd}` : sessionMd;
    await api.patch(id, { session_summary: summary, body: newBody });
    savedAt = new Date();
  } catch {
    error = 'Failed to save. Please try again.';
  } finally {
    saving = false;
  }
}

async function send() {
  if (!input.trim()) return;
  const userMsg = { role: 'user' as const, content: input };
  messages = [...messages, userMsg];
  input = '';
  loading = true;
  error = '';
  const BASE = import.meta.env.PUBLIC_API_URL ?? '';
  const assistantMsg = { role: 'assistant' as const, content: '' };
  messages = [...messages, assistantMsg];
  try {
    const res = await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.slice(0, -1),
        query: item?.title,
        relatedToId: id,
      }),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    if (!res.body) throw new Error('No response body');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        const lines = part.split('\n');
        const eventLine = lines.find((l) => l.startsWith('event:'));
        const dataLines = lines.filter((l) => l.startsWith('data:'));
        if (!dataLines.length) continue;
        // SSE encodes \n in data as multiple "data:" lines — reassemble them
        const data = dataLines.map((l) => l.slice(6)).join('\n');
        if (eventLine?.includes('context')) {
          try {
            contextTitles = JSON.parse(data).map((e: { title: string }) => e.title);
          } catch {
            /* ignore */
          }
        } else if (data.trimEnd() !== '[DONE]') {
          assistantMsg.content += data;
          messages = [...messages];
        }
      }
    }
  } catch {
    error = 'Failed to send message. Please try again.';
    messages = messages.slice(0, -1);
  } finally {
    loading = false;
    renderedHtml = messages.map((m) =>
      m.role === 'assistant' ? String(marked.parse(m.content)) : ''
    );
  }
}

async function park() {
  parking = true;
  error = '';
  try {
    await save();
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
    const { id: planId } = await api.promote(id, item.title, item.summary, item.session_summary);
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

<style>
  .md p { margin: 0 0 0.5em; }
  .md p:last-child { margin-bottom: 0; }
  .md ul, .md ol { margin: 0 0 0.5em 1.2em; padding: 0; }
  .md li { margin-bottom: 0.2em; }
  .md code { background: #2a2a2a; padding: 0.1em 0.3em; border-radius: 3px; font-size: 0.9em; }
  .md pre { background: #2a2a2a; padding: 8px; border-radius: 6px; overflow-x: auto; margin: 0 0 0.5em; }
  .md pre code { background: none; padding: 0; }
  .md strong { color: #e2e8f0; }
  .md h1, .md h2, .md h3 { margin: 0.5em 0 0.25em; font-size: 1em; font-weight: 600; }
  .md pre { overflow-x: auto; max-width: 100%; }
  .md * { overflow-wrap: break-word; }
</style>

<div style="max-width:480px;margin:0 auto;display:flex;flex-direction:column;height:100vh;font-family:system-ui;background:#0f0f0f;color:#fff">
  <header style="padding:12px 16px;border-bottom:1px solid #222;display:flex;align-items:center;gap:8px">
    <a href="/" style="color:#aaa;text-decoration:none">←</a>
    <span style="flex:1;font-weight:500;font-size:14px">{item?.title ?? '...'}</span>
    {#if item}
      {#if item.type === 'idea'}
        <button on:click={promote} disabled={promoting || finishing} title="Promote to Plan — creates a new plan document seeded from this idea and its session notes" style="font-size:12px;background:#1a2a3a;color:#a78bfa;border:1px solid #a78bfa;padding:4px 10px;border-radius:6px;cursor:pointer">{promoting ? '...' : '→ Plan'}</button>
      {/if}
      <button on:click={park} disabled={parking || finishing} title="Park — saves the conversation then marks this as paused. Come back to it later from the home screen." style="font-size:12px;background:#2a2a1a;color:#facc15;border:1px solid #facc15;padding:4px 10px;border-radius:6px;cursor:pointer">{parking ? '...' : 'Park'}</button>
      <button on:click={save} disabled={saving || finishing || parking} title="Save — appends this conversation to the document and generates a session summary. Does not commit to GitHub." style="font-size:12px;background:#1a1a2a;color:#94a3b8;border:1px solid #94a3b8;padding:4px 10px;border-radius:6px;cursor:pointer">{saving ? '...' : savedAt ? 'Saved ✓' : 'Save'}</button>
      {#if item.pr}
        <button on:click={finish} disabled={finishing || parking} title="Commit — merges the PR into main, permanently storing this item in your knowledge base. Cannot be undone." style="font-size:12px;background:#1a3a1a;color:#4ade80;border:1px solid #4ade80;padding:4px 10px;border-radius:6px;cursor:pointer">{finishing ? '...' : 'Commit ✓'}</button>
      {/if}
    {/if}
  </header>

  {#if contextTitles.length}
    <div style="padding:6px 16px;font-size:11px;color:#666;border-bottom:1px solid #111">
      Context: {contextTitles.join(', ')}
    </div>
  {/if}

  <div style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px">
    {#each messages as msg, i}
      <div
        class={msg.role === 'assistant' ? 'md' : ''}
        style="
          align-self:{msg.role==='user'?'flex-end':'flex-start'};
          max-width:85%;background:{msg.role==='user'?'#1a3a5c':'#1a1a1a'};
          padding:10px 14px;border-radius:12px;font-size:14px;overflow-wrap:break-word;min-width:0
        "
      >
        {#if msg.role === 'assistant'}
          {#if renderedHtml[i]}
            {@html renderedHtml[i]}
          {:else}
            <span style="white-space:pre-wrap;color:{msg.content ? 'inherit' : '#666'}">{msg.content || '…'}</span>
          {/if}
        {:else}
          {msg.content}
        {/if}
      </div>
    {/each}
    {#if error}
      <p role="alert" style="color:#f87171;font-size:13px;padding:0 4px">{error}</p>
    {/if}
    <div bind:this={bottomAnchor}></div>
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
