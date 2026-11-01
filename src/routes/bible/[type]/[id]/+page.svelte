<script lang="ts">
	import EntryPage from '$lib/components/bible/EntryPage.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<!-- Re-mount per entry so the fields being edited belong to one entry. -->
{#key `${data.type}-${data.id}`}
	<EntryPage
		type={data.type}
		id={data.id}
		appearances={data.appearances}
		connections={data.connections}
	/>
{/key}
