<script lang="ts">
	import ArtShelf from '$lib/components/art/ArtShelf.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<ArtShelf owner={data.owner} />
