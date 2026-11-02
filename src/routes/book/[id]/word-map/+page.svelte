<script lang="ts">
	import WordMapPage from '$lib/components/insights/WordMapPage.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<!-- Re-mount per book so the chosen character and word don't carry over between books. -->
{#key data.book.id}
	<WordMapPage book={data.book} maps={data.maps} />
{/key}
