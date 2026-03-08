import { api } from '$lib/api.js';
export const load = async () => ({ user: await api.me().catch(() => null) });
