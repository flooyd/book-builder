<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		booksRefresh,
		booksStore,
		chaptersStore,
		charactersStore,
		modalStore,
		partsStore,
		systemsStore,
		type Book,
		type Chapter,
		type Character,
		type ModalCategory,
		type Part,
		type System
	} from '$lib/stores';
	import { bookOutline, putJSON } from '$lib/library';
	import Dialog from './Dialog.svelte';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';
	import Kbd from './Kbd.svelte';

	// Copy from the mockup: heading, sub, name label, name placeholder, description placeholder, CTA.
	const COPY: Record<ModalCategory, [string, string, string, string, string, string]> = {
		book: [
			'New book',
			'Give it a title — you can shape everything else later.',
			'Title',
			'e.g. The War of Nine',
			'What is this book about?',
			'Create book'
		],
		part: [
			'New part',
			'Parts hold chapters, or a single run of story text.',
			'Title',
			'e.g. Part Three — The Ninth Gate',
			'A line about this part',
			'Create part'
		],
		chapter: [
			'New chapter',
			'Chapters live inside a part.',
			'Title',
			'e.g. The Drowned Archive',
			'What happens here?',
			'Create chapter'
		],
		character: [
			'New character',
			'Characters can appear in more than one book.',
			'Name',
			'e.g. Maren Toll',
			'Who are they, and what do they want?',
			'Create character'
		],
		system: [
			'New system',
			'Magic, law, trade — the rules your world runs on.',
			'Name',
			'e.g. Tidecraft',
			'The rules, costs and limits',
			'Create system'
		]
	};

	const TABS: { id: ModalCategory; label: string }[] = [
		{ id: 'book', label: 'Book' },
		{ id: 'part', label: 'Part' },
		{ id: 'chapter', label: 'Chapter' },
		{ id: 'character', label: 'Character' },
		{ id: 'system', label: 'System' }
	];

	// Suggestions for a system's kind (free text; shown as its overline on the book page).
	const KINDS = ['Magic', 'Law', 'Trade', 'Politics', 'Religion', 'Technology', 'Nature'];

	const EDIT_SYSTEM_COPY: (typeof COPY)[ModalCategory] = [
		'Edit system',
		'Change its details, or the books it applies to.',
		'Name',
		'e.g. Tidecraft',
		'The rules, costs and limits',
		'Save system'
	];

	// Snapshot of what opened the dialog; the layout re-mounts this component per open.
	const opened = get(modalStore);
	const books = get(booksStore);
	const onlyBookId = books.length === 1 ? String(books[0].id) : '';
	// Editing an existing system (type 'edit') reuses the System form without the tabs.
	const editing =
		opened?.type === 'edit' && opened.category === 'system'
			? get(systemsStore).find((s) => s.id === opened.systemId)
			: undefined;

	let category = $state<ModalCategory>(editing ? 'system' : (opened?.category ?? 'book'));
	const [heading, sub, nameLabel, namePlaceholder, descPlaceholder, cta] = $derived(
		editing ? EDIT_SYSTEM_COPY : COPY[category]
	);

	// Parts that can take a chapter, labelled "{part} · {book}" as in the mockup.
	const chapterParts = $derived(
		$booksStore.flatMap((book) =>
			bookOutline(book.id, $partsStore, $chaptersStore)
				.filter((entry) => entry.label)
				.map((entry) => ({
					part: entry.part,
					bookId: book.id,
					label: `${entry.label} — ${entry.part.title} · ${book.title}`
				}))
		)
	);

	function defaultPartId() {
		if (opened?.partId) return String(opened.partId);
		const inBook = opened?.bookId
			? chapterParts.filter((option) => option.bookId === opened.bookId)
			: chapterParts;
		if (inBook.length === 1 || (opened?.bookId && inBook.length > 0)) {
			return String(inBook[inBook.length - 1].part.id);
		}
		return '';
	}

	let title = $state(editing?.name ?? '');
	let description = $state(editing?.description ?? '');
	let holds = $state<'chapters' | 'text'>('chapters');
	let bookId = $state(opened?.bookId ? String(opened.bookId) : onlyBookId);
	let partId = $state(defaultPartId());
	let kind = $state(editing?.kind ?? '');
	// Books chosen for a character ("Appears in") or a system ("Used in").
	let selectedBooks = $state<string[]>(
		editing
			? editing.bookIds.map(String)
			: opened?.bookId
				? [String(opened.bookId)]
				: onlyBookId
					? [onlyBookId]
					: []
	);

	/** The book to show a new character or system on: the one it was created from, else the first. */
	function bookToShow() {
		const from = String(opened?.bookId ?? '');
		return selectedBooks.includes(from) ? from : selectedBooks[0];
	}

	let errors = $state<{
		title?: string;
		book?: string;
		part?: string;
		books?: string;
		form?: string;
	}>({});
	let submitting = $state(false);
	let titleInput = $state<HTMLInputElement>();

	onMount(() => titleInput?.focus());

	const close = () => modalStore.set(null);

	function pick(next: ModalCategory) {
		category = next;
		errors = {};
	}

	function validate() {
		const next: typeof errors = {};
		if (!title.trim()) next.title = `Add a ${nameLabel.toLowerCase()}.`;
		if (category === 'part' && !bookId) next.book = 'Choose a book.';
		if (category === 'chapter' && !partId) next.part = 'Choose a part.';
		if ((category === 'character' || category === 'system') && selectedBooks.length === 0) {
			next.books = 'Choose at least one book.';
		}
		errors = next;
		return Object.keys(next).length === 0;
	}

	async function post<T>(url: string, body: unknown): Promise<T> {
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		const data = await response.json().catch(() => null);
		if (!response.ok) throw new Error(data?.error ?? data?.message ?? 'Something went wrong.');
		// The create endpoints return the inserted rows.
		return (Array.isArray(data) ? data[0] : data) as T;
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (submitting || !validate()) {
			if (errors.title) titleInput?.focus();
			return;
		}
		submitting = true;
		try {
			const fields = { title: title.trim(), description: description.trim() };
			// Open the new item's page (or, for characters and systems, its book) once the dialog
			// has closed.
			let navigate: (() => Promise<void>) | null = null;

			if (category === 'book') {
				const book = await post<Book>('/api/books', fields);
				booksStore.update((list) => [...list, book]);
				navigate = () => goto(resolve('/book/[id]', { id: String(book.id) }));
			} else if (category === 'part') {
				const part = await post<Part>('/api/parts', {
					...fields,
					bookId: Number(bookId),
					hasChapters: holds === 'chapters' ? 1 : 0
				});
				partsStore.update((list) => [...list, part]);
				navigate = () => goto(resolve('/part/[id]', { id: String(part.id) }));
			} else if (category === 'chapter') {
				const chapter = await post<Chapter>('/api/chapters', { ...fields, partId: Number(partId) });
				chaptersStore.update((list) => [...list, chapter]);
			} else if (category === 'character') {
				const character = await post<Character>('/api/characters', {
					name: fields.title,
					description: fields.description,
					bookIds: selectedBooks.map(Number)
				});
				charactersStore.update((list) => [...list, character]);
				const target = bookToShow();
				navigate = () => goto(resolve('/book/[id]', { id: target }));
			} else if (category === 'system') {
				const payload = {
					name: fields.title,
					description: fields.description,
					kind: kind.trim(),
					bookIds: selectedBooks.map(Number)
				};
				if (editing) {
					const system = await putJSON<System>(`/api/systems/${editing.id}`, payload);
					systemsStore.update((list) => list.map((s) => (s.id === system.id ? system : s)));
				} else {
					const system = await post<System>('/api/systems', payload);
					systemsStore.update((list) => [...list, system]);
					const target = bookToShow();
					navigate = () => goto(resolve('/book/[id]', { id: target }));
				}
			}

			booksRefresh.update((n) => n + 1);
			close();
			await navigate?.();
		} catch (error) {
			errors = { form: error instanceof Error ? error.message : 'Something went wrong.' };
			submitting = false;
		}
	}
