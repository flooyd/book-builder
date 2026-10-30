<script lang="ts">
	import '$lib/styles/global.css';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';
	import favicon from '$lib/assets/favicon.svg';
	import Nav from '$lib/components/Nav.svelte';
	import Menu from '$lib/components/Menu.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import AppHeader from '$lib/components/ui/AppHeader.svelte';
	import { provideAppHeader } from '$lib/app-header.svelte';
	import { userStore, showMenuStore, modalStore, booksRefresh, booksStore } from '$lib/stores';
	import type { Book } from '$lib/stores';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	provideAppHeader();

	// Branch on layout data (available during SSR) rather than userStore, which is only set
	// once effects run in the browser.
	const user = $derived(data.user);
	const userId = $derived(data.user?.id);

	$effect(() => {
		userStore.set(user ?? null);
	});

	$effect(() => {
		void $booksRefresh;
		if (!userId) {
			booksStore.set([]);
			return;
		}
		getBooks().then((books) => booksStore.set(books));
	});

	const handleKeyDown = (event: KeyboardEvent) => {
		if (!user) return;
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'm') {
			event.preventDefault(); // Stops the browser from minimizing / opening a new tab
			showMenuStore.update((value) => !value);
		}
	};

	const getBooks = async () => {
		const response = await fetch('/api/books');
		if (!response.ok) return [];
		return (await response.json()) as Book[];
	};

	console.log('Hello, world! Welcome to Book Builder.');
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<svelte:window onkeydown={handleKeyDown} />

{#if user}
	<AppHeader {user} />
{:else}
	<Nav />
{/if}

<div class="app">
	{@render children()}
	{#if user && $showMenuStore}
		<Menu />
	{/if}
	{#if $modalStore?.type === 'create'}
		<Modal title={$modalStore.title} category={$modalStore.category} type={$modalStore.type} />
	{/if}
</div>

<style>
	.app {
		padding: 16px;
	}
</style>
