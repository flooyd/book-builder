<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { booksStore, chaptersStore, charactersStore, partsStore } from '$lib/stores';
	import { bookOutline, plural } from '$lib/library';
	import { useAppHeader } from '$lib/app-header.svelte';
	import {
		OutlineDoc,
		applyOrder,
		keyOf,
		moveTo,
		orderOf,
		stepMove,
		type Place
	} from '$lib/outline.svelte';
	import { outlineToText, type ParsedOutline } from '$lib/outline-text';
	import { STATUSES } from '$lib/status';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Missing from '$lib/components/story/Missing.svelte';
	import { startDrag } from './drag';
	import type { Group, Item, OutlineUi } from './types';
	import OutlineList from './OutlineList.svelte';
	import Corkboard from './Corkboard.svelte';
	import Inspector from './Inspector.svelte';
	import ImportDialog from './ImportDialog.svelte';

	// The outlining tool: a book's parts and chapters as a nested list or a corkboard, rearranged
	// by dragging or from the keyboard, written in place, with statuses, casts, word counts,
	// search and filters, a details panel, and import/export as plain text.
	let { id }: { id: number } = $props();

	// One per mounted page: the route re-mounts this component for another book.
	// svelte-ignore state_referenced_locally
	const doc = new OutlineDoc(id);

	const book = $derived($booksStore.find((b) => b.id === id));

	// As saved, and as shown (while dragging, in the dragged order).
	const saved = $derived(bookOutline(id, $partsStore, $chaptersStore));
	const outline = $derived.by(() => {
		if (!doc.draft) return saved;
		const applied = applyOrder($partsStore, $chaptersStore, doc.draft);
		return bookOutline(id, applied.parts, applied.chapters);
	});

	const groups = $derived<Group[]>(
		outline.map((entry) => {
			const chapters: Item[] = entry.chapters.map(({ chapter, number }) => {
				const key = keyOf('chapter', chapter.id);
				return {
					kind: 'chapter',
					id: chapter.id,
					key,
					title: chapter.title,
					description: chapter.description,
					showDescription: chapter.showDescription,
					status: chapter.status,
					label: `Chapter ${number}`,
					number,
					holdsChapters: false,
					partId: chapter.partId,
					words: doc.words[key] ?? 0,
					cast: doc.cast[key] ?? []
				};
			});
			const part = entry.part;
			const key = keyOf('part', part.id);
			return {
				part: {
					kind: 'part',
					id: part.id,
					key,
					title: part.title,
					description: part.description,
					showDescription: part.showDescription,
					status: part.status,
					label: entry.label,
					number: null,
					holdsChapters: !!part.hasChapters,
					partId: null,
					words: part.hasChapters
						? chapters.reduce((sum, chapter) => sum + chapter.words, 0)
						: (doc.words[key] ?? 0),
					cast: doc.cast[key] ?? []
				},
				chapters
			};
		})
	);

	const items = $derived(
		Object.fromEntries(
			groups.flatMap((g) => [g.part, ...g.chapters]).map((item) => [item.key, item])
		)
	);
	const characters = $derived(
		Object.fromEntries(
			$charactersStore.filter((c) => c.bookIds.includes(id)).map((c) => [c.id, c])
		) as Record<number, { id: number; name: string }>
	);

	// ---- Search and filters ------------------------------------------------------------------
	let query = $state('');
	let statusFilter = $state<string[]>([]);
	let castFilter = $state('');
	const filtering = $derived(!!query.trim() || statusFilter.length > 0 || castFilter !== '');
	const needle = $derived(query.trim().toLowerCase());

	const textHit = (item: Item) =>
		!needle || `${item.title}\n${item.description}`.toLowerCase().includes(needle);
	const hit = (item: Item) =>
		textHit(item) &&
		(statusFilter.length === 0 || statusFilter.includes(item.status)) &&
		(castFilter === '' || item.cast.includes(Number(castFilter)));

	const visible = $derived(
		filtering
			? groups.flatMap((group) => {
					if (!group.part.holdsChapters) return hit(group.part) ? [group] : [];
					const chapters = group.chapters.filter(hit);
					const partHit =
						!!needle && textHit(group.part) && statusFilter.length === 0 && castFilter === '';
					return chapters.length > 0 || partHit ? [{ part: group.part, chapters }] : [];
				})
			: groups
	);

	function clearFilters() {
		query = '';
		statusFilter = [];
		castFilter = '';
	}

	const toggleStatus = (status: string) =>
		(statusFilter = statusFilter.includes(status)
			? statusFilter.filter((s) => s !== status)
			: [...statusFilter, status]);

	// ---- Summary -----------------------------------------------------------------------------
	// Chapters, and parts that hold their own text, are what get written.
	const units = $derived(groups.flatMap((g) => (g.part.holdsChapters ? g.chapters : [g.part])));
	const totalWords = $derived(units.reduce((sum, unit) => sum + unit.words, 0));
	const chapterTotal = $derived(groups.reduce((sum, g) => sum + g.chapters.length, 0));
	const byStatus = $derived(
		STATUSES.map((status) => ({
			...status,
			count: units.filter((unit) => unit.status === status.id).length
		}))
	);

	// ---- View settings, remembered per book --------------------------------------------------
	let view = $state<'list' | 'board'>('list');
	let synopses = $state(true);
	let collapsed = $state<number[]>([]);
	let wide = $state(true);
	let duration = $state(180);
	let prefsLoaded = false;
	const prefsKey = $derived(`bb-outline-${id}`);

	const holders = $derived(
		groups
			.filter((g) => g.part.holdsChapters)
			.map((g) => ({ id: g.part.id, label: g.part.label ?? 'Part', title: g.part.title }))
	);
	const toggleFold = (partId: number) =>
		(collapsed = collapsed.includes(partId)
			? collapsed.filter((p) => p !== partId)
			: [...collapsed, partId]);

	// ---- Selection, details, dialogs ---------------------------------------------------------
	let selected = $state<string | null>(null);
	let dragging = $state<string | null>(null);
	let detailsOpen = $state(false);
	let importing = $state(false);
	let deleting = $state<Item | null>(null);
	let live = $state('');
	let root = $state<HTMLElement>();

	const selectedItem = $derived(selected ? items[selected] : undefined);
	const selectedGroup = $derived(groups.find((g) => g.part.key === selected));
	const selectedPartTitle = $derived(
		selectedItem?.partId ? (items[keyOf('part', selectedItem.partId)]?.title ?? '') : ''
	);

	// Titles in the order ↑ and ↓ move through.
	const navKeys = $derived(
		visible.flatMap((g) => [
			g.part.key,
			...(view === 'list' && collapsed.includes(g.part.id) ? [] : g.chapters.map((c) => c.key))
		])
	);

	function focusTitle(key: string | undefined, caret: 'select' | 'end' = 'end') {
		const field = key && document.getElementById(`title-${key}`);
		if (!(field instanceof HTMLInputElement)) return;
		field.focus();
		if (caret === 'select') field.select();
		else field.setSelectionRange(field.value.length, field.value.length);
	}

	function focusNeighbour(key: string, direction: -1 | 1) {
		const next = navKeys[navKeys.indexOf(key) + direction];
		if (next) focusTitle(next);
	}

	/** Nothing in it yet: deleting it loses nothing. */
	const blank = (item: Item) =>
		!item.description &&
		item.words === 0 &&
		item.cast.length === 0 &&
		!(item.kind === 'part' && (groups.find((g) => g.part.key === item.key)?.chapters.length ?? 0));

	// ---- Changes -----------------------------------------------------------------------------
	let creating = false;

	const notWhileFiltering = (action: string) => {
		if (!filtering) return false;
		doc.say(`Clear the search and filters to ${action}.`);
		return true;
	};

	async function addChapter(partId: number, after?: number | null) {
		if (creating || notWhileFiltering('add chapters')) return;
		creating = true;
		const row = await doc.create('chapter', { order: orderOf(saved), partId, after });
		creating = false;
		if (!row) return;
		collapsed = collapsed.filter((p) => p !== partId);
		const key = keyOf('chapter', row.id);
		selected = key;
		await tick();
		focusTitle(key, 'select');
		live = 'Added a chapter.';
	}

	async function addPart(hasChapters: boolean, after?: number) {
		if (creating || notWhileFiltering('add parts')) return;
		creating = true;
		const row = await doc.create('part', { order: orderOf(saved), after, hasChapters });
		creating = false;
		if (!row) return;
		const key = keyOf('part', row.id);
		selected = key;
		await tick();
		focusTitle(key, 'select');
		live = hasChapters ? 'Added a part.' : 'Added a story text part.';
	}

	async function removeBlank(item: Item) {
		const index = navKeys.indexOf(item.key);
		const previous = navKeys[index - 1] ?? navKeys[index + 1];
		if (!(await doc.remove(item.kind, item.id))) return;
		if (selected === item.key) selected = previous ?? null;
		await tick();
		focusTitle(previous);
		live = `Deleted ${item.title}.`;
	}

	function requestDelete(item: Item) {
		if (blank(item)) removeBlank(item);
		else deleting = item;
	}

	async function confirmDelete() {
		const item = deleting;
		if (!item) return;
		if (await doc.remove(item.kind, item.id)) {
			if (selected === item.key) selected = null;
			detailsOpen = false;
			doc.say(`Deleted “${item.title}”.`);
		}
		deleting = null;
	}

	/** Tell screen readers where a moved item ended up. */
	function announce(key: string) {
		const now = items[key];
		if (!now) return;
		if (now.kind === 'chapter') {
			const part = items[keyOf('part', now.partId!)];
			live = `${now.title} is now ${now.label}, in ${part?.label ?? part?.title ?? 'its part'}.`;
		} else {
			const index = groups.findIndex((g) => g.part.key === key);
			live = `${now.title} is now part ${index + 1} of ${groups.length}.`;
		}
	}

	async function step(item: Item, direction: -1 | 1) {
		if (notWhileFiltering('rearrange')) return;
		const original = orderOf(saved);
		const next = stepMove(original, item.kind, item.id, direction);
		if (!next) return;
		const focused = document.activeElement?.id;
		const saving = doc.commit(next, original);
		await tick();
		// A chapter moved into a folded part unfolds it.
		const moved = items[item.key];
		if (moved?.partId && collapsed.includes(moved.partId)) {
			collapsed = collapsed.filter((p) => p !== moved.partId);
			await tick();
		}
		if (focused) document.getElementById(focused)?.focus();
		announce(item.key);
		await saving;
	}

	function titleKeys(item: Item, event: KeyboardEvent) {
		const field = event.currentTarget as HTMLInputElement;
		const plain = !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
		const vertical = event.key === 'ArrowUp' || event.key === 'ArrowDown';
		const direction = event.key === 'ArrowUp' ? -1 : 1;

		if (event.key === 'Enter' && !event.shiftKey && !event.altKey) {
			event.preventDefault();
			if (event.ctrlKey || event.metaKey) {
				if (item.kind === 'part' && item.holdsChapters) addChapter(item.id);
			} else if (item.kind === 'chapter') addChapter(item.partId!, item.id);
			else addPart(item.holdsChapters, item.id);
		} else if (event.key === 'Backspace' && plain && field.value === '' && blank(item)) {
			event.preventDefault();
			removeBlank(item);
		} else if (vertical && event.altKey && !event.ctrlKey && !event.metaKey) {
			event.preventDefault();
			step(item, direction);
		} else if (vertical && plain) {
			event.preventDefault();
			focusNeighbour(item.key, direction);
		} else if (event.key === 'Escape') {
			field.blur();
		}
	}

	function gripKeys(item: Item, event: KeyboardEvent) {
		if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
		event.preventDefault();
		step(item, event.key === 'ArrowUp' ? -1 : 1);
	}

	function drag(
		item: Item,
		event: PointerEvent,
		element: HTMLElement,
		locate: (x: number, y: number) => Place | null,
		scroller?: HTMLElement | null
	) {
		if (event.button !== 0 || !root) return;
		if (notWhileFiltering('rearrange')) return;
		const original = orderOf(saved);
		startDrag<Place>({
			event,
			item: element,
			layer: root,
			scroller,
			locate,
			same: (a, b) => a.partId === b.partId && a.index === b.index,
			onstart: () => {
				dragging = item.key;
				selected = item.key;
			},
			onmove: (place) => {
				doc.draft = moveTo(doc.draft ?? original, item.kind, item.id, place);
			},
			ondrop: async () => {
				const order = doc.draft;
				dragging = null;
				if (!order) return;
				const saving = doc.commit(order, original);
				await tick();
				announce(item.key);
				await saving;
			},
			oncancel: () => {
				dragging = null;
				doc.draft = null;
			}
		});
	}

	const ui: OutlineUi = {
		get selected() {
			return selected;
		},
		get dragging() {
			return dragging;
		},
		get canReorder() {
			return !filtering;
		},
		get synopses() {
			return synopses;
		},
		get characters() {
			return characters;
		},
		select: (key) => (selected = key),
		details: (key) => {
			selected = key;
			if (!wide) detailsOpen = true;
		},
		save: (item, changes) => doc.update(item.kind, item.id, changes),
		titleKeys,
		gripKeys,
		drag,
		addChapter,
		addPart
	};

	async function copyText() {
		try {
			await navigator.clipboard.writeText(outlineToText(groups));
			doc.say('Outline copied as text.');
		} catch {
			doc.say("Couldn't copy: the browser blocked the clipboard.", true);
		}
	}

	async function runImport(parsed: ParsedOutline, intoPartId: number | null) {
		const created = await doc.import(parsed, intoPartId);
		if (!created) return false;
		doc.say(
			`Added ${plural(created.parts.length, 'part')} and ${plural(created.chapters.length, 'chapter')}.`
		);
		return true;
	}

	useAppHeader((header) => {
		header.wide = true;
		header.crumbs = [
			{ label: 'Library', href: resolve('/') },
			...(book
				? [{ label: book.title, href: resolve('/book/[id]', { id: String(book.id) }) }]
				: []),
			{ label: 'Outline' }
		];
	});

	onMount(() => {
		doc.load();
		try {
			const prefs = JSON.parse(localStorage.getItem(prefsKey) ?? 'null');
			if (prefs?.view === 'list' || prefs?.view === 'board') view = prefs.view;
			if (typeof prefs?.synopses === 'boolean') synopses = prefs.synopses;
			if (Array.isArray(prefs?.collapsed)) collapsed = prefs.collapsed.filter(Number.isInteger);
		} catch {
			// storage unavailable: defaults
		}
		prefsLoaded = true;

		if (matchMedia('(prefers-reduced-motion: reduce)').matches) duration = 0;
		const wideQuery = matchMedia('(min-width: 1100px)');
		const update = () => {
			wide = wideQuery.matches;
			if (wide) detailsOpen = false;
		};
		update();
		wideQuery.addEventListener('change', update);
		return () => wideQuery.removeEventListener('change', update);
	});

	$effect(() => {
		const prefs = JSON.stringify({ view, synopses, collapsed });
		if (!prefsLoaded) return;
		try {
			localStorage.setItem(prefsKey, prefs);
		} catch {
			// storage unavailable: settings last for this visit
		}
	});
