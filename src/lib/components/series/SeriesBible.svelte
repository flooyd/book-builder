<script lang="ts">
	import { resolve } from '$app/paths';
	import { useAppHeader } from '$lib/app-header.svelte';
	import type { EntryType } from '$lib/bible';
	import { booksInSeries } from '$lib/series';
	import {
		booksStore,
		charactersStore,
		libraryStatus,
		modalStore,
		placesStore,
		seriesStore,
		systemsStore,
		type Entry
	} from '$lib/stores';
	import Button from '$lib/components/ui/Button.svelte';
	import Kbd from '$lib/components/ui/Kbd.svelte';
	import BibleShelf from '$lib/components/bible/BibleShelf.svelte';
	import Missing from '$lib/components/story/Missing.svelte';

	// The story bible of a whole series: every entry in any of its books. Nothing is stored for it,
	// so an entry joins by being added to one of the books, and a book brings its entries with it.
	let { id, counts }: { id: number; counts: Record<string, number> } = $props();

	const series = $derived($seriesStore.find((item) => item.id === id));
	const books = $derived(booksInSeries(id, $booksStore));
	const seriesHref = $derived(resolve('/series/[id]', { id: String(id) }));

	useAppHeader((header) => {
		header.wide = true;
		header.crumbs = [
			{ label: 'Library', href: resolve('/') },
			...(series ? [{ label: series.title, href: seriesHref }] : []),
			{ label: 'Story bible' }
		];
	});

	const inSeries = (entry: Entry) => books.some((book) => entry.bookIds.includes(book.id));

	const entries = $derived<Record<EntryType, Entry[]>>({
		character: $charactersStore.filter(inSeries),
		place: $placesStore.filter(inSeries),
		system: $systemsStore.filter(inSeries)
	});

	/** Which of the books an entry is in, by their numbers. */
	function note(entry: Entry) {
		const places = books.flatMap((book, index) =>
			entry.bookIds.includes(book.id) ? [index + 1] : []
		);
		if (books.length > 1 && places.length === books.length) return 'In every book';
		return places.map((place) => `Book ${place}`).join(' · ');
	}

	const entryHref = (type: EntryType, entry: Entry) =>
		`${resolve('/bible/[type]/[id]', { type, id: String(entry.id) })}?series=${id}`;

	// A new entry starts in every book of the series; its page can take it out of any of them.
	const create = (category: EntryType) =>
		modalStore.set({
			type: 'create',
			category,
			seriesId: id,
			bookIds: books.map((book) => book.id)
		});
</script>

<svelte:head>
	<title>
		{series ? `Story bible · ${series.title} · Book Builder` : 'Story bible · Book Builder'}
	</title>
</svelte:head>

{#if series && books.length > 0}
	<BibleShelf overline={series.title} {entries} {counts} href={entryHref} {note} {create}>
		{#snippet intro()}
			Everyone and everything in this series, whichever book they're from. Type
			<Kbd key="@" size="xs" /> in any of its books to link them to the text.
		{/snippet}
	</BibleShelf>
{:else if series}
	<main class="empty">
		<h1>This series has no books yet.</h1>
		<p>Its story bible fills up from the books in it, so add one first.</p>
		<Button variant="primary" href={seriesHref}>Back to the series</Button>
	</main>
{:else if $libraryStatus !== 'loading'}
	<Missing noun="series" />
{/if}

<style>
	.empty {
		max-width: 1160px;
		margin: 0 auto;
		padding: 80px 32px;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 16px;
	}

	h1 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(36px, 4vw, 52px);
		line-height: 1.05;
		color: var(--bb-text-strong);
	}

	p {
		color: var(--bb-text-2);
	}

	@media (max-width: 600px) {
		.empty {
			padding: 48px 16px;
		}
	}
</style>
