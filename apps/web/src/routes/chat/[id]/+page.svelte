<script lang="ts">
  import { page } from '$app/stores'
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { api } from '$lib/api.js'
  import type { ContentDetail } from '$lib/api.js'

  let item: ContentDetail | null = null
  let messages: Array<{ role: 'user' | 'assistant'; content: string }> = []
  let input = ''
  let loading = false
  let contextTitles: string[] = []

  const id = $page.params.id

  onMount(async () => {
    item = await api.contentById(id)
    if (item?.session_summary) {
      messages = [{ role: 'assistant', content: `Continuing from last session:\n\n${item.session_summary}` }]
    }
  })

  async function send() {
    if (!input.trim()) return
    const userMsg = { role: 'user' as const, content: input }
    messages = [...messages, userMsg]
    input = ''
    loading = true
    try {
      const res = await api.chat(messages, item?.title, id)
      messages = [...messages, { role: 'assistant', content: res.reply }]
      contextTitles = res.context.map(c => c.title)
    } finally { loading = false }
  }

  async function finish() {
    const conversation = messages.map(m => `${m.role}: ${m.content}`).join('\n')
    await api.summarise(conversation)
    await api.commit(id)
    goto('/')
  }
</script>

<div style="max-width:480px;margin:0 auto;display:flex;flex-direction:column;height:100vh;font-family:system-ui;background:#0f0f0f;color:#fff">
  <header style="padding:12px 16px;border-bottom:1px solid #222;display:flex;align-items:center;gap:8px">
    <a href="/" style="color:#aaa;text-decoration:none">←</a>
    <span style="flex:1;font-weight:500;font-size:14px">{item?.title ?? '...'}</span>
    {#if item?.pr}
      <button on:click={finish} style="font-size:12px;background:#1a3a1a;color:#4ade80;border:1px solid #4ade80;padding:4px 10px;border-radius:6px;cursor:pointer">Commit ✓</button>
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
