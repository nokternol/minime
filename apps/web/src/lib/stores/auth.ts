import { writable } from 'svelte/store'
import { api } from '$lib/api.js'

export const user = writable<{ email: string; name: string } | null>(null)

export async function loadUser() {
  user.set(await api.me())
}
