<script lang="ts">
	import { resolve } from '$app/paths';
	import { ENTRY_COPY, ENTRY_TYPES, type EntryType } from '$lib/bible';
	import { useAppHeader } from '$lib/app-header.svelte';
	import { capitalize, plural } from '$lib/library';
	import {
		booksStore,
		charactersStore,
		modalStore,
		placesStore,
		systemsStore,
		type Entry
	} from '$lib/stores';
	import { plainText } from '$lib/rich';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Kbd from '$lib/components/ui/Kbd.svelte';
	import RichText from '$lib/components/rich/RichText.svelte';
	import Missing from '$lib/components/story/Missing.svelte';
	import Monogram from './Monogram.svelte';

	// A book's story bible: every character, place and system in it, each opening its own page.
	let { id, counts }: { id: number; counts: Record<string, number> } = $props();

	const book = $derived($booksStore.find((b) => b.id === id));

	const bookHref = $derived(resolve('/book/[id]', { id: String(id) }));

	useAppHeader((header) => {
		header.wide = true;
		header.crumbs = [
			{ label: 'Library', href: resolve('/') },
			...(book ? [{ label: book.title, href: bookHref }] : []),
			{ label: 'Story bible' }
		];
	});

	let query = $state('');
	let shown = $state<EntryType | 'all'>('all');

	const entries = $derived<Record<EntryType, Entry[]>>({
		character: $charactersStore.filter((entry) => entry.bookIds.includes(id)),
		place: $placesStore.filter((entry) => entry.bookIds.includes(id)),
		system: $systemsStore.filter((entry) => entry.bookIds.includes(id))
	});

	/** Everything a search looks through: names, short names, descriptions, details, notes. */
	function matches(entry: Entry) {
		const needle = query.trim().toLowerCase();
		if (!needle) return true;
		return [
			entry.name,
			...entry.aliases,
			'kind' in entry ? entry.kind : '',
			plainText(entry.description, 'description'),
			plainText(entry.notes, 'description'),
			...entry.details.flatMap((detail) => [detail.label, detail.value])
		].some((text) => text.toLowerCase().includes(needle));
	}

	const sections = $derived(
		ENTRY_TYPES.filter((type) => shown === 'all' || shown === type).map((type) => ({
			type,
			copy: ENTRY_COPY[type],
			entries: entries[type].filter(matches)
		}))
	);
	const total = $derived(ENTRY_TYPES.reduce((sum, type) => sum + entries[type].length, 0));
	const found = $derived(sections.reduce((sum, section) => sum + section.entries.length, 0));

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

	const appears = (type: EntryType, entry: Entry) => {
		const count = counts[`${type}-${entry.id}`] ?? 0;
		return count > 0 ? `In ${plural(count, 'chapter')}` : 'Not in a chapter yet';
	};

	const create = (category: EntryType) => modalStore.set({ type: 'create', category, bookId: id });
</script>

<svelte:head>
	<title>{book ? `Story bible · ${book.title} · Book Builder` : 'Story bible · Book Builder'}</title
	>
</svelte:head>

