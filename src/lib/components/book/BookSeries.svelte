<script lang="ts">
	import { resolve } from '$app/paths';
	import { setSeriesBooks } from '$lib/library';
	import { booksInSeries, placeInSeries } from '$lib/series';
	import { booksStore, modalStore, seriesStore } from '$lib/stores';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	// The series on a book's aside: where the book comes in it and what's either side, or the way
	// into one. Taking a book out loses nothing, so it asks no questions.
	let { bookId }: { bookId: number } = $props();

	const book = $derived($booksStore.find((b) => b.id === bookId));
	const place = $derived(book ? placeInSeries(book, $booksStore, $seriesStore) : null);

	let chosen = $state('');
	let error = $state('');

	const inOrder = (seriesId: number) => booksInSeries(seriesId, $booksStore).map((b) => b.id);

	async function save(seriesId: number, bookIds: number[]) {
		error = '';
		try {
			await setSeriesBooks(seriesId, bookIds);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : "Couldn't change the series.";
		}
	}

	function join() {
		if (!chosen) return;
		const seriesId = Number(chosen);
		chosen = '';
		save(seriesId, [...inOrder(seriesId), bookId]);
	}

	const leave = (seriesId: number) =>
		save(
			seriesId,
			inOrder(seriesId).filter((id) => id !== bookId)
		);

	const bookHref = (id: number) => resolve('/book/[id]', { id: String(id) });
</script>

{#if book}
	<section aria-labelledby="h-series" class="panel">
		<div class="panel-head">
			<h2 id="h-series">Series</h2>
			{#if place}<span class="count">Book {place.number} of {place.total}</span>{/if}
		</div>

		{#if place}
			<a class="series-title" href={resolve('/series/[id]', { id: String(place.series.id) })}>
				{place.series.title}
			</a>
			{#if place.previous}
				<a class="neighbour" href={bookHref(place.previous.id)}>
					<Icon name="arrow-left" size={15} />
					<span><span class="sr-only">Previous book: </span>{place.previous.title}</span>
				</a>
			{/if}
			{#if place.next}
				<a class="neighbour" href={bookHref(place.next.id)}>
					<Icon name="arrow-right" size={15} />
					<span><span class="sr-only">Next book: </span>{place.next.title}</span>
				</a>
			{/if}
			<button type="button" class="panel-link" onclick={() => leave(place.series.id)}>
				<Icon name="x" size={15} />Take out of this series
			</button>
		{:else}
			<p class="hint">
				A series gives this book a reading order and a story bible it shares with the books around
				it.
			</p>
			{#if $seriesStore.length > 0}
				<div class="join">
					<label class="sr-only" for="book-series">Series</label>
					<select bind:value={chosen} id="book-series" class="bb-field">
						<option value="" disabled>Choose a series</option>
						{#each $seriesStore as item (item.id)}
							<option value={String(item.id)}>{item.title}</option>
						{/each}
					</select>
					<Button onclick={join} disabled={!chosen}>Add</Button>
				</div>
			{/if}
			<button
				type="button"
				class="panel-link"
				onclick={() => modalStore.set({ type: 'create', category: 'series', bookId })}
			>
				<Icon name="plus" size={15} strokeWidth={2.2} />New series
			</button>
		{/if}

		{#if error}
			<p class="error" role="alert"><Icon name="alert-circle" size={15} />{error}</p>
		{/if}
	</section>
{/if}

<style>
	.panel {
		padding: 22px;
		border-radius: var(--r-card);
		background: var(--bb-ink);
		border: 1px solid var(--bb-line-soft);
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.panel-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 24px;
		color: var(--bb-text);
	}

	.count {
		font-size: 13px;
		color: var(--bb-text-3);
	}

	.series-title {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		margin: -10px 0 -6px;
		color: inherit;
		font-family: var(--font-display);
		font-size: 19px;
		line-height: 1.2;
		text-decoration: none;
		overflow-wrap: anywhere;
	}

	.series-title:hover,
	.neighbour:hover {
		color: var(--bb-sky);
	}

	.neighbour {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		margin: -8px 0;
		color: var(--bb-text-2);
		font-size: 14.5px;
		text-decoration: none;
		overflow-wrap: anywhere;
	}

	.neighbour :global(svg) {
		flex: none;
		color: var(--bb-text-3);
	}

	.hint {
		font-size: 13.5px;
		line-height: 1.45;
		color: var(--bb-text-3);
	}

	.join {
		display: flex;
		gap: 8px;
	}

	.join select {
		flex: 1;
		min-width: 0;
		min-height: 44px;
		padding: 0 12px;
		font-size: 14.5px;
	}

	.panel-link {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		padding: 0;
		border: none;
		background: none;
		color: var(--bb-sky);
		font: 600 14.5px var(--font-ui);
	}

	.panel-link:hover {
		color: var(--bb-sky-hover);
	}

	.error {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		color: var(--bb-coral-soft);
	}
</style>
