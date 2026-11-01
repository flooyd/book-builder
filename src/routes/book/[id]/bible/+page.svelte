<script lang="ts">
	import { page } from '$app/state';
	import BiblePage from '$lib/components/bible/BiblePage.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const id = $derived(Number(page.params.id));
</script>

<!-- Re-mount per book so a search doesn't carry over between books. -->
{#key id}
	<BiblePage {id} counts={data.counts} />
{/key}
