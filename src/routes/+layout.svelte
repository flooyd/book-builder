<script lang="ts">
	import '$lib/styles/global.css';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import SiteHeader from '$lib/components/marketing/SiteHeader.svelte';
	import SiteFooter from '$lib/components/marketing/SiteFooter.svelte';
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

	// Signed-out pages that draw their own header and footer.
	const ownsChrome = $derived(page.url.pathname === '/' || page.url.pathname === '/login');
	const siteChrome = $derived(!user && !ownsChrome);

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
{:else if siteChrome}
	<SiteHeader />
{/if}

<div class="app" class:legacy={!!user || siteChrome}>
	{@render children()}
	{#if user && $showMenuStore}
		<Menu />
	{/if}
	{#if $modalStore?.type === 'create'}
		<Modal title={$modalStore.title} category={$modalStore.category} type={$modalStore.type} />
	{/if}
</div>

{#if siteChrome}
	<SiteFooter />
{/if}

<style>
	/* Padding for screens not yet rebuilt; removed as each phase lands. */
	.legacy {
		padding: 16px;
	}
</style>