{#if book}
	<main class="bible">
		<header class="head">
			<div class="head-text">
				<p class="overline">{book.title}</p>
				<h1><motion-headline by="words" interval={0.07}>Story bible</motion-headline></h1>
				<p class="sub">
					Everyone and everything in this book. Type <Kbd key="@" size="xs" /> while you write to link
					them to the text.
				</p>
			</div>
			<div class="actions">
				{#each ENTRY_TYPES as type (type)}
					<Button onclick={() => create(type)}>
						<Icon name="plus" size={16} strokeWidth={2.2} />New {ENTRY_COPY[type].one}
					</Button>
				{/each}
			</div>
		</header>

		<div class="tools">
			<label class="search">
				<span class="sr-only">Search the story bible</span>
				<Icon name="search" size={17} />
				<input
					class="bb-field"
					type="search"
					placeholder="Search names, notes and details"
					autocomplete="off"
					bind:value={query}
				/>
			</label>
			<div class="filters" role="group" aria-label="Show">
				<button type="button" aria-pressed={shown === 'all'} onclick={() => (shown = 'all')}>
					All <span>{total}</span>
				</button>
				{#each ENTRY_TYPES as type (type)}
					<button type="button" aria-pressed={shown === type} onclick={() => (shown = type)}>
						{ENTRY_COPY[type].many} <span>{entries[type].length}</span>
					</button>
				{/each}
			</div>
		</div>

		{#if query.trim() && found === 0}
			<p class="nothing">Nothing here matches “{query.trim()}”.</p>
		{/if}

		{#each sections as section (section.type)}
			{#if section.entries.length > 0 || !query.trim()}
				<section aria-labelledby="h-{section.type}">
					<h2 id="h-{section.type}">{section.copy.many}</h2>
					{#if section.entries.length === 0}
						<p class="nothing">
							No {section.copy.many.toLowerCase()} yet.
							<button type="button" class="link" onclick={() => create(section.type)}
								>Add the first</button
							>, or type @ in your story text.
						</p>
					{:else}
						<ul class="grid">
							{#each section.entries as entry (entry.id)}
								<li>
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- entryHref is resolve()d -->
									<a class="entry" href={entryHref(section.type, entry)}>
										<span class="entry-head">
											<Monogram name={entry.name} id={entry.id} />
											<span class="entry-title">
												<span class="entry-kind">
													{'kind' in entry && entry.kind
														? entry.kind
														: capitalize(section.copy.one)}
												</span>
												<span class="entry-name">{entry.name}</span>
											</span>
										</span>
										{#if entry.description}
											<span class="entry-desc"><RichText value={entry.description} italic /></span>
										{/if}
										<span class="entry-foot">
											<span>{appears(section.type, entry)}</span>
											{#if alsoIn(entry)}<span>{alsoIn(entry)}</span>{/if}
										</span>
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{/if}
		{/each}
	</main>
{:else}
	<Missing noun="book" />
{/if}

<style>
	.bible {
		max-width: 1160px;
		margin: 0 auto;
		padding: 48px 32px 96px;
		display: flex;
		flex-direction: column;
		gap: 32px;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 20px 32px;
	}

	.head-text {
		flex: 1 1 420px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.overline {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--bb-sky);
		overflow-wrap: anywhere;
	}

	h1 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(38px, 6vw, 58px);
		line-height: 1.05;
		color: var(--bb-text-strong);
	}

	.sub {
		max-width: 560px;
		font-family: var(--font-read);
		font-size: 19px;
		line-height: 1.5;
		color: var(--bb-text-2);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px 16px;
	}

	.search {
		position: relative;
		flex: 1 1 280px;
		min-width: 0;
		color: var(--bb-text-3);
	}

	.search :global(svg) {
		position: absolute;
		top: 50%;
		left: 14px;
		transform: translateY(-50%);
		pointer-events: none;
	}

	.search input {
		min-height: 44px;
		padding-left: 40px;
		font-size: 15px;
	}

	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		padding: 4px;
		border-radius: 12px;
		background: var(--bb-ink);
		border: 1px solid var(--bb-line-soft);
	}

	.filters button {
		min-height: 36px;
		padding: 0 12px;
		border: none;
		border-radius: 9px;
		background: transparent;
		color: var(--bb-text-2);
		font: 600 13.5px var(--font-ui);
	}

	.filters button span {
		margin-left: 2px;
		font-weight: 500;
		opacity: 0.75;
	}

	.filters button:hover {
		color: var(--bb-text-strong);
	}

	.filters button[aria-pressed='true'] {
		background: var(--bb-royal);
		color: #fff;
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 28px;
		color: var(--bb-text);
	}

	.nothing {
		font-size: 15px;
		color: var(--bb-text-3);
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

	.grid {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
		gap: 14px;
	}

	.entry {
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 18px;
		border-radius: var(--r-row);
		background: var(--bb-ink);
		border: 1px solid var(--bb-line-soft);
		color: inherit;
		text-decoration: none;
		transition: border-color 0.15s;
	}

	.entry:hover {
		border-color: var(--bb-sky);
	}

	.entry-head {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}

	.entry-title {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.entry-kind {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--bb-sky);
	}

	.entry-name {
		font-family: var(--font-display);
		font-size: 21px;
		line-height: 1.15;
		color: var(--bb-text-strong);
		overflow-wrap: anywhere;
	}

	.entry-desc {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		overflow: hidden;
		font-family: var(--font-read);
		font-style: italic;
		font-size: 16px;
		line-height: 1.45;
		color: var(--bb-text-2);
	}

	.entry-foot {
		margin-top: auto;
		display: flex;
		flex-wrap: wrap;
		gap: 2px 14px;
		font-size: 13px;
		color: var(--bb-text-3);
	}

	@media (max-width: 760px) {
		.bible {
			padding: 28px 16px 96px;
			gap: 24px;
		}

		.actions :global(.bb-button),
		.actions {
			width: 100%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.entry {
			transition: none;
		}
	}
</style>
