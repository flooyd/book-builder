<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import Wordmark from '$lib/components/ui/Wordmark.svelte';

	// Errors from server loads (a missing book, a shared link that was turned off).
	const missing = $derived(page.status === 404);
	// Reading mode has no header, so its errors link home themselves.
	const bare = $derived(page.route.id === '/book/[id]/read' || page.route.id === '/read/[shareId]');
</script>

<svelte:head>
	<title>{missing ? 'Not found' : 'Something went wrong'} · Book Builder</title>
</svelte:head>

<main class="error">
	{#if bare}<a class="brand" href={resolve('/')}><Wordmark size={22} /></a>{/if}
	<h1>{missing ? "This page isn't on the shelf." : 'Something went wrong.'}</h1>
	<p>{page.error?.message}</p>
	<Button variant="primary" href={resolve('/')}>Go to Book Builder</Button>
</main>

<style>
	.error {
		max-width: 1280px;
		margin: 0 auto;
		padding: 64px 32px 96px;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 16px;
	}

	.brand {
		margin-bottom: 24px;
		display: inline-flex;
		text-decoration: none;
		border-radius: 8px;
	}

	h1 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(36px, 4vw, 52px);
		line-height: 1.05;
		color: var(--bb-text-strong);
	}

	p {
		color: var(--bb-text-2);
	}

	@media (max-width: 600px) {
		.error {
			padding: 40px 16px 64px;
		}
	}
</style>
