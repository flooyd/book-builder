<script lang="ts">
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		booksRefresh,
		booksStore,
		chaptersStore,
		libraryStatus,
		modalStore,
		partsStore,
		userStore,
		type Book,
		type Chapter,
		type Part
	} from '$lib/stores';
	import { bookOutline, latestChapterId, plural, relativeDay } from '$lib/library';
	import BookCover from '$lib/components/ui/BookCover.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Pill from '$lib/components/ui/Pill.svelte';
	import Missing from '$lib/components/story/Missing.svelte';
	import TocChapterRow from './TocChapterRow.svelte';
	import BookAside from './BookAside.svelte';

	let { id }: { id: number } = $props();

	const book = $derived($booksStore.find((b) => b.id === id));
	const outline = $derived(book ? bookOutline(book.id, $partsStore, $chaptersStore) : []);
	const chapterCount = $derived(outline.reduce((sum, entry) => sum + entry.chapters.length, 0));
	const latestId = $derived(latestChapterId(outline));
	const isOwner = $derived(!!book && $userStore?.id === book.userId);
	// "Add a chapter" goes into the newest part that holds chapters.
	const chapterTarget = $derived(outline.findLast((entry) => entry.label)?.part);

	const partHref = (part: Part) => resolve('/part/[id]', { id: String(part.id) });
	const chapterHref = (chapter: Chapter) => resolve('/chapter/[id]', { id: String(chapter.id) });

	// ---- Inline edit -------------------------------------------------------------------------
	let editing = $state(false);
	let draftTitle = $state('');
	let draftDescription = $state('');
	let saving = $state(false);
	let editError = $state('');
	let titleInput = $state<HTMLInputElement>();

	async function startEdit(current: Book) {
		draftTitle = current.title;
		draftDescription = current.description;
		editError = '';
		editing = true;
		await tick();
		titleInput?.focus();
	}

	async function saveEdit(event: SubmitEvent) {
		event.preventDefault();
		if (!draftTitle.trim()) {
			editError = 'Give the book a title.';
			titleInput?.focus();
			return;
		}
		saving = true;
		editError = '';
		try {
			const response = await fetch(`/api/book/${id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: draftTitle, description: draftDescription })
			});
			if (!response.ok) throw new Error(await errorText(response));
			const updated: Book = await response.json();
			booksStore.update((books) => books.map((b) => (b.id === updated.id ? updated : b)));
			editing = false;
		} catch (error) {
			editError = error instanceof Error ? error.message : "Couldn't save the book.";
		} finally {
			saving = false;
		}
	}

	// ---- Delete ------------------------------------------------------------------------------
	let confirmingDelete = $state(false);
	let deleting = $state(false);
	let deleteError = $state('');

	async function deleteBook() {
		deleting = true;
		deleteError = '';
		try {
			const response = await fetch(`/api/book/${id}`, { method: 'DELETE' });
			if (!response.ok) throw new Error(await errorText(response));
			await goto(resolve('/'));
			booksRefresh.update((n) => n + 1);
		} catch (error) {
			deleteError = error instanceof Error ? error.message : "Couldn't delete the book.";
			deleting = false;
		}
	}

	async function errorText(response: Response) {
		const body = await response.json().catch(() => null);
		return body?.error ?? body?.message ?? `Request failed (${response.status}).`;
	}

	const newPart = () => modalStore.set({ type: 'create', category: 'part', bookId: id });
	const newChapter = (partId: number) =>
		modalStore.set({ type: 'create', category: 'chapter', bookId: id, partId });
</script>

<svelte:head>
	<title>{book ? `${book.title} · Book Builder` : 'Book · Book Builder'}</title>
</svelte:head>

{#if book}
	<div class="band">
		<div class="band-inner">
			<BookCover id={book.id} title={book.title} author={$userStore?.name} size="lg" />

			<div class="band-text">
				<nav aria-label="Breadcrumb" class="crumbs">
					<a href={resolve('/')}>Library</a><span class="sep" aria-hidden="true">/</span><span
						aria-current="page">{book.title}</span
					>
				</nav>

				{#if editing}
					<form class="edit" onsubmit={saveEdit}>
						<label class="sr-only" for="book-title">Title</label>
						<input
							bind:this={titleInput}
							bind:value={draftTitle}
							id="book-title"
							class="edit-title"
							autocomplete="off"
							aria-invalid={editError ? 'true' : undefined}
							aria-describedby={editError ? 'book-edit-error' : undefined}
							onkeydown={(e) => e.key === 'Escape' && (editing = false)}
						/>
						<label class="sr-only" for="book-description">Description</label>
						<textarea
							bind:value={draftDescription}
							id="book-description"
							class="edit-description"
							rows="2"
							placeholder="What is this book about?"
							onkeydown={(e) => e.key === 'Escape' && (editing = false)}></textarea>
						{#if editError}
							<p id="book-edit-error" class="error" role="alert">
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
					<h1>{book.title}</h1>
					{#if book.description}
						<p class="description">{book.description}</p>
					{/if}
				{/if}

				<div class="band-foot">
					<div class="chips">
						<Pill variant="count">{plural(outline.length, 'part')}</Pill>
						<Pill variant="count">{plural(chapterCount, 'chapter')}</Pill>
						<span class="updated">Updated {relativeDay(book.updatedAt)}</span>
					</div>
					{#if !editing}
						<div class="actions">
							{#if isOwner}
								<Button onclick={() => startEdit(book)}><Icon name="pen" size={16} />Edit</Button>
								<Button variant="danger" onclick={() => (confirmingDelete = true)}>
									<Icon name="trash" size={16} />Delete
								</Button>
							{/if}
							<Button variant="primary" onclick={newPart}>
								<Icon name="plus" size={16} strokeWidth={2.2} />New part
							</Button>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<main class="contents-wrap">
		<section aria-labelledby="h-contents" class="contents">
			<h2 id="h-contents">Contents</h2>

			{#each outline as entry, i (entry.part.id)}
				{#if i > 0}<div class="divider" aria-hidden="true"></div>{/if}

				{#if !entry.label}
					<a class="toc-story" href={partHref(entry.part)}>
						<span class="overline">{entry.part.title}</span>
						{#if entry.part.description}
							<span class="story-desc">{entry.part.description}</span>
						{/if}
						<span class="leader" aria-hidden="true"></span>
						<Pill size="sm">Story text</Pill>
					</a>
				{:else}
					<div class="part-head">
						<span class="overline">{entry.label}</span>
						<a class="part-title" href={partHref(entry.part)}>{entry.part.title}</a>
					</div>
					{#each entry.chapters as { chapter, number } (chapter.id)}
						<TocChapterRow
							href={chapterHref(chapter)}
							{number}
							title={chapter.title}
							updatedAt={chapter.updatedAt}
							latest={chapter.id === latestId}
						/>
					{:else}
						<p class="no-chapters">No chapters yet.</p>
					{/each}
				{/if}
			{:else}
				<p class="empty">
					This book has no parts yet. Parts hold chapters, or a single run of story text.
				</p>
			{/each}

			{#if chapterTarget}
				<button type="button" class="add" onclick={() => newChapter(chapterTarget.id)}>
					<Icon name="plus" size={16} strokeWidth={2.2} />Add a chapter
				</button>
			{:else}
				<button type="button" class="add" onclick={newPart}>
					<Icon name="plus" size={16} strokeWidth={2.2} />Add a part
				</button>
			{/if}
		</section>

		<BookAside bookId={book.id} />
	</main>

	{#if confirmingDelete}
		<Dialog labelledby="delete-title" width={460} onclose={() => (confirmingDelete = false)}>
			<div class="confirm">
				<h2 id="delete-title">Delete <em>{book.title}</em>?</h2>
				<p>This removes its parts, chapters and story text.</p>
				{#if deleteError}
					<p class="error" role="alert"><Icon name="alert-circle" size={16} />{deleteError}</p>
				{/if}
				<div class="confirm-actions">
					<Button variant="quiet" onclick={() => (confirmingDelete = false)} disabled={deleting}>
						Cancel
					</Button>
					<Button variant="danger" onclick={deleteBook} disabled={deleting}>
						<Icon name="trash" size={16} />{deleting ? 'Deleting…' : 'Delete book'}
					</Button>
				</div>
			</div>
		</Dialog>
	{/if}
{:else if $libraryStatus !== 'loading'}
	<Missing noun="book" />
{:else}
	<div class="band" aria-busy="true">
		<div class="band-inner"><div class="cover-skeleton"></div></div>
	</div>
{/if}

<style>
	/* Header band */
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
		gap: 32px 44px;
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
		color: #b9c3e4;
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

	.updated {
		padding: 6px 12px;
		font-size: 13.5px;
		color: var(--bb-text-3);
	}

	/* Inline edit */
	.edit {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.edit-title,
	.edit-description {
		width: 100%;
		border-radius: var(--r-control);
		border: 1px solid var(--bb-line-control);
		background: var(--bb-night);
		color: var(--bb-text-strong);
	}

	.edit-title {
		padding: 6px 14px;
		font-family: var(--font-display);
		font-size: clamp(36px, 4.4vw, 60px);
		line-height: 1.1;
	}

	.edit-description {
		max-width: 640px;
		padding: 10px 14px;
		font-family: var(--font-read);
		font-style: italic;
		font-size: 20px;
		line-height: 1.45;
		color: #b9c3e4;
		resize: vertical;
	}

	.edit-title:focus-visible,
	.edit-description:focus-visible {
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

	/* Contents */
	.contents-wrap {
		max-width: 1280px;
		margin: 0 auto;
		padding: 44px 32px 64px;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 40px;
	}

	.contents {
		flex: 999 1 600px;
		min-width: 0;
	}

	.contents h2 {
		margin: 0 0 22px;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 34px;
		color: var(--bb-text-strong);
	}

	.overline {
		flex: none;
		min-width: 92px;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--bb-sky);
	}

	.toc-story {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 16px 18px;
		margin: 0 -18px;
		border-radius: var(--r-row);
		text-decoration: none;
		color: var(--bb-text);
	}

	.toc-story:hover {
		background: #131b42;
		color: var(--bb-text);
	}

	.toc-story .overline {
		max-width: 40%;
	}

	.story-desc {
		min-width: 0;
		font-family: var(--font-read);
		font-style: italic;
		font-size: 19px;
		color: #b9c3e4;
	}

	.leader {
		flex: 1 1 24px;
		min-width: 24px;
		border-bottom: 1.5px dotted var(--bb-line);
		transform: translateY(5px);
	}

	.toc-story:hover .leader {
		border-color: var(--bb-line-dashed);
	}

	.toc-story :global(.pill) {
		flex: none;
	}

	.divider {
		height: 1px;
		margin: 12px 0;
		background: var(--bb-line-faint);
	}

	.part-head {
		display: flex;
		align-items: baseline;
		gap: 16px;
		padding: 14px 0 8px;
	}

	.part-title {
		min-width: 0;
		font-family: var(--font-display);
		font-size: 24px;
		color: var(--bb-text-strong);
		text-decoration: none;
		overflow-wrap: break-word;
	}

	.part-title:hover {
		color: var(--bb-sky-hover);
	}

	.no-chapters,
	.empty {
		padding: 8px 0 8px 108px;
		font-size: 15px;
		color: var(--bb-text-3);
	}

	.empty {
		padding: 0;
		font-size: 16px;
	}

	.add {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		width: 100%;
		min-height: 52px;
		margin-top: 22px;
		border-radius: var(--r-row);
		border: 1.5px dashed var(--bb-line-control);
		background: transparent;
		color: var(--bb-text-2);
		font: 600 15px var(--font-ui);
	}

	.add:hover {
		border-color: var(--bb-sky);
		color: var(--bb-text);
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

		.toc-story {
			flex-wrap: wrap;
			gap: 6px 12px;
			padding: 14px 12px;
			margin: 0 -12px;
		}

		.toc-story .overline {
			min-width: 0;
			max-width: none;
		}

		.toc-story .leader {
			display: none;
		}

		.story-desc {
			flex-basis: 100%;
			order: 3;
		}

		.part-head {
			flex-direction: column;
			gap: 4px;
		}

		.no-chapters {
			padding-left: 36px;
		}
	}
</style>
