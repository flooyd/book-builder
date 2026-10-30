<script lang="ts">
	import type { PageProps } from './$types';
	import Reader from '$lib/components/reader/Reader.svelte';

	let { data }: PageProps = $props();
</script>

<!-- Re-mount per book so the reading position doesn't carry over between books. -->
{#key data.book.id}
	<Reader {data} />
{/key}
