<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		booksRefresh,
		booksStore,
		chaptersStore,
		libraryStatus,
		modalStore,
		partsStore,
		userStore,
		type Part
	} from '$lib/stores';
	import { bookOutline, latestChapterId, plural } from '$lib/library';
	import { useAppHeader } from '$lib/app-header.svelte';
	import { StoryTextDoc } from '$lib/story-text.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Pill from '$lib/components/ui/Pill.svelte';
	import TocChapterRow from '$lib/components/book/TocChapterRow.svelte';

	let { id }: { id: number } = $props();

	const part = $derived($partsStore.find((p) => p.id === id));
	const book = $derived(part && $booksStore.find((b) => b.id === part.bookId));
	const outline = $derived(book ? bookOutline(book.id, $partsStore, $chaptersStore) : []);
	const entry = $derived(outline.find((e) => e.part.id === id));
	const latestId = $derived(latestChapterId(outline));
	const isOwner = $derived(!!part && $userStore?.id === part.userId);
	const holdsText = $derived(!!part && !part.hasChapters);

	const partHref = (p: Part) => resolve('/part/[id]', { id: String(p.id) });

	// ---- Header: breadcrumb, plus save state and Save for story-text parts -------------------
	useAppHeader((header) => {
		header.wide = true;
		header.crumbs = [
			{ label: 'Library', href: resolve('/') },
			...(book
				? [{ label: book.title, href: resolve('/book/[id]', { id: String(book.id) }) }]
				: []),
			...(part ? [{ label: part.title }] : [])
		];
		header.actions = holdsText ? saveActions : null;
	});

	// ---- Story text --------------------------------------------------------------------------
	// One document per mounted page: the route re-mounts this component when `id` changes.
	// svelte-ignore state_referenced_locally
	const doc = new StoryTextDoc(id);

	$effect(() => {
		if (holdsText) doc.load();
	});

	function onkeydown(event: KeyboardEvent) {
		if (holdsText && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
			event.preventDefault();
			doc.save();
		}
	}

	// Warn before leaving with unsaved text. 'leave' (reload, close, external link) shows the
	// browser's own beforeunload prompt when cancelled.
	beforeNavigate(({ type, cancel }) => {
		if (!doc.dirty) return;
		if (type === 'leave') cancel();
		else if (!confirm('You have unsaved changes to this story text. Leave without saving?'))
			cancel();
	});

	// Night / Paper writing surface, remembered per browser.
	let paper = $state(false);

	onMount(() => {
		try {
			paper = localStorage.getItem('bb-surface') === 'paper';
		} catch {
			// storage unavailable: keep the default
		}
	});

	function setSurface(next: boolean) {
		paper = next;
		try {
			localStorage.setItem('bb-surface', next ? 'paper' : 'night');
		} catch {
			// storage unavailable: the choice lasts for this visit
		}
	}

	// ---- Edit details ------------------------------------------------------------------------
	let editing = $state(false);
	let draftTitle = $state('');
	let draftDescription = $state('');
	let savingDetails = $state(false);
	let editError = $state('');
	let titleInput = $state<HTMLInputElement>();

	async function startEdit(current: Part) {
		draftTitle = current.title;
		draftDescription = current.description;
		editError = '';
		editing = true;
		await tick();
		titleInput?.focus();
	}

	async function saveDetails(event: SubmitEvent) {
		event.preventDefault();
		if (!draftTitle.trim()) {
			editError = 'Give the part a title.';
			titleInput?.focus();
			return;
		}
		savingDetails = true;
		editError = '';
		try {
			const response = await fetch(`/api/part/${id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: draftTitle, description: draftDescription })
			});
			if (!response.ok) {
				const body = await response.json().catch(() => null);
				throw new Error(body?.error ?? `Request failed (${response.status}).`);
			}
			const updated: Part = await response.json();
			partsStore.update((parts) => parts.map((p) => (p.id === updated.id ? updated : p)));
			editing = false;
		} catch (error) {
			editError = error instanceof Error ? error.message : "Couldn't save the part.";
		} finally {
			savingDetails = false;
		}
	}

	const newPart = () => modalStore.set({ type: 'create', category: 'part', bookId: part?.bookId });
	const newChapter = () =>
		modalStore.set({ type: 'create', category: 'chapter', bookId: part?.bookId, partId: id });
</script>

<svelte:window {onkeydown} />

<svelte:head>
	<title
		>{part && book ? `${part.title} · ${book.title} · Book Builder` : 'Part · Book Builder'}</title
	>
</svelte:head>

{#snippet saveActions()}
	<span class="save-state" role="status">
		{#if doc.status === 'saving'}
			<span class="muted">Saving…</span>
		{:else if doc.status === 'error'}
			<span class="failed"><Icon name="alert-circle" size={15} />Couldn't save</span>
		{:else if doc.dirty}
			<span class="unsaved"><span class="dot" aria-hidden="true"></span>Unsaved changes</span>
		{:else if doc.status === 'saved'}
			<span class="ok"><Icon name="check-circle" size={15} />Saved</span>
		{/if}
	</span>
	<Button
		variant="primary"
		onclick={() => doc.save()}
		disabled={!doc.dirty || doc.status === 'saving'}
		aria-keyshortcuts="Control+S Meta+S"
	>
		<Icon name="save" size={16} />Save
	</Button>
{/snippet}

{#if part && book && entry}
	<div class="frame">
		<nav aria-label="In this book" class="rail">
			<span class="rail-label">In this book</span>
			{#each outline as item (item.part.id)}
				{#if item.part.id === id}
					<a class="rail-item current" href={partHref(item.part)} aria-current="page">
						<span class="dot" aria-hidden="true"></span><span class="rail-name"
							>{item.part.title}</span
						>
					</a>
				{:else}
					<a class="rail-item" href={partHref(item.part)}>
						<span class="rail-name">{item.part.title}</span>
						{#if item.label}
							<span class="rail-count" aria-label={plural(item.chapters.length, 'chapter')}
								>{item.chapters.length}</span
							>
						{/if}
					</a>
				{/if}
			{/each}
			<button type="button" class="rail-new" onclick={newPart}>
				<Icon name="plus" size={14} strokeWidth={2.4} />New part
			</button>
		</nav>

		<main class="main">
			<div class="title-block">
				<span class="overline"
					>{entry.label ?? 'Part'} ·
					<a href={resolve('/book/[id]', { id: String(book.id) })}>{book.title}</a></span
				>

				{#if editing}
					<form class="edit" onsubmit={saveDetails}>
						<label class="sr-only" for="part-title">Title</label>
						<input
							bind:this={titleInput}
							bind:value={draftTitle}
							id="part-title"
							class="edit-title"
							autocomplete="off"
							aria-invalid={editError ? 'true' : undefined}
							aria-describedby={editError ? 'part-edit-error' : undefined}
							onkeydown={(e) => e.key === 'Escape' && (editing = false)}
						/>
						<label class="sr-only" for="part-description">Description</label>
						<textarea
							bind:value={draftDescription}
							id="part-description"
							class="edit-description"
							rows="2"
							placeholder="A line about this part"
							onkeydown={(e) => e.key === 'Escape' && (editing = false)}></textarea>
						{#if editError}
							<p id="part-edit-error" class="error" role="alert">
								<Icon name="alert-circle" size={16} />{editError}
							</p>
						{/if}
						<div class="edit-actions">
							<Button type="submit" variant="primary" disabled={savingDetails}>
								<Icon name="check" size={16} />{savingDetails ? 'Saving…' : 'Save details'}
							</Button>
							<Button variant="quiet" onclick={() => (editing = false)} disabled={savingDetails}>
								Cancel
							</Button>
						</div>
					</form>
				{:else}
					<div class="title-row">
						<h1>{part.title}</h1>
						{#if isOwner}
							<Button onclick={() => startEdit(part)}>
								<Icon name="pen" size={15} />Edit details
							</Button>
						{/if}
					</div>
					{#if part.description}
						<p class="description">{part.description}</p>
					{/if}
				{/if}

				{#if holdsText}
					<span class="holds-text">
						<Pill icon="info">No chapters — this part holds its own story text</Pill>
					</span>
				{/if}
			</div>

			{#if holdsText}
				<div class="surface" class:paper>
					<div class="surface-head">
						<label for="story">Story text</label>
						<div class="surface-tools">
							<span class="words">{plural(doc.words, 'word')}</span>
							<div class="toggle" role="group" aria-label="Writing surface">
								<button type="button" aria-pressed={!paper} onclick={() => setSurface(false)}
									>Night</button
								>
								<button type="button" aria-pressed={paper} onclick={() => setSurface(true)}
									>Paper</button
								>
							</div>
						</div>
					</div>
					{#if doc.status === 'load-error'}
						<div class="load-error" role="alert">
							<p>{doc.error}</p>
							<Button onclick={() => doc.load()}>Try again</Button>
						</div>
					{:else}
						<textarea
							id="story"
							class="story"
							bind:value={doc.content}
							readonly={doc.status === 'loading'}
							aria-busy={doc.status === 'loading'}
							placeholder={doc.status === 'loading' ? 'Loading…' : 'Write your story here…'}
						></textarea>
					{/if}
				</div>
				{#if doc.status === 'error'}
					<p class="save-error" role="alert">
						<Icon name="alert-circle" size={16} />{doc.error} Your text is still here; try saving again.
					</p>
				{/if}
			{:else}
				<section aria-labelledby="h-chapters" class="chapters">
					<h2 id="h-chapters">Chapters</h2>
					{#each entry.chapters as { chapter, number } (chapter.id)}
						<TocChapterRow
							href={partHref(part)}
							{number}
							title={chapter.title}
							updatedAt={chapter.updatedAt}
							latest={chapter.id === latestId}
							compact
						/>
					{:else}
						<p class="empty">No chapters yet.</p>
					{/each}
					<button type="button" class="add" onclick={newChapter}>
						<Icon name="plus" size={16} strokeWidth={2.2} />Add a chapter
					</button>
				</section>
			{/if}
		</main>
	</div>
{:else if $libraryStatus === 'ready'}
	<main class="missing">
		<h1>This part isn't on your shelf.</h1>
		<p>It may have been deleted, or the link is wrong.</p>
		<Button variant="primary" href={resolve('/')}>Back to your library</Button>
	</main>
{:else if $libraryStatus === 'error'}
	<main class="missing" role="alert">
		<h1>We couldn't load this part.</h1>
		<Button onclick={() => booksRefresh.update((n) => n + 1)}>Try again</Button>
	</main>
{/if}

<style>
	/* Header actions (rendered inside AppHeader) */
	.save-state {
		display: inline-flex;
		align-items: center;
		font-size: 13.5px;
	}

	.save-state:empty {
		display: none;
	}

	.save-state > span {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

	.muted {
		color: var(--bb-text-3);
	}

	.unsaved {
		color: var(--bb-amber);
	}

	.unsaved .dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--bb-amber);
	}

	.ok {
		color: var(--bb-sky-text);
	}

	.failed {
		color: var(--bb-coral-soft);
	}

	/* Layout */
	.frame {
		max-width: 1360px;
		margin: 0 auto;
		padding: 0 32px;
		display: flex;
		flex-wrap: wrap;
		gap: 24px 48px;
	}

	/* Rail */
	.rail {
		flex: 1 1 220px;
		max-width: 260px;
		min-width: 0;
		padding-top: 48px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.rail-label {
		padding: 0 12px 10px;
		font-size: 11.5px;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--bb-text-4);
	}

	.rail-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		min-height: 44px;
		padding: 0 12px;
		border-radius: 10px;
		color: var(--bb-text-2);
		text-decoration: none;
		font-size: 15px;
		font-weight: 500;
	}

	.rail-item:hover {
		background: #121a40;
		color: var(--bb-text);
	}

	.rail-item.current {
		justify-content: flex-start;
		background: var(--bb-raised);
		color: #fff;
		font-weight: 600;
	}

	.rail-item .dot {
		flex: none;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--bb-sky);
	}

	.rail-name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.rail-count {
		flex: none;
		font-size: 12.5px;
		color: var(--bb-text-4);
	}

	.rail-new {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		padding: 0 12px;
		margin-top: 6px;
		border-radius: 10px;
		border: 1.5px dashed var(--bb-line);
		background: transparent;
		color: var(--bb-text-3);
		font: 600 14px var(--font-ui);
	}

	.rail-new:hover {
		border-color: var(--bb-sky);
		color: var(--bb-text);
	}

	/* Main */
	.main {
		flex: 999 1 640px;
		min-width: 0;
		padding: 48px 0 64px;
	}

	.title-block {
		max-width: 760px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.overline {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--bb-sky);
		overflow-wrap: anywhere;
	}

	.overline a {
		color: inherit;
		text-decoration: none;
	}

	.overline a:hover {
		color: var(--bb-sky-hover);
		text-decoration: underline;
	}

	.title-row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 16px;
	}

	h1 {
		min-width: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(48px, 5vw, 76px);
		line-height: 0.98;
		letter-spacing: -0.015em;
		color: var(--bb-text-strong);
		overflow-wrap: break-word;
	}

	.description {
		font-family: var(--font-read);
		font-style: italic;
		font-size: 22px;
		color: #b9c3e4;
	}

	.holds-text {
		margin-top: 6px;
		align-self: flex-start;
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
		font-size: clamp(36px, 4vw, 56px);
		line-height: 1.1;
	}

	.edit-description {
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

	.error,
	.save-error {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		color: var(--bb-coral-soft);
	}

	.save-error {
		max-width: 820px;
		margin: 12px auto 0;
	}

	/* Writing surface: Night (ink) or Paper */
	.surface {
		--surface-bg: var(--bb-ink);
		--surface-line: var(--bb-line-soft);
		--surface-text: #d9e0f5;
		--surface-muted: var(--bb-text-3);
		--surface-caret: var(--bb-sky);
		max-width: 820px;
		margin: 36px auto 0;
		padding: 48px 56px 40px;
		border-radius: 22px;
		background: var(--surface-bg);
		border: 1px solid var(--surface-line);
		box-shadow: 0 40px 80px -50px rgba(0, 0, 0, 0.95);
		transition: background-color 0.2s;
	}

	.surface.paper {
		--surface-bg: var(--bb-paper);
		--surface-line: var(--bb-paper-line);
		--surface-text: var(--bb-paper-ink);
		--surface-muted: var(--bb-paper-muted);
		/* Sky is too faint on paper; royal keeps the caret visible. */
		--surface-caret: var(--bb-royal);
	}

	.surface-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 26px;
		padding-bottom: 16px;
		border-bottom: 1px solid var(--surface-line);
	}

	.surface-head label {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--surface-muted);
	}

	.surface-tools {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.words {
		font-size: 13px;
		color: var(--surface-muted);
	}

	.toggle {
		display: inline-flex;
		padding: 3px;
		border-radius: 10px;
		border: 1px solid var(--surface-line);
	}

	.toggle button {
		min-height: 32px;
		padding: 0 10px;
		border: none;
		border-radius: 7px;
		background: transparent;
		color: var(--surface-muted);
		font: 600 12.5px var(--font-ui);
	}

	.toggle button[aria-pressed='true'] {
		background: var(--bb-royal);
		color: #fff;
	}

	.story {
		display: block;
		width: 100%;
		height: 560px;
		padding: 0;
		border: none;
		resize: vertical;
		background: transparent;
		color: var(--surface-text);
		caret-color: var(--surface-caret);
		font-family: var(--font-read);
		font-size: 20px;
		line-height: 1.8;
	}

	.story:focus-visible {
		outline: none;
		box-shadow: none;
	}

	.story::placeholder {
		color: var(--surface-muted);
	}

	.load-error {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
		color: var(--bb-coral-soft);
	}

	/* Chapter parts */
	.chapters {
		max-width: 760px;
		margin: 36px auto 0;
	}

	.chapters h2 {
		margin: 0 0 14px;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 28px;
		color: var(--bb-text-strong);
	}

	.empty {
		color: var(--bb-text-3);
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

	/* Not found / error */
	.missing {
		max-width: 1280px;
		margin: 0 auto;
		padding: 80px 32px;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 16px;
	}

	.missing h1 {
		font-size: clamp(36px, 4vw, 52px);
	}

	.missing p {
		color: var(--bb-text-2);
	}

	/* Narrow: the rail stacks above the content. */
	@media (max-width: 760px) {
		.frame {
			padding: 0 16px;
			gap: 0;
		}

		.rail {
			max-width: none;
			flex-basis: 100%;
			padding-top: 24px;
		}

		.main {
			padding-top: 28px;
		}

		h1 {
			font-size: 42px;
		}

		.surface {
			padding: 24px 20px 20px;
			border-radius: 18px;
		}

		.story {
			height: 420px;
			font-size: 18px;
		}

		.missing {
			padding: 48px 16px;
		}
	}
</style>
