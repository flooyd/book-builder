<script lang="ts">
	import { page } from '$app/state';
	import BookPage from '$lib/components/book/BookPage.svelte';

	const id = $derived(Number(page.params.id));
</script>

<!-- Re-mount per book so edit state doesn't carry over between books. -->
{#key id}
	<BookPage {id} />
{/key}
