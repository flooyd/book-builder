<script lang="ts">
	import { page } from '$app/state';
	import PartPage from '$lib/components/part/PartPage.svelte';

	const id = $derived(Number(page.params.id));
</script>

<!-- Re-mount per part so the story text and edit state belong to one part. -->
{#key id}
	<PartPage {id} />
{/key}
