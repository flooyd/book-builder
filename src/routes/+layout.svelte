<script lang="ts">
	import '$lib/styles/global.css';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import SiteHeader from '$lib/components/marketing/SiteHeader.svelte';
	import SiteFooter from '$lib/components/marketing/SiteFooter.svelte';
	import CreateModal from '$lib/components/ui/CreateModal.svelte';
	import AppHeader from '$lib/components/ui/AppHeader.svelte';
	import CommandDock from '$lib/components/ui/CommandDock.svelte';
	import { provideAppHeader } from '$lib/app-header.svelte';
	import { clearLibrary, loadLibrary } from '$lib/library';
	import { userStore, showMenuStore, modalStore, booksRefresh } from '$lib/stores';

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

	// Load (and reload on booksRefresh) the signed-in user's books, parts and chapters.
	$effect(() => {
		void $booksRefresh;
		if (userId) loadLibrary();
		else clearLibrary();
	});

	const handleKeyDown = (event: KeyboardEvent) => {
		if (!user) return;
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'm') {
			event.preventDefault(); // Stops the browser from minimizing / opening a new tab
			showMenuStore.update((value) => !value);
		}
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

<div class="app" class:padded={siteChrome}>
	{@render children()}
</div>

{#if user && $showMenuStore}
	<CommandDock />
{/if}

{#if user && $modalStore?.type === 'create'}
	<CreateModal />
{/if}

{#if siteChrome}
	<SiteFooter />
{/if}

<style>
	/* Leftover signed-out pages (e.g. /demo) that don't lay themselves out. */
	.padded {
		padding: 16px;
	}
</style>
