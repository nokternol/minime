<script lang="ts">
  import { user } from '$lib/stores/auth.js'
</script>

{#if $user}
  <slot />
{:else}
  <main style="display:grid;place-items:center;height:100vh;font-family:system-ui;background:#0f0f0f;color:#fff">
    <a href="/auth/login" style="color:#60a5fa;font-size:16px">Sign in with Google</a>
  </main>
{/if}
