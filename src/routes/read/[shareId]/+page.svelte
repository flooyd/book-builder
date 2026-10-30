<script lang="ts">
	import type { PageProps } from './$types';
	import Reader from '$lib/components/reader/Reader.svelte';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<!-- Shared by link, not listed: keep it out of search results. -->
	<meta name="robots" content="noindex" />
</svelte:head>

{#key data.book.id}
	<Reader {data} />
{/key}
