<script lang="ts">
	import type { PageProps } from './$types';
	import SeriesPage from '$lib/components/series/SeriesPage.svelte';

	let { data }: PageProps = $props();
</script>

{#key data.id}
	<SeriesPage id={data.id} handle={data.handle} words={data.words} />
{/key}
