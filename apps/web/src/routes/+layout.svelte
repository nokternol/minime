<script lang="ts">
import { PUBLIC_API_URL } from '$env/static/public';
import { loadUser, user } from '$lib/stores/auth.js';
import { onMount } from 'svelte';
const apiBase = PUBLIC_API_URL;

onMount(loadUser);
</script>

{#if $user}
  <slot />
{:else}
  <main style="display:grid;place-items:center;height:100vh;font-family:system-ui;background:#0f0f0f;color:#fff">
    <a href="{apiBase}/auth/login" style="color:#60a5fa;font-size:16px">Sign in with Google</a>
  </main>
{/if}
