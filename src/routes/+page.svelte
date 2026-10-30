<script lang="ts">
	import type { PageProps } from './$types';
	import Home from '$lib/components/marketing/Home.svelte';
	import Dashboard from '$lib/components/library/Dashboard.svelte';

	let { data }: PageProps = $props();
</script>

{#if data.user}
	<Dashboard userName={data.user.name} />
{:else}
	<Home />
{/if}
