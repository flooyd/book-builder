<script lang="ts">
	import { page } from '$app/state';
	import OutlinePage from '$lib/components/outline/OutlinePage.svelte';

	const id = $derived(Number(page.params.id));
</script>

<!-- Re-mount per book so the outline's state doesn't carry over between books. -->
{#key id}
	<OutlinePage {id} />
{/key}
