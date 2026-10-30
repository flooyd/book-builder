<script lang="ts">
	import type { PageProps } from './$types';
	import Home from '$lib/components/marketing/Home.svelte';
	import Books from '$lib/components/Books.svelte';
	import Parts from '$lib/components/Parts.svelte';
	import Chapters from '$lib/components/Chapters.svelte';

	let { data }: PageProps = $props();
</script>

{#if data.user}
	<Books />
	<Parts />
	<Chapters />
{:else}
	<Home />
{/if}
