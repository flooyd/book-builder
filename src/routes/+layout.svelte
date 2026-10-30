<script lang="ts">
	import '$lib/styles/global.css';
	// Hides content that motion-components will animate in until its elements are defined.
	import 'motion-components/preload.css';
	import { onMount, type Snippet } from 'svelte';
	import type { LayoutData } from './$types';
	import { onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import SiteHeader from '$lib/components/marketing/SiteHeader.svelte';
	import SiteFooter from '$lib/components/marketing/SiteFooter.svelte';
	import CreateModal from '$lib/components/ui/CreateModal.svelte';
	import AppHeader from '$lib/components/ui/AppHeader.svelte';
	import CommandDock from '$lib/components/ui/CommandDock.svelte';
	import { provideAppHeader } from '$lib/app-header.svelte';
	import { THEME_COLOR, provideTheme } from '$lib/theme.svelte';
	import { clearLibrary, loadLibrary } from '$lib/library';
	import { userStore, showMenuStore, modalStore, booksRefresh } from '$lib/stores';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	provideAppHeader();
	// The cookie's choice as of this page load; after that the theme state is the source of truth.
	// svelte-ignore state_referenced_locally
	const theme = provideTheme(data.theme);

	// Branch on layout data (available during SSR) rather than userStore, which is only set
	// once effects run in the browser.
	const user = $derived(data.user);
	const userId = $derived(data.user?.id);

	// Reading mode (the owner's and the public link) draws its own bar, signed in or not.
	const reading = $derived(
		page.route.id === '/book/[id]/read' || page.route.id === '/read/[shareId]'
	);
	// Signed-out pages that draw their own header and footer.
	const ownsChrome = $derived(
		reading || page.url.pathname === '/' || page.url.pathname === '/login'
	);
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

	// Define the motion elements once hydration is done (see $lib/motion).
	onMount(() => {
		import('$lib/motion');
	});

	onMount(() => theme.watchSystem());

	// Crossfade between pages with the View Transitions API where the browser supports it. Same-page
	// navigations (in-page anchors) and reduced-motion users get no transition.
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		if (navigation.from?.url.pathname === navigation.to?.url.pathname) return;
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

	const handleKeyDown = (event: KeyboardEvent) => {
		if (!user || reading) return;
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'm') {
			event.preventDefault(); // Stops the browser from minimizing / opening a new tab
			showMenuStore.update((value) => !value);
		}
	};

	console.log('Hello, world! Welcome to Book Builder.');
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	{#if theme.chosen}
		<meta name="theme-color" content={THEME_COLOR[theme.chosen]} />
	{:else}
		<meta name="theme-color" media="(prefers-color-scheme: light)" content={THEME_COLOR.light} />
		<meta name="theme-color" media="(prefers-color-scheme: dark)" content={THEME_COLOR.dark} />
	{/if}
</svelte:head>

<svelte:window onkeydown={handleKeyDown} />

{#if user && !reading}
	<AppHeader {user} />
{:else if siteChrome}
	<SiteHeader />
{/if}

<div class="app" class:padded={siteChrome}>
	{@render children()}
</div>

{#if user && $showMenuStore && !reading}
	<CommandDock />
{/if}

{#if user && ($modalStore?.type === 'create' || $modalStore?.type === 'edit')}
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
