<script lang="ts">
	import StudioApp from '$lib/components/studio/StudioApp.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<!-- Re-mount per drawing so the studio's state and undo belong to one drawing. -->
{#key data.key}
	<StudioApp draftKey={data.key} owner={data.owner} />
{/key}
