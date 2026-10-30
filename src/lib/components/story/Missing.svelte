<script lang="ts">
	import { resolve } from '$app/paths';
	import { booksRefresh, libraryStatus } from '$lib/stores';
	import Button from '$lib/components/ui/Button.svelte';

	// Shown when a book, part or chapter isn't in the loaded library (or the library failed).
	let { noun }: { noun: 'book' | 'part' | 'chapter' } = $props();
</script>

{#if $libraryStatus === 'ready'}
	<main class="missing">
		<h1>This {noun} isn't on your shelf.</h1>
		<p>It may have been deleted, or the link is wrong.</p>
		<Button variant="primary" href={resolve('/')}>Back to your library</Button>
	</main>
{:else if $libraryStatus === 'error'}
	<main class="missing" role="alert">
		<h1>We couldn't load this {noun}.</h1>
		<Button onclick={() => booksRefresh.update((n) => n + 1)}>Try again</Button>
	</main>
{/if}

<style>
	.missing {
		max-width: 1280px;
		margin: 0 auto;
		padding: 80px 32px;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 16px;
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
		.missing {
			padding: 48px 16px;
		}
	}
</style>
