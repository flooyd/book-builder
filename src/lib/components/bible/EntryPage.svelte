<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { useAppHeader } from '$lib/app-header.svelte';
	import { entryStores, booksStore } from '$lib/stores';
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

	// The book it was opened from, or else the first it belongs to.
	const fromBook = $derived(Number(page.url.searchParams.get('book')));
	const bookId = $derived(entry?.bookIds.includes(fromBook) ? fromBook : entry?.bookIds[0]);
	const book = $derived($booksStore.find((b) => b.id === bookId));

	useAppHeader((header) => {
		header.crumbs = [
			{ label: 'Library', href: resolve('/') },
			...(book
				? [
						{ label: book.title, href: resolve('/book/[id]', { id: String(book.id) }) },
						{
							label: 'Story bible',
							href: resolve('/book/[id]/bible', { id: String(book.id) })
						}
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
	<EntrySheet {type} {entry} {appearances} {connections} backBookId={bookId} />
{:else}
	<Missing noun={type} />
{/if}
