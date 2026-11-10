<script lang="ts">
	import Shelf from '$lib/components/studio/Shelf.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<Shelf owner={data.owner} />
