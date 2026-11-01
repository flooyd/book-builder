<script lang="ts">
	import type { PageProps } from './$types';
	import PublicSeries from '$lib/components/series/PublicSeries.svelte';

	let { data }: PageProps = $props();
</script>

{#key `${data.handle}-${data.id}`}
	<PublicSeries series={data.series} handle={data.handle} />
{/key}
