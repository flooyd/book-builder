<script lang="ts">
	import type { PageProps } from './$types';
	import ConnectionsPage from '$lib/components/bible/ConnectionsPage.svelte';

	let { data }: PageProps = $props();
</script>

<!-- Re-mount per series so the map's layout and choices belong to one series. -->
{#key data.id}
	<ConnectionsPage scope={{ kind: 'series', id: data.id }} connections={data.connections} />
{/key}