</script>

<Dialog labelledby="create-title" onclose={close}>
	<div class="top">
		{#if !editing}
			<div class="tabs" role="group" aria-label="What to create">
				{#each TABS as tab (tab.id)}
					<button
						type="button"
						class="tab"
						aria-pressed={category === tab.id}
						onclick={() => pick(tab.id)}>{tab.label}</button
					>
				{/each}
			</div>
		{/if}
		<button type="button" class="close" aria-label="Close" onclick={close}>
			<Icon name="x" size={20} />
		</button>
	</div>

	<div class="intro">
		<h2 id="create-title">{heading}</h2>
		<p>{sub}</p>
	</div>

	<form onsubmit={submit} novalidate>
		<div class="field">
			<label for="create-name">{nameLabel}</label>
			<input
				bind:this={titleInput}
				bind:value={title}
				id="create-name"
				class="bb-field name"
				type="text"
				autocomplete="off"
				placeholder={namePlaceholder}
				aria-invalid={errors.title ? 'true' : undefined}
				aria-describedby={errors.title ? 'create-name-error' : undefined}
			/>
			{#if errors.title}
				<span id="create-name-error" class="error"
					><Icon name="alert-circle" size={15} />{errors.title}</span
				>
			{/if}
		</div>

		<div class="field">
			<label for="create-description">Description <span class="hint">Optional</span></label>
			<textarea
				bind:value={description}
				id="create-description"
				class="bb-field description"
				rows="3"
				placeholder={descPlaceholder}></textarea>
		</div>

		{#if category === 'part'}
			<fieldset class="holds">
				<legend>What will this part hold?</legend>
				<div class="options">
					<label class="opt">
						<input type="radio" name="holds" value="chapters" bind:group={holds} />
						<span class="opt-card">
							<span class="opt-title">Chapters<span class="opt-dot" aria-hidden="true"></span></span
							>
							<span class="opt-sub">Split this part into chapters.</span>
						</span>
					</label>
					<label class="opt">
						<input type="radio" name="holds" value="text" bind:group={holds} />
						<span class="opt-card">
							<span class="opt-title"
								>Story text<span class="opt-dot" aria-hidden="true"></span></span
							>
							<span class="opt-sub">One continuous text, like a prologue.</span>
						</span>
					</label>
				</div>
			</fieldset>
		{/if}

		{#if category === 'part'}
			<div class="field">
				<label for="create-book">Book</label>
				{#if $booksStore.length > 0}
					<select
						bind:value={bookId}
						id="create-book"
						class="bb-field"
						aria-invalid={errors.book ? 'true' : undefined}
						aria-describedby={errors.book ? 'create-book-error' : undefined}
					>
						<option value="" disabled>Choose a book</option>
						{#each $booksStore as book (book.id)}
							<option value={String(book.id)}>{book.title}</option>
						{/each}
					</select>
				{:else}
					<p class="notice">
						You don't have a book yet. <button
							type="button"
							class="link"
							onclick={() => pick('book')}>Create one first.</button
						>
					</p>
				{/if}
				{#if errors.book}
					<span id="create-book-error" class="error"
						><Icon name="alert-circle" size={15} />{errors.book}</span
					>
				{/if}
			</div>
		{/if}

		{#if category === 'system'}
			<div class="field">
				<label for="create-kind">Kind <span class="hint">Optional</span></label>
				<input
					bind:value={kind}
					id="create-kind"
					class="bb-field"
					type="text"
					autocomplete="off"
					list="create-kind-options"
					placeholder="e.g. Magic, Law, Trade"
				/>
				<datalist id="create-kind-options">
					{#each KINDS as option (option)}
						<option value={option}></option>
					{/each}
				</datalist>
			</div>
		{/if}

		{#if category === 'chapter'}
			<div class="field">
				<label for="create-part">Part</label>
				{#if chapterParts.length > 0}
					<select
						bind:value={partId}
						id="create-part"
						class="bb-field"
						aria-invalid={errors.part ? 'true' : undefined}
						aria-describedby={errors.part ? 'create-part-error' : undefined}
					>
						<option value="" disabled>Choose a part</option>
						{#each chapterParts as option (option.part.id)}
							<option value={String(option.part.id)}>{option.label}</option>
						{/each}
					</select>
				{:else}
					<p class="notice">
						Chapters live inside a part that holds chapters. <button
							type="button"
							class="link"
							onclick={() => pick('part')}>Create a part first.</button
						>
					</p>
				{/if}
				{#if errors.part}
					<span id="create-part-error" class="error"
						><Icon name="alert-circle" size={15} />{errors.part}</span
					>
				{/if}
			</div>
		{/if}

		{#if category === 'character' || category === 'system'}
			<fieldset class="appears" aria-describedby={errors.books ? 'create-books-error' : undefined}>
				<legend>{category === 'character' ? 'Appears in' : 'Used in'}</legend>
				<div class="checks">
					{#each $booksStore as book (book.id)}
						<label class="check">
							<input
								type="checkbox"
								value={String(book.id)}
								bind:group={selectedBooks}
							/>{book.title}
						</label>
					{:else}
						<p class="notice">
							You don't have a book yet. <button
								type="button"
								class="link"
								onclick={() => pick('book')}>Create one first.</button
							>
						</p>
					{/each}
				</div>
				{#if errors.books}
					<span id="create-books-error" class="error books-error"
						><Icon name="alert-circle" size={15} />{errors.books}</span
					>
				{/if}
			</fieldset>
		{/if}

		{#if errors.form}
			<p class="error form-error" role="alert">
				<Icon name="alert-circle" size={16} />{errors.form}
			</p>
		{/if}

		<div class="footer">
			<span class="esc"><Kbd key="Esc" size="xs" /> to close</span>
			<div class="footer-actions">
				<Button variant="quiet" size="lg" onclick={close}>Cancel</Button>
				<Button type="submit" variant="primary" size="lg" disabled={submitting}>
					{submitting ? 'Creating…' : cta}
				</Button>
			</div>
		</div>
	</form>
</Dialog>

<style>
	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 14px 14px 0 22px;
	}

	.tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
		padding: 4px;
		border-radius: 12px;
		background: var(--bb-night);
		border: 1px solid var(--bb-line-soft);
	}

	.tab {
		position: relative;
		min-height: 36px;
		padding: 0 12px;
		border: none;
		border-radius: 9px;
		background: transparent;
		color: var(--bb-text-2);
		font: 600 13.5px var(--font-ui);
	}

	/* 36px to the eye (as designed), 44px to the finger. */
	.tab::before {
		content: '';
		position: absolute;
		inset: -4px 0;
	}

	.tab:hover {
		color: #fff;
	}

	.tab[aria-pressed='true'] {
		background: var(--bb-royal);
		color: #fff;
	}

	.close {
		flex: none;
		margin-left: auto;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: none;
		border-radius: 12px;
		background: transparent;
		color: var(--bb-text-2);
	}

	.close:hover {
		background: var(--bb-raised);
		color: #fff;
	}

	.intro {
		padding: 22px 30px 8px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 40px;
		line-height: 1.05;
		color: var(--bb-text-strong);
	}

	.intro p {
		font-size: 15.5px;
		line-height: 1.5;
		color: var(--bb-text-2);
	}

	form {
		padding: 18px 30px 26px;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	label,
	legend {
		font-size: 14px;
		font-weight: 600;
		color: var(--bb-text-label);
	}

	.field > label {
		display: flex;
		justify-content: space-between;
	}

	.hint {
		font-weight: 500;
		color: var(--bb-text-4);
	}

	.bb-field {
		background: var(--bb-night);
	}

	.name {
		font-family: var(--font-display);
		font-size: 20px;
	}

	.description {
		font-family: var(--font-read);
		font-style: italic;
		font-size: 17px;
		line-height: 1.5;
	}

	select.bb-field {
		padding: 0 14px;
	}

	.error {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		color: var(--bb-coral-soft);
	}

	.notice {
		font-size: 14.5px;
		color: var(--bb-text-2);
	}

	.link {
		padding: 0;
		border: none;
		background: none;
		color: var(--bb-sky);
		font: inherit;
		text-decoration: underline;
	}

	.link:hover {
		color: var(--bb-sky-hover);
	}

	/* Part: what it holds */
	fieldset {
		margin: 0;
		padding: 0;
		border: none;
		min-width: 0;
	}

	legend {
		padding: 0 0 8px;
	}

	.appears legend {
		padding-bottom: 10px;
	}

	.options {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}

	.opt {
		position: relative;
		cursor: pointer;
	}

	.opt input {
		position: absolute;
		opacity: 0;
		width: 1px;
		height: 1px;
	}

	.opt-card {
		display: flex;
		flex-direction: column;
		gap: 6px;
		height: 100%;
		padding: 14px 16px;
		border-radius: var(--r-row);
		border: 1.5px solid var(--bb-line-control);
		background: var(--bb-night);
	}

	.opt input:checked + .opt-card {
		border-color: var(--bb-sky);
		background: var(--bb-sky-wash);
	}

	.opt input:focus-visible + .opt-card {
		box-shadow: 0 0 0 3px rgba(124, 180, 255, 0.35);
	}

	.opt-title {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-weight: 700;
		font-size: 15px;
		color: var(--bb-text);
	}

	.opt-dot {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		border: 1.5px solid var(--bb-line-dashed);
	}

	.opt input:checked + .opt-card .opt-dot {
		border: 5px solid var(--bb-sky);
	}

	.opt-sub {
		font-size: 13.5px;
		font-weight: 400;
		line-height: 1.45;
		color: var(--bb-text-2);
	}

	/* Character: books */
	.checks {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.check {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		padding: 0 14px;
		border-radius: var(--r-control);
		border: 1px solid var(--bb-line-control);
		background: var(--bb-night);
		font-size: 15px;
		font-weight: 400;
		color: var(--bb-text);
		cursor: pointer;
	}

	.check input {
		width: 18px;
		height: 18px;
		accent-color: var(--bb-royal);
	}

	.books-error {
		margin-top: 10px;
	}

	/* Footer */
	.footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		margin-top: 8px;
		padding-top: 20px;
		border-top: 1px solid var(--bb-line-soft);
	}

	.esc {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		color: var(--bb-text-4);
	}

	.footer-actions {
		display: flex;
		gap: 10px;
		margin-left: auto;
	}

	@media (max-width: 600px) {
		.top {
			padding: 12px 10px 0 12px;
			align-items: flex-start;
		}

		.intro {
			padding: 16px 20px 4px;
		}

		h2 {
			font-size: 32px;
		}

		form {
			padding: 14px 20px 20px;
		}

		.options {
			grid-template-columns: minmax(0, 1fr);
		}

		.esc {
			display: none;
		}
	}
</style>
