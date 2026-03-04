import { writable } from 'svelte/store'
import { api } from '$lib/api.js'

export const user = writable<{ email: string; name: string } | null>(null)

export async function loadUser() {
  const me = await api.me()
  user.set(me)
  return me
}
