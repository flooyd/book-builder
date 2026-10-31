<script lang="ts">
	import { resolve } from '$app/paths';
	import Wordmark from '$lib/components/ui/Wordmark.svelte';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';
	import { SOON } from './soon';

	// On the home page the section links scroll in place; elsewhere they lead back to it.
	let { onHome = false }: { onHome?: boolean } = $props();

	const sections = [
		{ id: 'features', label: 'Features' },
		{ id: 'example', label: 'Editor' },
		{ id: 'outline', label: 'Outline' },
		...(SOON.length > 0 ? [{ id: 'soon', label: 'Coming soon' }] : [])
	];
</script>

<header class="site-header">
	{#if onHome}
		<a class="brand" href="#top"><Wordmark size={26} /></a>
	{:else}
		<a class="brand" href={resolve('/')}><Wordmark size={26} /></a>
	{/if}

	<nav aria-label="Primary">
		{#each sections as section (section.id)}
			{#if onHome}
				<a href="#{section.id}">{section.label}</a>
			{:else}
				<a href="{resolve('/')}#{section.id}">{section.label}</a>
			{/if}
		{/each}
		<a href="https://github.com/flooyd/book-builder">GitHub</a>
	</nav>

	<div class="actions">
		<ThemeToggle />
		<a class="login" href={resolve('/login')}>Log in</a>
		<a class="start" href={resolve('/login')}>Get started</a>
	</div>
</header>

<style>
	.site-header {
		position: relative;
		z-index: 5;
		max-width: 1240px;
		margin: 0 auto;
		padding: 22px 32px;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 16px 32px;
	}

	.brand {
		display: inline-flex;
		text-decoration: none;
		border-radius: 8px;
	}

	nav {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 30px;
		font-size: 15px;
		font-weight: 500;
	}

	nav a {
		color: var(--bb-text-2);
		text-decoration: none;
	}

	nav a:hover {
		color: var(--bb-text-strong);
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.login,
	.start {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		border-radius: 10px;
		text-decoration: none;
		font-size: 15px;
	}

	.login {
		padding: 0 16px;
		color: var(--bb-text);
		font-weight: 600;
	}

	.login:hover {
		background: var(--bb-line-faint);
		color: var(--bb-text);
	}

	.start {
		padding: 0 18px;
		background: var(--bb-royal);
		color: #fff;
		font-weight: 700;
	}

	.start:hover {
		background: var(--bb-royal-hover);
		color: #fff;
	}

	@media (max-width: 600px) {
		.site-header {
			padding: 16px 20px;
		}

		nav {
			order: 3;
			width: 100%;
			gap: 4px 20px;
		}
	}
</style>
