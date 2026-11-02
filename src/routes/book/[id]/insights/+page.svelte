<script lang="ts">
	import InsightsPage from '$lib/components/insights/InsightsPage.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<!-- Re-mount per book so the open word and chosen views don't carry over between books. -->
{#key data.book.id}
	<InsightsPage book={data.book} insights={data.insights} />
{/key}