</script>

<svelte:head>
	<title>{book ? `Outline · ${book.title} · Book Builder` : 'Outline · Book Builder'}</title>
</svelte:head>

{#if book}
	<div class="outline-page" bind:this={root}>
		<header class="page-head">
			<div class="title-block">
				<a class="overline" href={resolve('/book/[id]', { id: String(book.id) })}>{book.title}</a>
				<h1><motion-headline by="chars" interval={0.03}>Outline</motion-headline></h1>
			</div>
			<div class="head-actions">
				<Button href={resolve('/book/[id]/read', { id: String(book.id) })}>
					<Icon name="book-open" size={16} />Read
				</Button>
				<Button onclick={copyText} disabled={groups.length === 0}>
					<Icon name="copy" size={16} />Copy as text
				</Button>
				<Button variant="primary" onclick={() => (importing = true)}>
					<Icon name="plus" size={16} strokeWidth={2.2} />Import from text
				</Button>
			</div>
		</header>

		<section class="summary" aria-label="Progress">
			<p class="totals">
				<strong>{totalWords.toLocaleString('en')}</strong>
				{totalWords === 1 ? 'word' : 'words'} · {plural(chapterTotal, 'chapter')} · {plural(
					groups.length,
					'part'
				)}
			</p>
			{#if units.length > 0}
				<div class="bar" aria-hidden="true">
					{#each byStatus as status (status.id)}
						{#if status.count > 0}
							<span style:flex={status.count} style:background="var(--status-{status.id})"></span>
						{/if}
					{/each}
				</div>
			{/if}
			<div class="legend" role="group" aria-label="Show only">
				{#each byStatus as status (status.id)}
					<button
						type="button"
						aria-pressed={statusFilter.includes(status.id)}
						style:--dot="var(--status-{status.id})"
						onclick={() => toggleStatus(status.id)}
					>
						<span class="dot"></span>{status.label}<span class="n">{status.count}</span>
					</button>
				{/each}
			</div>
		</section>

		<div class="toolbar">
			<div class="segmented" role="group" aria-label="View">
				<button type="button" aria-pressed={view === 'list'} onclick={() => (view = 'list')}>
					<Icon name="list-tree" size={16} />Outline
				</button>
				<button type="button" aria-pressed={view === 'board'} onclick={() => (view = 'board')}>
					<Icon name="columns" size={16} />Corkboard
				</button>
			</div>
			<label class="search">
				<span class="search-icon" aria-hidden="true"><Icon name="search" size={16} /></span>
				<input
					class="bb-field"
					type="search"
					bind:value={query}
					placeholder="Search titles and synopses"
					aria-label="Search the outline"
				/>
			</label>
			<select
				class="bb-field cast-filter"
				bind:value={castFilter}
				aria-label="Show only chapters with"
			>
				<option value="">Everyone</option>
				{#each Object.values(characters) as character (character.id)}
					<option value={String(character.id)}>{character.name}</option>
				{/each}
			</select>
			<label class="switch-label">
				<input type="checkbox" bind:checked={synopses} />Synopses
			</label>
			{#if view === 'list' && holders.length > 0}
				<button
					type="button"
					class="tool"
					onclick={() => (collapsed = collapsed.length ? [] : holders.map((h) => h.id))}
				>
					{collapsed.length ? 'Unfold all' : 'Fold all'}
				</button>
			{/if}
			<button type="button" class="tool" popovertarget="outline-keys">Shortcuts</button>
		</div>

		{#if filtering}
			<p class="filter-note">
				Showing {plural(
					visible.reduce((n, g) => n + (g.part.holdsChapters ? g.chapters.length : 1), 0),
					'match',
					'matches'
				)}. Rearranging and adding are off while filtering.
				<button type="button" class="link" onclick={clearFilters}>Clear</button>
			</p>
		{/if}

		<div class={['workspace', { 'with-aside': wide }]}>
			<div class="view">
				{#if groups.length === 0}
					<div class="empty">
						<h2>Start with a part.</h2>
						<p>
							Parts hold chapters, or a single run of story text like a prologue. Or paste a whole
							outline at once.
						</p>
						<div class="empty-actions">
							<Button variant="primary" onclick={() => addPart(true)}>
								<Icon name="plus" size={16} strokeWidth={2.2} />Add a part
							</Button>
							<Button onclick={() => addPart(false)}>
								<Icon name="file-text" size={16} />Add story text
							</Button>
							<Button onclick={() => (importing = true)}>Import from text</Button>
						</div>
					</div>
				{:else if visible.length === 0}
					<p class="no-matches">
						Nothing matches. <button type="button" class="link" onclick={clearFilters}
							>Clear the filters</button
						>
					</p>
				{:else if view === 'list'}
					<OutlineList groups={visible} {ui} {collapsed} ontoggle={toggleFold} {duration} />
					{#if !filtering}
						<div class="add-parts">
							<button type="button" class="add" onclick={() => addPart(true)}>
								<Icon name="plus" size={15} strokeWidth={2.2} />Add part
							</button>
							<button type="button" class="add" onclick={() => addPart(false)}>
								<Icon name="file-text" size={15} />Add story text
							</button>
						</div>
					{/if}
				{:else}
					<Corkboard groups={visible} {ui} {duration} />
				{/if}
			</div>

			{#if wide}
				<aside class="aside" aria-label="Details">
					{#if selectedItem}
						{#key selectedItem.key}
							<Inspector
								item={selectedItem}
								group={selectedGroup}
								partTitle={selectedPartTitle}
								bookId={id}
								{ui}
								oncast={(item, ids) => doc.setCast(item.kind, item.id, ids)}
								ondelete={requestDelete}
							/>
						{/key}
					{:else}
						<div class="aside-empty">
							<Icon name="info" size={20} />
							<p>Select a part or chapter to see its status, cast and synopsis here.</p>
						</div>
					{/if}
				</aside>
			{/if}
		</div>

		<div id="outline-keys" class="keys" popover="auto">
			<h2>Keyboard</h2>
			<dl>
				<dt><kbd>Enter</kbd></dt>
				<dd>Add the next chapter (or part) below</dd>
				<dt><kbd>Ctrl</kbd> <kbd>Enter</kbd></dt>
				<dd>On a part: add a chapter at its end</dd>
				<dt><kbd>Backspace</kbd></dt>
				<dd>In an empty title: remove an empty item</dd>
				<dt><kbd>↑</kbd> <kbd>↓</kbd></dt>
				<dd>Move between titles</dd>
				<dt><kbd>Alt</kbd> <kbd>↑</kbd> <kbd>↓</kbd></dt>
				<dd>Move the item up or down, across parts</dd>
				<dt><kbd>Esc</kbd></dt>
				<dd>Leave the field (changes save as you type)</dd>
			</dl>
		</div>

		<p class="sr-only" aria-live="polite">{live}</p>
		{#if doc.message}
			<div
				class={['toast', { error: doc.message.error }]}
				role={doc.message.error ? 'alert' : 'status'}
			>
				{doc.message.text}
			</div>
		{/if}

		{#if detailsOpen && !wide && selectedItem}
			<Dialog labelledby="inspector-title" width={540} onclose={() => (detailsOpen = false)}>
				{#key selectedItem.key}
					<Inspector
						item={selectedItem}
						group={selectedGroup}
						partTitle={selectedPartTitle}
						bookId={id}
						{ui}
						oncast={(item, ids) => doc.setCast(item.kind, item.id, ids)}
						ondelete={requestDelete}
						onclose={() => (detailsOpen = false)}
					/>
				{/key}
			</Dialog>
		{/if}

		{#if importing}
			<ImportDialog {holders} onimport={runImport} onclose={() => (importing = false)} />
		{/if}

		{#if deleting}
			{@const item = deleting}
			{@const chapterCount = groups.find((g) => g.part.key === item.key)?.chapters.length ?? 0}
			<Dialog labelledby="delete-item-title" width={460} onclose={() => (deleting = null)}>
				<div class="confirm">
					<h2 id="delete-item-title">Delete <em>{item.title}</em>?</h2>
					<p>
						{#if item.kind === 'part' && item.holdsChapters}
							Its {plural(chapterCount, 'chapter')} and their story text ({plural(
								item.words,
								'word'
							)}) go with it.
						{:else}
							Its story text ({plural(item.words, 'word')}), synopsis and cast go with it.
						{/if}
						This can't be undone.
					</p>
					<div class="confirm-actions">
						<Button variant="quiet" onclick={() => (deleting = null)}>Cancel</Button>
						<Button variant="danger" onclick={confirmDelete}>
							<Icon name="trash" size={16} />Delete
						</Button>
					</div>
				</div>
			</Dialog>
		{/if}
	</div>
{:else}
	<Missing noun="book" />
{/if}

<style>
	.outline-page {
		--status-idea: var(--bb-text-4);
		--status-outlined: var(--bb-sky);
		--status-drafting: light-dark(#b07d10, #f2c46b);
		--status-revising: light-dark(#7046c9, #b9a0ff);
		--status-done: light-dark(#1d7f55, #5fd39a);
		max-width: 1360px;
		margin: 0 auto;
		padding: 36px 32px 120px;
	}

	.page-head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 16px 32px;
	}

	.title-block {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}

	.overline {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--bb-sky);
		text-decoration: none;
		overflow-wrap: anywhere;
	}

	.overline:hover {
		color: var(--bb-sky-hover);
	}

	h1 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(44px, 4.6vw, 64px);
		line-height: 1;
		color: var(--bb-text-strong);
	}

	.head-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	/* Progress */
	.summary {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-top: 26px;
		padding: 18px 20px;
		border-radius: var(--r-card);
		background: var(--bb-ink);
		border: 1px solid var(--bb-line-soft);
	}

	.totals {
		font-size: 15px;
		color: var(--bb-text-2);
	}

	.totals strong {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 24px;
		color: var(--bb-text-strong);
	}

	.bar {
		display: flex;
		gap: 2px;
		height: 10px;
		overflow: hidden;
		border-radius: var(--r-pill);
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.legend button {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 36px;
		padding: 0 12px;
		border-radius: var(--r-pill);
		border: 1px solid var(--bb-line-soft);
		background: transparent;
		color: var(--bb-text-label);
		font: 600 13px var(--font-ui);
	}

	.legend button:hover {
		border-color: var(--bb-line-control);
	}

	.legend button[aria-pressed='true'] {
		border-color: var(--bb-sky);
		background: var(--bb-sky-wash);
		color: var(--bb-sky-text);
	}

	.dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--dot);
	}

	.n {
		font-weight: 400;
		color: var(--bb-text-3);
	}

	/* Toolbar */
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		margin: 22px 0 16px;
	}

	.segmented {
		display: inline-flex;
		padding: 3px;
		border-radius: 12px;
		border: 1px solid var(--bb-line-soft);
		background: var(--bb-ink);
	}

	.segmented button {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 38px;
		padding: 0 14px;
		border: none;
		border-radius: 9px;
		background: transparent;
		color: var(--bb-text-2);
		font: 600 14px var(--font-ui);
	}

	.segmented button[aria-pressed='true'] {
		background: var(--bb-royal);
		color: #fff;
	}

	.search {
		position: relative;
		flex: 1 1 220px;
		min-width: 0;
	}

	.search-icon {
		position: absolute;
		left: 14px;
		top: 50%;
		display: grid;
		transform: translateY(-50%);
		color: var(--bb-text-3);
		pointer-events: none;
	}

	.search input {
		min-height: 44px;
		padding-left: 38px;
		font-size: 15px;
	}

	.cast-filter {
		width: auto;
		min-height: 44px;
		padding: 0 12px;
		font-size: 14.5px;
	}

	.switch-label {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		padding: 0 6px;
		font-size: 14.5px;
		font-weight: 600;
		color: var(--bb-text-label);
		cursor: pointer;
	}

	.switch-label input {
		width: 18px;
		height: 18px;
		accent-color: var(--bb-royal);
	}

	.tool {
		min-height: 44px;
		min-width: 44px;
		padding: 0 12px;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: var(--bb-text-label);
		font: 600 14px var(--font-ui);
	}

	.tool:hover {
		background: var(--bb-line-faint);
	}

	.filter-note,
	.no-matches {
		margin: -4px 0 14px;
		font-size: 14px;
		color: var(--bb-text-2);
	}

	.link {
		padding: 0;
		border: none;
		background: none;
		color: var(--bb-sky);
		font: inherit;
		font-weight: 600;
		text-decoration: underline;
	}

	/* Workspace */
	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 28px;
		align-items: start;
	}

	.workspace.with-aside {
		grid-template-columns: minmax(0, 1fr) 360px;
	}

	.view {
		min-width: 0;
	}

	.aside {
		position: sticky;
		top: 84px;
		max-height: calc(100vh - 100px);
		overflow: auto;
		border-radius: var(--r-card);
		background: var(--bb-ink);
		border: 1px solid var(--bb-line-soft);
	}

	.aside-empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 10px;
		padding: 22px;
		font-size: 14.5px;
		color: var(--bb-text-3);
	}

	.add-parts {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-top: 16px;
	}

	.add {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: 48px;
		padding: 0 18px;
		border: 1.5px dashed var(--bb-line-control);
		border-radius: var(--r-row);
		background: transparent;
		color: var(--bb-text-2);
		font: 600 14.5px var(--font-ui);
	}

	.add:hover {
		border-color: var(--bb-sky);
		color: var(--bb-sky);
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
		padding: 36px;
		border-radius: var(--r-card);
		border: 1.5px dashed var(--bb-line-dashed);
	}

	.empty h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 32px;
		color: var(--bb-text-strong);
	}

	.empty p {
		max-width: 34em;
		color: var(--bb-text-2);
	}

	.empty-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-top: 6px;
	}

	/* Keyboard help */
	.keys {
		width: min(440px, calc(100vw - 32px));
		padding: 22px 24px;
		border: 1px solid var(--bb-line-control);
		border-radius: 18px;
		background: var(--bb-ink);
		color: var(--bb-text);
		box-shadow: var(--shadow-modal);
	}

	.keys h2 {
		margin-bottom: 14px;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 24px;
		color: var(--bb-text-strong);
	}

	.keys dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 10px 16px;
		margin: 0;
		font-size: 14px;
	}

	.keys dt {
		white-space: nowrap;
	}

	.keys dd {
		margin: 0;
		color: var(--bb-text-2);
	}

	kbd {
		padding: 1px 6px;
		border: 1px solid var(--bb-line-control);
		border-bottom-width: 2px;
		border-radius: 5px;
		background: var(--bb-raised);
		font: 600 12px var(--font-ui);
		color: var(--bb-text-label);
	}

	.toast {
		position: fixed;
		z-index: 40;
		left: 50%;
		bottom: 24px;
		max-width: calc(100vw - 32px);
		padding: 12px 18px;
		border-radius: 12px;
		background: var(--bb-text-strong);
		color: var(--bb-night);
		font-size: 14.5px;
		font-weight: 600;
		box-shadow: 0 18px 40px -18px var(--bb-drop);
		transform: translateX(-50%);
	}

	.toast.error {
		background: var(--bb-coral);
		color: #fff;
	}

	.confirm {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 28px 30px 26px;
	}

	.confirm h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 28px;
		line-height: 1.1;
		color: var(--bb-text-strong);
		overflow-wrap: break-word;
	}

	.confirm em {
		font-family: var(--font-read);
	}

	.confirm p {
		font-size: 15.5px;
		line-height: 1.5;
		color: var(--bb-text-2);
	}

	.confirm-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		margin-top: 14px;
		padding-top: 20px;
		border-top: 1px solid var(--bb-line-soft);
	}

	@media (max-width: 600px) {
		.outline-page {
			padding: 24px 16px 100px;
		}

		.cast-filter {
			flex: 1;
		}
	}
</style>
