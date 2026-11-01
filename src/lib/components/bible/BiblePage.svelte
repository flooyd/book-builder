<script lang="ts">
	import { resolve } from '$app/paths';
	import type { EntryType } from '$lib/bible';
	import { useAppHeader } from '$lib/app-header.svelte';
	import {
		booksStore,
		charactersStore,
		modalStore,
		placesStore,
		seriesStore,
		systemsStore,
		type Entry
	} from '$lib/stores';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Kbd from '$lib/components/ui/Kbd.svelte';
	import Missing from '$lib/components/story/Missing.svelte';
	import BibleShelf from './BibleShelf.svelte';

	// A book's story bible: every character, place and system in it, each opening its own page.
	let { id, counts }: { id: number; counts: Record<string, number> } = $props();

	const book = $derived($booksStore.find((b) => b.id === id));
	const series = $derived($seriesStore.find((item) => item.id === book?.seriesId));

	const bookHref = $derived(resolve('/book/[id]', { id: String(id) }));

	useAppHeader((header) => {
		header.wide = true;
		header.crumbs = [
			{ label: 'Library', href: resolve('/') },
			...(book ? [{ label: book.title, href: bookHref }] : []),
			{ label: 'Story bible' }
		];
	});

	const entries = $derived<Record<EntryType, Entry[]>>({
		character: $charactersStore.filter((entry) => entry.bookIds.includes(id)),
		place: $placesStore.filter((entry) => entry.bookIds.includes(id)),
		system: $systemsStore.filter((entry) => entry.bookIds.includes(id))
	});

	const bookTitle = (bookId: number) => $booksStore.find((b) => b.id === bookId)?.title;

	/** "Also in X, Y" for an entry shared with other books. */
	function alsoIn(entry: Entry) {
		const others = entry.bookIds
			.filter((bookId) => bookId !== id)
			.map(bookTitle)
			.filter(Boolean);
		return others.length > 0 ? `Also in ${others.join(', ')}` : null;
	}

	const entryHref = (type: EntryType, entry: Entry) =>
		`${resolve('/bible/[type]/[id]', { type, id: String(entry.id) })}?book=${id}`;

	const create = (category: EntryType) => modalStore.set({ type: 'create', category, bookId: id });
</script>

<svelte:head>
	<title>{book ? `Story bible · ${book.title} · Book Builder` : 'Story bible · Book Builder'}</title
	>
</svelte:head>

{#if book}
	<BibleShelf overline={book.title} {entries} {counts} href={entryHref} note={alsoIn} {create}>
		{#snippet intro()}
			Everyone and everything in this book. Type <Kbd key="@" size="xs" /> while you write to link them
			to the text.
		{/snippet}
		{#snippet links()}
			{#if series}
				<Button href={resolve('/series/[id]/bible', { id: String(series.id) })}>
					<Icon name="library" size={16} />Series bible
				</Button>
			{/if}
		{/snippet}
	</BibleShelf>
{:else}
	<Missing noun="book" />
{/if}
