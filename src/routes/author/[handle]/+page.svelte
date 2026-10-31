<script lang="ts">
	import type { PageProps } from './$types';
	import AuthorPage from '$lib/components/profile/AuthorPage.svelte';

	let { data }: PageProps = $props();
</script>

{#key data.handle}
	<AuthorPage author={data.author} />
{/key}
