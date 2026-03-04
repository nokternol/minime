import { loadUser } from '$lib/stores/auth.js'
export const load = async () => ({ user: await loadUser() })
