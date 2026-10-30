<script lang="ts">
	import { page } from '$app/state';
	import ChapterPage from '$lib/components/chapter/ChapterPage.svelte';

	const id = $derived(Number(page.params.id));
</script>

<!-- Re-mount per chapter so the story text and edit state belong to one chapter. -->
{#key id}
	<ChapterPage {id} />
{/key}
