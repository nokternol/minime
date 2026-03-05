<script lang="ts">
export let status: string;
const colors: Record<string, string> = {
  draft: '#666',
  active: '#4ade80',
  parked: '#facc15',
  promoted: '#60a5fa',
  done: '#a3e635',
  dismissed: '#ef4444',
};
</script>
<span style="
  display:inline-block;width:8px;height:8px;border-radius:50%;
  background:{colors[status] ?? '#666'};flex-shrink:0
"></span>
