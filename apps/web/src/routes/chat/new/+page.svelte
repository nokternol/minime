<script lang="ts">
  import { goto } from '$app/navigation'
  import { api } from '$lib/api.js'

  let title = ''
  let body = ''
  let saving = false
  let error = ''

  async function capture() {
    if (!title.trim()) return
    saving = true
    error = ''
    try {
      const fm = await api.summarise(body || title)
      const { id } = await api.capture({ type: 'idea', title, tags: [], summary: fm.summary, body })
      goto(`/chat/${id}`)
    } catch {
      error = 'Something went wrong. Please try again.'
    } finally { saving = false }
  }
</script>

<div style="max-width:480px;margin:0 auto;padding:16px;font-family:system-ui;background:#0f0f0f;min-height:100vh;color:#fff">
  <header style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
    <a href="/" style="color:#aaa;text-decoration:none">←</a>
    <strong>New capture</strong>
  </header>

  <input bind:value={title} placeholder="Title..."
    style="width:100%;background:#111;border:1px solid #333;color:#fff;padding:8px;border-radius:6px;margin-bottom:8px;font-size:16px;box-sizing:border-box" />

  <textarea bind:value={body} placeholder="What's on your mind? (optional — Claude will structure it)" rows="6"
    style="width:100%;background:#111;border:1px solid #333;color:#fff;padding:8px;border-radius:6px;resize:none;font-size:14px;margin-bottom:12px;box-sizing:border-box"></textarea>

  {#if error}
    <p role="alert" style="color:#f87171;font-size:14px;margin-bottom:8px">{error}</p>
  {/if}

  <button on:click={capture} disabled={saving || !title.trim()}
    style="width:100%;background:#1a3a5c;color:#60a5fa;border:none;padding:12px;border-radius:8px;font-size:16px;cursor:pointer">
    {saving ? 'Capturing...' : 'Capture →'}
  </button>
</div>
