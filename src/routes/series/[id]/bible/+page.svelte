<script lang="ts">
	import type { PageProps } from './$types';
	import SeriesBible from '$lib/components/series/SeriesBible.svelte';

	let { data }: PageProps = $props();
</script>

{#key data.id}
	<SeriesBible id={data.id} counts={data.counts} />
{/key}
