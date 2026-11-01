<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { useAppHeader } from '$lib/app-header.svelte';
	import { entryStores, booksStore, seriesStore } from '$lib/stores';
	import type { Appearance, Connection, EntryType } from '$lib/bible';
	import Missing from '$lib/components/story/Missing.svelte';
	import EntrySheet from './EntrySheet.svelte';

	// The page of one character, place or system. The entry comes from the library stores, which
	// load after the page does, so the sheet (which holds the fields being edited) waits for it.
	let {
		type,
		id,
		appearances,
		connections
	}: {
		type: EntryType;
		id: number;
		appearances: Appearance[];
		connections: Connection[];
	} = $props();

	// svelte-ignore state_referenced_locally
	const store = entryStores[type];
	const entry = $derived($store.find((e) => e.id === id));

	// The series or book it was opened from, or else the first book it belongs to.
	const fromSeries = $derived(Number(page.url.searchParams.get('series')));
	const series = $derived($seriesStore.find((item) => item.id === fromSeries));
	const fromBook = $derived(Number(page.url.searchParams.get('book')));
	const bookId = $derived(entry?.bookIds.includes(fromBook) ? fromBook : entry?.bookIds[0]);
	const book = $derived($booksStore.find((b) => b.id === bookId));

	// The story bible this page sits in, and the page above that.
	const parent = $derived(
		series
			? {
					label: series.title,
					href: resolve('/series/[id]', { id: String(series.id) }),
					bible: resolve('/series/[id]/bible', { id: String(series.id) })
				}
			: book
				? {
						label: book.title,
						href: resolve('/book/[id]', { id: String(book.id) }),
						bible: resolve('/book/[id]/bible', { id: String(book.id) })
					}
				: null
	);

	useAppHeader((header) => {
		header.crumbs = [
			{ label: 'Library', href: resolve('/') },
			...(parent
				? [
						{ label: parent.label, href: parent.href },
						{ label: 'Story bible', href: parent.bible }
					]
				: []),
			...(entry ? [{ label: entry.name }] : [])
		];
	});
</script>

<svelte:head>
	<title>{entry ? `${entry.name} · Book Builder` : 'Story bible · Book Builder'}</title>
</svelte:head>

{#if entry}
	<EntrySheet {type} {entry} {appearances} {connections} backHref={parent?.bible ?? resolve('/')} />
{:else}
	<Missing noun={type} />
{/if}
