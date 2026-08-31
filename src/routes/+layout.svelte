<script lang="ts">
	import type { PageData } from './$types';
	import type { Snippet } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import Nav from '$lib/components/Nav.svelte';
	import { userStore, showMenuStore, modalStore } from '$lib/stores';
	import Menu from '$lib/components/Menu.svelte';
	import Modal from '$lib/components/Modal.svelte';

	let { data, children }: { data: PageData; children: Snippet } = $props();

	$effect(() => {
		console.log('hi', data);
		userStore.set(data?.user ?? null);
	});

	const handleKeyDown = (event: KeyboardEvent) => {
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'm') {
			console.log('hello world');
			event.preventDefault(); // Stops the browser from opening a new tab
			showMenuStore.update((value) => !value); // Toggle the menu visibility
		}
	};
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<Nav />

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
		padding: 6.11px;
		border-radius: 6.11px;
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
	}

	:global(button:hover) {
		background: #007bff;
		color: white;
	}

	:global(.control) {
		display: flex;
		flex-direction: column;
		gap: 6.11px;
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
		border-radius: 6.11px;
		border: 3px solid #007bff;
		color: white;
		padding: 16px;
		display: flex;
		gap: 9.89px;
		flex-wrap: wrap;
		margin-bottom: 16px;
	}

	:global(ul button) {
		display: block;
	}

	:global(ul button:last-child) {
		margin-bottom: 0;
	}

	:global(.bubble) {
		background: #007bff;
		color: white;
		padding: 3.78px 6.11px;
		border-radius: 6.11px;
		font-size: 9.89px;
		margin-left: 6.11px;
	}
</style>
