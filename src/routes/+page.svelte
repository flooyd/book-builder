<script lang="ts">
	import { userStore } from '$lib/stores';
	import Intro from '$lib/components/Intro.svelte';
	import Books from '$lib/components/Books.svelte';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import Parts from '$lib/components/Parts.svelte';

	let ready = $state(false);
	onMount(() => {
		ready = true;
	});
</script>

{#if ready}
	<div transition:fade>
		<Intro />
		{#if $userStore}
			<Books />
			<Parts />
		{/if}
	</div>
{/if}
