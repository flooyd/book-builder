<script lang="ts">
	import type { PageData } from './$types';
	import type { Snippet } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import Nav from '$lib/components/Nav.svelte';
	import { userStore, showMenuStore, modalStore, booksRefresh, booksStore } from '$lib/stores';
	import type { Book } from '$lib/stores';
	import Menu from '$lib/components/Menu.svelte';
	import Modal from '$lib/components/Modal.svelte';

	let { data, children }: { data: PageData; children: Snippet } = $props();

	$effect(() => {
		userStore.set(data?.user ?? null);
	});

	$effect(() => {
		void $booksRefresh;
		getBooks().then((data) => {
			booksStore.set(data);
		});
	});

	const handleKeyDown = (event: KeyboardEvent) => {
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'm') {
			event.preventDefault(); // Stops the browser from opening a new tab
			showMenuStore.update((value) => !value); // Toggle the menu visibility
		}
	};

	const getBooks = async () => {
		const response = await fetch('/api/books');
		const data = await response.json();
		return data as Book[];
	};

	console.log('Hello, world! Welcome to Book Builder.');
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<Nav />
<div class="footer">
	<p>Book Builder &copy; 2026 by Floyd Jones</p>
	<p>Build Books and share them with others!</p>
	<p>
		Check out the <a href="https://github.com/flooyd/book-builder" target="_blank"
			>GitHub repository</a
		> to learn more.
	</p>
</div>
<div class="app">
	{@render children()}
	{#if $showMenuStore}
		<Menu />
	{/if}
	{#if $modalStore}
		{#if $modalStore.type === 'create' && $modalStore.category === 'book'}
			<Modal title={$modalStore.title} category={$modalStore.category} type={$modalStore.type} />
		{/if}
		{#if $modalStore.type === 'create' && $modalStore.category === 'part'}
			<Modal title={$modalStore.title} category={$modalStore.category} type={$modalStore.type} />
		{/if}
		{#if $modalStore.type === 'create' && $modalStore.category === 'chapter'}
			<Modal title={$modalStore.title} category={$modalStore.category} type={$modalStore.type} />
		{/if}
		{#if $modalStore.type === 'create' && $modalStore.category === 'character'}
			<Modal title={$modalStore.title} category={$modalStore.category} type={$modalStore.type} />
		{/if}
		{#if $modalStore.type === 'create' && $modalStore.category === 'system'}
			<Modal title={$modalStore.title} category={$modalStore.category} type={$modalStore.type} />
		{/if}
	{/if}
</div>

<svelte:window onkeydown={handleKeyDown} />

<style>
	@import url('https://googleapis.com');

	:global(body) {
		font-family: 'Gelasio', serif;
		font-size: 16px;
		line-height: 1.5;
	}

	:global(h1, h2, h3, h4, h5, h6, button) {
		font-family: 'Montserrat', sans-serif;
		font-weight: 700;
		line-height: 1.2;
	}

	:global(h1) {
		font-size: 41.89px;
	}

	:global(h2) {
		font-size: 25.89px;
	}

	:global(a) {
		text-decoration: none;
		color: inherit;
	}

	.app {
		padding: 16px;
	}

	:global(.app h2, .app h1) {
		margin-bottom: 16px;
	}

	:global(button) {
		padding: 9.89px;
		border-radius: 9.89px;
		border: none;
		border: 1px solid #007bff;
		color: black;
		background: white;
		font-size: 16px;
		font-weight: 700;
		line-height: 1.2;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 9.89px;
	}

	:global(button:hover) {
		transform: translateY(-1px);
		box-shadow:
			0 10px 22px rgba(37, 99, 235, 0.18),
			0 2px 10px rgba(15, 23, 42, 0.18);
	}

	:global(.control) {
		display: flex;
		flex-direction: column;
		gap: 9.89px;
		margin-bottom: 16px;
	}

	:global(.control.inline) {
		flex-direction: row;
		align-items: center;
	}

	:global(.danger) {
		background: #dc3545;
		border-color: #dc3545;
		color: white;
	}

	:global(.danger:hover) {
		background: #c82333;
		border-color: #bd2130;
	}

	:global(ul) {
		list-style: none;
		padding: 0;
		margin: 0;
		background: #333;
		border-radius: 9.89px;
		border: 3px solid #007bff;
		color: white;
		padding: 9.89px;
		display: flex;
		gap: 9.89px;
		flex-wrap: wrap;
	}

	:global(ul button) {
		display: inline-flex;
	}

	:global(.bubble) {
		background: transparent;
		/*color: #66b3ff; /* lighter tint of your blue, readable on dark bg */
		color: #007bff; /* your blue color */
		padding: 9.89px 16px;
		border: 1.5px solid #007bff;
		border-radius: 16px;
		font-weight: 600;
		cursor: default;
	}

	:global(.card) {
		background: #1f1f2a;
		border: 3px solid rgba(96, 165, 250, 0.35);
		border-radius: 9.89px;
		box-shadow:
			0 8px 20px rgba(15, 23, 42, 0.22),
			0 2px 8px rgba(59, 130, 246, 0.08);
	}

	.footer {
		position: absolute;
		bottom: 0px;
		padding: 9.89px 16px;
		background: #1f1f2a;
		color: white;
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		width: 100%;
	}

	.footer a {
		color: #007bff;
		text-decoration: none;
	}
</style>
