<script lang="ts">
	import { tick } from 'svelte';
	import { flip } from 'svelte/animate';
	import { goto, invalidate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { plural, putJSON, sendJSON, setSeriesBooks } from '$lib/library';
	import { booksInSeries } from '$lib/series';
	import { coverFrom } from '$lib/art';
	import {
		artStore,
		booksRefresh,
		booksStore,
		libraryStatus,
		modalStore,
		seriesStore,
		userStore,
		type Book,
		type Series
	} from '$lib/stores';
	import BookCover from '$lib/components/ui/BookCover.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Pill from '$lib/components/ui/Pill.svelte';
	import RichEditor from '$lib/components/rich/RichEditor.svelte';
	import RichText from '$lib/components/rich/RichText.svelte';
	import { indexAt, startDrag } from '$lib/components/outline/drag';
	import Missing from '$lib/components/story/Missing.svelte';
	import SeriesCovers from './SeriesCovers.svelte';

	// One series: its books in reading order, the way to its story bible and how readers find it.
	let {
		id,
		handle,
		words
	}: {
		id: number;
		/** The writer's public page address, when it's on. */
		handle: string | null;
		/** How many words each book in the series has, by book id. */
		words: Record<number, number>;
	} = $props();

	const series = $derived($seriesStore.find((item) => item.id === id));
	const books = $derived(booksInSeries(id, $booksStore));
	const others = $derived($booksStore.filter((book) => book.seriesId !== id));

	const wordCount = (n: number) => `${n.toLocaleString('en')} ${n === 1 ? 'word' : 'words'}`;
	const totalWords = $derived(books.reduce((sum, book) => sum + (words[book.id] ?? 0), 0));

	const seriesTitle = (seriesId: number | null) =>
		$seriesStore.find((item) => item.id === seriesId)?.title;

	const publicHref = $derived(
		handle && books.some((book) => book.shareId)
			? resolve('/author/[handle]/series/[id]', { handle, id: String(id) })
			: null
	);

	// ---- Inline edit -------------------------------------------------------------------------
	let editing = $state(false);
	let draftTitle = $state('');
	let draftDescription = $state('');
	let descriptionEditor = $state<RichEditor>();
	let saving = $state(false);
	let editError = $state('');
	let titleInput = $state<HTMLInputElement>();

	async function startEdit(current: Series) {
		draftTitle = current.title;
		draftDescription = current.description;
		editError = '';
		editing = true;
		await tick();
		titleInput?.focus();
	}

	async function saveEdit(event: SubmitEvent) {
		event.preventDefault();
		descriptionEditor?.flush();
		if (!draftTitle.trim()) {
			editError = 'Give the series a title.';
			titleInput?.focus();
			return;
		}
		saving = true;
		editError = '';
		try {
			const updated = await putJSON<Series>(`/api/series/${id}`, {
				title: draftTitle,
				description: draftDescription
			});
			seriesStore.update((list) => list.map((item) => (item.id === id ? updated : item)));
			editing = false;
		} catch (error) {
			editError = error instanceof Error ? error.message : "Couldn't save the series.";
		} finally {
			saving = false;
		}
	}

	// ---- Delete ------------------------------------------------------------------------------
	let confirmingDelete = $state(false);
	let deleting = $state(false);
	let deleteError = $state('');

	async function deleteSeries() {
		deleting = true;
		deleteError = '';
		try {
			await sendJSON('DELETE', `/api/series/${id}`);
			await goto(resolve('/'));
			booksRefresh.update((n) => n + 1);
		} catch (error) {
			deleteError = error instanceof Error ? error.message : "Couldn't delete the series.";
			deleting = false;
		}
	}

	// ---- Reading order -------------------------------------------------------------------------
	const reduced =
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	let orderError = $state('');
	let chosen = $state('');
	let order = $state<HTMLElement>();
	let list = $state<HTMLElement>();
	// While a book is dragged, the list follows the pointer and saves only on the drop.
	let dragged = $state<number | null>(null);
	let dragOrder = $state<number[]>([]);

	const shown = $derived(
		dragged === null
			? books
			: dragOrder.flatMap((bookId) => books.find((book) => book.id === bookId) ?? [])
	);

	async function save(bookIds: number[]) {
		orderError = '';
		try {
			await setSeriesBooks(id, bookIds);
		} catch (error) {
			orderError = error instanceof Error ? error.message : "Couldn't save the reading order.";
		}
	}

	const ids = () => books.map((book) => book.id);

	function move(index: number, by: number) {
		const next = ids();
		const [book] = next.splice(index, 1);
		next.splice(index + by, 0, book);
		save(next);
	}

	const takeOut = (book: Book) => save(ids().filter((bookId) => bookId !== book.id));

	async function add() {
		if (!chosen) return;
		const next = [...ids(), Number(chosen)];
		chosen = '';
		await save(next);
		// The page only has word counts for the books it opened with.
		await invalidate('app:series-words');
	}

	function grab(event: PointerEvent, book: Book) {
		const row = (event.currentTarget as HTMLElement).closest('li');
		if (!row || !order || !list) return;
		const container = list;
		startDrag<{ index: number }>({
			event,
			item: row,
			layer: order,
			locate: (_x, y) => {
				const rows = [...container.children] as HTMLElement[];
				const others = rows.filter((other) => other !== row);
				return { index: indexAt(others, container, y, 'y') };
			},
			same: (a, b) => a.index === b.index,
			onstart: () => {
				dragOrder = ids();
				dragged = book.id;
			},
			onmove: ({ index }) => {
				const rest = dragOrder.filter((bookId) => bookId !== book.id);
				dragOrder = [...rest.slice(0, index), book.id, ...rest.slice(index)];
			},
			ondrop: () => {
				const next = dragOrder;
				const moved = next.some((bookId, index) => bookId !== books[index]?.id);
				dragged = null;
				if (moved) save(next);
			},
			oncancel: () => (dragged = null)
		});
	}
</script>

<svelte:head>
	<title>{series ? `${series.title} · Book Builder` : 'Series · Book Builder'}</title>
</svelte:head>

{#if series}
	<div class="band">
		<div class="band-inner">
			<SeriesCovers {books} author={$userStore?.name} size="lg" />

			<div class="band-text">
				<nav aria-label="Breadcrumb" class="crumbs">
					<a href={resolve('/')}>Library</a><span class="sep" aria-hidden="true">/</span><span
						aria-current="page">{series.title}</span
					>
				</nav>

				{#if editing}
					<form class="edit" onsubmit={saveEdit}>
						<label class="sr-only" for="series-title">Title</label>
						<input
							bind:this={titleInput}
							bind:value={draftTitle}
							id="series-title"
							class="edit-title"
							autocomplete="off"
							aria-invalid={editError ? 'true' : undefined}
							aria-describedby={editError ? 'series-edit-error' : undefined}
							onkeydown={(e) => e.key === 'Escape' && (editing = false)}
						/>
						<RichEditor
							bind:this={descriptionEditor}
							kind="description"
							class="edit-description"
							boxed
							italic
							value={draftDescription}
							onchange={(value) => (draftDescription = value)}
							label="Description"
							placeholder="What ties these books together?"
							onescape={() => (editing = false)}
						/>
						{#if editError}
							<p id="series-edit-error" class="error" role="alert">
								<Icon name="alert-circle" size={16} />{editError}
							</p>
						{/if}
						<div class="edit-actions">
							<Button type="submit" variant="primary" disabled={saving}>
								<Icon name="check" size={16} />{saving ? 'Saving…' : 'Save'}
							</Button>
							<Button variant="quiet" onclick={() => (editing = false)} disabled={saving}>
								Cancel
							</Button>
						</div>
					</form>
				{:else}
					<p class="overline">Series</p>
					<!-- Re-created when the title changes: the headline splits its text once. -->
					{#key series.title}
						<h1><motion-headline by="words" interval={0.07}>{series.title}</motion-headline></h1>
					{/key}
					{#if series.description}
						<p class="description"><RichText value={series.description} italic /></p>
					{/if}
				{/if}

				<div class="band-foot">
					<div class="chips">
						<Pill variant="count">{plural(books.length, 'book')}</Pill>
						<Pill variant="count">{wordCount(totalWords)}</Pill>
					</div>
					{#if !editing}
						<div class="actions">
							<Button onclick={() => startEdit(series)}><Icon name="pen" size={16} />Edit</Button>
							<Button variant="danger" onclick={() => (confirmingDelete = true)}>
								<Icon name="trash" size={16} />Delete
							</Button>
							<Button
								variant="primary"
								onclick={() => modalStore.set({ type: 'create', category: 'book', seriesId: id })}
							>
								<Icon name="plus" size={16} strokeWidth={2.2} />New book
							</Button>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<main class="contents-wrap">
		<section bind:this={order} aria-labelledby="h-order" class="order">
			<h2 id="h-order">Reading order</h2>

			{#if books.length > 0}
				<ol bind:this={list} class="list">
					{#each shown as book, index (book.id)}
						<li
							class={['row', { lifted: book.id === dragged }]}
							animate:flip={{ duration: reduced ? 0 : 180 }}
						>
							<!-- For the pointer: the arrows do the same from the keyboard. -->
							<button
								type="button"
								class="grip"
								tabindex={-1}
								aria-hidden="true"
								onpointerdown={(event) => grab(event, book)}
							>
								<Icon name="grip" size={18} />
							</button>
							<span class="number">{index + 1}</span>
							<a class="book" href={resolve('/book/[id]', { id: String(book.id) })}>
								<BookCover
									id={book.id}
									title={book.title}
									size="sm"
									art={coverFrom($artStore, book.coverArtId)}
								/>
								<span class="book-text">
									<span class="book-title">{book.title}</span>
									<span class="book-meta">
										{wordCount(words[book.id] ?? 0)} · {book.shareId ? 'Shared' : 'Private'}
									</span>
								</span>
							</a>
							<span class="tools">
								<button
									type="button"
									class="tool"
									aria-label="Move {book.title} earlier"
									disabled={index === 0}
									onclick={() => move(index, -1)}
								>
									<Icon name="arrow-up" size={17} />
								</button>
								<button
									type="button"
									class="tool"
									aria-label="Move {book.title} later"
									disabled={index === shown.length - 1}
									onclick={() => move(index, 1)}
								>
									<Icon name="arrow-down" size={17} />
								</button>
								<button
									type="button"
									class="tool"
									aria-label="Take {book.title} out of this series"
									onclick={() => takeOut(book)}
								>
									<Icon name="x" size={17} />
								</button>
							</span>
						</li>
					{/each}
				</ol>
			{:else}
				<p class="empty">
					No books in this series yet. Add one you already have, or start a new one.
				</p>
			{/if}

			{#if orderError}
				<p class="error" role="alert"><Icon name="alert-circle" size={16} />{orderError}</p>
			{/if}

			{#if others.length > 0}
				<div class="add">
					<label class="sr-only" for="series-add">Add a book to this series</label>
					<select bind:value={chosen} id="series-add" class="bb-field">
						<option value="" disabled>Add a book you already have</option>
						{#each others as book (book.id)}
							<option value={String(book.id)}>
								{book.title}{seriesTitle(book.seriesId)
									? ` (moves from ${seriesTitle(book.seriesId)})`
									: ''}
							</option>
						{/each}
					</select>
					<Button onclick={add} disabled={!chosen}>
						<Icon name="plus" size={16} strokeWidth={2.2} />Add
					</Button>
				</div>
			{/if}
		</section>

		<aside class="aside">
			<section aria-labelledby="h-bible" class="panel">
				<h2 id="h-bible">Story bible</h2>
				<p class="hint">
					Every character, place and system from these books in one place. The @ menu offers them in
					all of the books.
				</p>
				<a class="panel-link" href={resolve('/series/[id]/bible', { id: String(id) })}>
					<Icon name="book-marked" size={15} />Open the series bible
				</a>
			</section>

			<section aria-labelledby="h-readers" class="panel">
				<h2 id="h-readers">Readers</h2>
				{#if publicHref}
					<p class="hint">
						This series is on your author page, with the books you've shared. Private books stay out
						of it, and the others keep their numbers.
					</p>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- publicHref is resolve()d -->
					<a class="panel-link" href={publicHref} target="_blank" rel="noopener">
						<Icon name="globe" size={15} />See what readers see
					</a>
				{:else if handle}
					<p class="hint">Share a book in this series and the series shows on your author page.</p>
				{:else}
					<p class="hint">
						Turn on your author page and share a book, and readers can find this series there.
					</p>
					<a class="panel-link" href={resolve('/settings')}>
						<Icon name="user" size={15} />Open settings
					</a>
				{/if}
			</section>
		</aside>
	</main>

	{#if confirmingDelete}
		<Dialog labelledby="delete-title" width={460} onclose={() => (confirmingDelete = false)}>
			<div class="confirm">
				<h2 id="delete-title">Delete <em>{series.title}</em>?</h2>
				<p>The series goes, and its books stay on your shelf with everything in them.</p>
				{#if deleteError}
					<p class="error" role="alert"><Icon name="alert-circle" size={16} />{deleteError}</p>
				{/if}
				<div class="confirm-actions">
					<Button variant="quiet" onclick={() => (confirmingDelete = false)} disabled={deleting}>
						Cancel
					</Button>
					<Button variant="danger" onclick={deleteSeries} disabled={deleting}>
						<Icon name="trash" size={16} />{deleting ? 'Deleting…' : 'Delete series'}
					</Button>
				</div>
			</div>
		</Dialog>
	{/if}
{:else if $libraryStatus !== 'loading'}
	<Missing noun="series" />
{:else}
	<div class="band" aria-busy="true">
		<div class="band-inner"><div class="cover-skeleton"></div></div>
	</div>
{/if}

<style>
	/* Header band, as on a book's page */
	.band {
		position: relative;
		overflow: hidden;
		border-bottom: 1px solid var(--bb-line-faint);
		background: var(--bb-panel);
	}

	.band-inner {
		position: relative;
		max-width: 1280px;
		margin: 0 auto;
		padding: 40px 32px 44px;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 32px 56px;
	}

	.cover-skeleton {
		width: 196px;
		height: 264px;
		border-radius: 4px 12px 12px 4px;
		background: var(--bb-ink);
	}

	.band-text {
		flex: 1 1 520px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.crumbs {
		font-size: 14px;
		color: var(--bb-text-3);
		overflow-wrap: anywhere;
	}

	.crumbs a {
		color: var(--bb-text-2);
		text-decoration: none;
	}

	.crumbs a:hover {
		color: var(--bb-text);
	}

	.crumbs .sep {
		padding: 0 8px;
	}

	.crumbs [aria-current='page'] {
		color: var(--bb-text);
	}

	.overline {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--bb-sky);
	}

	h1 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(48px, 5.4vw, 78px);
		line-height: 0.98;
		letter-spacing: -0.015em;
		color: var(--bb-text-strong);
		overflow-wrap: break-word;
	}

	.description {
		max-width: 640px;
		font-family: var(--font-read);
		font-style: italic;
		font-size: 22px;
		line-height: 1.45;
		color: var(--bb-text-desc);
	}

	.band-foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin-top: 6px;
	}

	.chips,
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.actions {
		gap: 10px;
	}

	/* Inline edit */
	.edit {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.edit-title {
		width: 100%;
		padding: 6px 14px;
		border-radius: var(--r-control);
		border: 1px solid var(--bb-line-control);
		background: var(--bb-night);
		color: var(--bb-text-strong);
		font-family: var(--font-display);
		font-size: clamp(36px, 4.4vw, 60px);
		line-height: 1.1;
	}

	.edit :global(.edit-description) {
		max-width: 640px;
		font-family: var(--font-read);
		font-style: italic;
		font-size: 20px;
		line-height: 1.45;
		color: var(--bb-text-desc);
	}

	.edit-title:focus-visible {
		outline: none;
		border-color: var(--bb-sky);
		box-shadow: var(--focus-ring);
	}

	.edit-title[aria-invalid='true'] {
		border-color: var(--bb-coral);
	}

	.edit-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.error {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		color: var(--bb-coral-soft);
	}

	/* Reading order */
	.contents-wrap {
		max-width: 1280px;
		margin: 0 auto;
		padding: 44px 32px 64px;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 40px;
	}

	.order {
		flex: 999 1 600px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.order h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 34px;
		color: var(--bb-text-strong);
	}

	/* indexAt measures the rows from here, so it has to be their offset parent. */
	.list {
		position: relative;
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 10px 8px 4px;
		border-radius: var(--r-row);
		background: var(--bb-ink);
		border: 1px solid var(--bb-line-soft);
	}

	.row.lifted {
		opacity: 0.35;
	}

	:global(.drag-ghost).row {
		list-style: none;
		background: var(--bb-ink);
		border-color: var(--bb-line-control);
		box-shadow: 0 24px 48px -16px var(--bb-drop);
	}

	:global(.outline-dragging),
	:global(.outline-dragging *) {
		cursor: grabbing !important;
		-webkit-user-select: none;
		user-select: none;
	}

	.grip {
		flex: none;
		display: grid;
		place-items: center;
		width: 36px;
		height: 44px;
		padding: 0;
		border: none;
		background: none;
		color: var(--bb-text-4);
		cursor: grab;
		touch-action: none;
	}

	.grip:hover {
		color: var(--bb-text-2);
	}

	.number {
		flex: none;
		width: 26px;
		text-align: center;
		font-family: var(--font-display);
		font-size: 20px;
		color: var(--bb-sky);
	}

	.book {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 2px 6px;
		color: var(--bb-text);
		text-decoration: none;
	}

	.book:hover .book-title {
		color: var(--bb-sky-hover);
	}

	.book-text {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.book-title {
		font-family: var(--font-display);
		font-size: 21px;
		line-height: 1.15;
		overflow-wrap: anywhere;
	}

	.book-meta {
		font-size: 13px;
		color: var(--bb-text-3);
	}

	.tools {
		flex: none;
		display: flex;
	}

	.tool {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		padding: 0;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: var(--bb-text-3);
	}

	.tool:hover:not(:disabled) {
		background: var(--bb-raised);
		color: var(--bb-text);
	}

	.tool:disabled {
		opacity: 0.35;
	}

	.empty {
		font-size: 16px;
		color: var(--bb-text-3);
	}

	.add {
		display: flex;
		gap: 8px;
	}

	.add select {
		flex: 1;
		min-width: 0;
		min-height: 44px;
		padding: 0 14px;
	}

	/* Beside the list */
	.aside {
		flex: 1 1 320px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.panel {
		padding: 22px;
		border-radius: var(--r-card);
		background: var(--bb-ink);
		border: 1px solid var(--bb-line-soft);
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.panel h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 24px;
		color: var(--bb-text);
	}

	.hint {
		font-size: 13.5px;
		line-height: 1.45;
		color: var(--bb-text-3);
	}

	.panel-link {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		color: var(--bb-sky);
		font: 600 14.5px var(--font-ui);
		text-decoration: none;
	}

	.panel-link:hover {
		color: var(--bb-sky-hover);
	}

	/* Delete confirmation */
	.confirm {
		padding: 28px 30px 26px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.confirm h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 30px;
		line-height: 1.1;
		color: var(--bb-text-strong);
		overflow-wrap: break-word;
	}

	.confirm em {
		font-family: var(--font-read);
		font-style: italic;
	}

	.confirm p {
		font-size: 15.5px;
		line-height: 1.5;
		color: var(--bb-text-2);
	}

	.confirm .error {
		color: var(--bb-coral-soft);
	}

	.confirm-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 10px;
		margin-top: 14px;
		padding-top: 20px;
		border-top: 1px solid var(--bb-line-soft);
	}

	@media (max-width: 600px) {
		.band-inner {
			padding: 24px 16px 28px;
			gap: 24px;
		}

		.contents-wrap {
			padding-left: 16px;
			padding-right: 16px;
		}

		h1 {
			font-size: 44px;
		}

		/* The title needs the width, so the arrows drop to a line of their own. */
		.row {
			flex-wrap: wrap;
		}

		.book {
			flex-basis: calc(100% - 80px);
		}

		.tools {
			width: 100%;
			justify-content: flex-end;
		}
	}
</style>
