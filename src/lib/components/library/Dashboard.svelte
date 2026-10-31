<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import {
		booksRefresh,
		booksStore,
		chaptersStore,
		libraryStatus,
		modalStore,
		partsStore,
		showMenuStore,
		type Book,
		type Chapter,
		type Part
	} from '$lib/stores';
	import { bookOutline, plural, relativeDay } from '$lib/library';
	import BookCover from '$lib/components/ui/BookCover.svelte';
	import RichText from '$lib/components/rich/RichText.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Pill from '$lib/components/ui/Pill.svelte';

	let { userName }: { userName: string } = $props();

	// The create dock is open by default here; Ctrl/Cmd+M still toggles it.
	onMount(() => {
		showMenuStore.set(true);
		return () => showMenuStore.set(false);
	});

	const library = $derived(
		$booksStore.map((book) => {
			const outline = bookOutline(book.id, $partsStore, $chaptersStore);
			const chapterCount = outline.reduce((sum, entry) => sum + entry.chapters.length, 0);
			return { book, outline, chapterCount };
		})
	);

	const partRows = $derived(
		library.flatMap(({ book, outline }) => outline.map((entry) => ({ ...entry, book })))
	);

	// Where each chapter sits: its number in the book, its part and its book.
	const placement = $derived(
		new Map(
			partRows.flatMap((row) =>
				row.chapters.map(({ chapter, number }) => [
					chapter.id,
					{ number, part: row.part, book: row.book }
				])
			)
		)
	);

	const recent = $derived(
		[...$chaptersStore]
			.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
			.flatMap((chapter) => {
				const place = placement.get(chapter.id);
				return place ? [{ chapter, ...place }] : [];
			})
			.slice(0, 5)
	);

	const counts = $derived([
		{ key: 'books', n: $booksStore.length, label: $booksStore.length === 1 ? 'book' : 'books' },
		{ key: 'parts', n: $partsStore.length, label: $partsStore.length === 1 ? 'part' : 'parts' },
		{
			key: 'chapters',
			n: $chaptersStore.length,
			label: $chaptersStore.length === 1 ? 'chapter' : 'chapters'
		}
	]);

	// motion-counter counts once; the template re-creates it when a count changes, so it springs
	// from the number shown before rather than from 0.
	// Deliberately not reactive: it only remembers the last number shown.
	const shown: Record<string, number> = {};
	function countFrom(key: string, n: number) {
		const from = shown[key] ?? 0;
		shown[key] = n;
		return from;
	}

	const bookHref = (book: Book) => resolve('/book/[id]', { id: String(book.id) });
	const partHref = (part: Part) => resolve('/part/[id]', { id: String(part.id) });
	const chapterHref = (chapter: Chapter) => resolve('/chapter/[id]', { id: String(chapter.id) });

	function retry() {
		libraryStatus.set('loading');
		booksRefresh.update((n) => n + 1);
	}
</script>

<svelte:head>
	<title>Your library · Book Builder</title>
</svelte:head>

<main class="dash" aria-busy={$libraryStatus === 'loading'}>
	<div class="head">
		<div class="head-text">
			<span class="overline">Your library</span>
			<h1><motion-headline by="chars" interval={0.025}>Welcome back.</motion-headline></h1>
		</div>
		{#if $libraryStatus === 'ready'}
			<div class="counts">
				{#each counts as count (count.key)}
					<span class="count"
						><span class="n"
							>{#key count.n}<motion-counter
									from={countFrom(count.key, count.n)}
									to={count.n}
									duration={1.2}>{count.n}</motion-counter
								>{/key}</span
						>{count.label}</span
					>
				{/each}
			</div>
		{/if}
	</div>

	{#if $libraryStatus === 'error'}
		<div class="notice" role="alert">
			<Icon name="alert-circle" size={18} />
			<span>We couldn't load your library.</span>
			<Button variant="ghost" onclick={retry}>Try again</Button>
		</div>
	{:else if $libraryStatus === 'loading'}
		<p class="sr-only">Loading your library…</p>
		<div class="book-grid" aria-hidden="true">
			<div class="skeleton"></div>
			<div class="skeleton"></div>
			<div class="skeleton"></div>
		</div>
	{:else}
		<section aria-labelledby="h-books" class="books">
			<h2 id="h-books" class="label">Books</h2>
			<div class="book-grid" class:empty={library.length === 0}>
				<motion-stagger interval={0.08} y={20}>
					{#each library as { book, outline, chapterCount } (book.id)}
						<a class="book-card" href={bookHref(book)}>
							<BookCover id={book.id} title={book.title} author={userName} tilt />
							<span class="book-text">
								<span class="book-title">{book.title}</span>
								{#if book.description}
									<span class="book-desc"><RichText value={book.description} italic /></span>
								{/if}
								<span class="book-meta">
									<Pill variant="count" size="sm">{plural(outline.length, 'part')}</Pill>
									<Pill variant="count" size="sm">{plural(chapterCount, 'chapter')}</Pill>
									<span class="updated">Updated {relativeDay(book.updatedAt)}</span>
								</span>
							</span>
						</a>
					{/each}
					<button
						type="button"
						class="new-book"
						onclick={() => modalStore.set({ type: 'create', category: 'book' })}
					>
						<span class="plus"><Icon name="plus" size={22} strokeWidth={2.2} /></span>
						<span class="new-title">Start a new book</span>
						<span class="new-sub">A title is all it takes</span>
					</button>
				</motion-stagger>
			</div>
		</section>

		{#if library.length > 0}
			<div class="lists">
				<section aria-labelledby="h-parts" class="list">
					<h2 id="h-parts" class="label">Parts</h2>
					<motion-stagger interval={0.05} delay={0.15}>
						{#each partRows as row (row.part.id)}
							<a class="part-row" href={partHref(row.part)}>
								<span class="part-icon">
									<Icon name={row.label ? 'layers' : 'pen'} size={18} strokeWidth={1.9} />
								</span>
								<span class="part-text">
									<span class="part-title">
										{#if row.label}{row.label} <em>{row.part.title}</em>{:else}{row.part.title}{/if}
									</span>
									<span class="part-book">{row.book.title}</span>
								</span>
								{#if row.label}
									<span class="part-count">{plural(row.chapters.length, 'chapter')}</span>
								{:else}
									<Pill size="sm">No chapters</Pill>
								{/if}
							</a>
						{:else}
							<div class="empty-row">
								<span>No parts yet. Parts hold chapters, or a single run of story text.</span>
								<Button
									variant="quiet"
									onclick={() => modalStore.set({ type: 'create', category: 'part' })}
								>
									<Icon name="plus" size={16} />New part
								</Button>
							</div>
						{/each}
					</motion-stagger>
				</section>

				<section aria-labelledby="h-chapters" class="list">
					<h2 id="h-chapters" class="label">Recent chapters</h2>
					{#if recent.length > 0}
						<div class="recent">
							<motion-stagger interval={0.05} delay={0.25}>
								{#each recent as item, i (item.chapter.id)}
									<a class="recent-row" href={chapterHref(item.chapter)}>
										<span class="num" class:latest={i === 0}>{item.number}</span>
										<span class="recent-title">{item.chapter.title}</span>
										<span class="recent-meta">{item.part.title} · {item.book.title}</span>
									</a>
								{/each}
							</motion-stagger>
						</div>
					{:else}
						<div class="empty-row">
							<span>No chapters yet. Chapters live inside a part.</span>
							<Button
								variant="quiet"
								onclick={() => modalStore.set({ type: 'create', category: 'chapter' })}
							>
								<Icon name="plus" size={16} />New chapter
							</Button>
						</div>
					{/if}
				</section>
			</div>
		{/if}
	{/if}
</main>

<style>
	.dash {
		max-width: 1280px;
		margin: 0 auto;
		padding: 44px 32px 0;
		display: flex;
		flex-direction: column;
		gap: 44px;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 20px 40px;
	}

	.head-text {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.overline {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--bb-sky);
	}

	h1 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(42px, 4.4vw, 60px);
		line-height: 1;
		color: var(--bb-text-strong);
	}

	.counts {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.count {
		display: inline-flex;
		align-items: baseline;
		gap: 8px;
		padding: 10px 16px;
		border-radius: var(--r-control);
		background: var(--bb-ink);
		border: 1px solid var(--bb-line-soft);
		font-size: 14px;
		color: var(--bb-text-2);
	}

	.count .n {
		font-family: var(--font-display);
		font-size: 22px;
		color: var(--bb-text);
	}

	.label {
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--bb-text-2);
	}

	.notice {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		padding: 16px 20px;
		border-radius: var(--r-row);
		background: var(--bb-ink);
		border: 1px solid var(--bb-coral-line);
		color: var(--bb-coral-soft);
	}

	/* Books */
	.books {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.book-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(360px, 100%), 1fr));
		gap: 18px;
	}

	.skeleton {
		height: 212px;
		border-radius: var(--r-card);
		background: var(--bb-ink);
		border: 1px solid var(--bb-line-soft);
	}

	.book-card {
		display: flex;
		gap: 22px;
		padding: 20px;
		border-radius: var(--r-card);
		background: var(--bb-ink);
		border: 1px solid var(--bb-line-soft);
		text-decoration: none;
		color: var(--bb-text);
		transition: border-color 0.15s;
	}

	.book-card:hover {
		border-color: var(--bb-line-dashed);
		color: var(--bb-text);
	}

	.book-text {
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-width: 0;
		padding-top: 4px;
	}

	.book-title {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		overflow: hidden;
		font-family: var(--font-display);
		font-size: 28px;
		line-height: 1.05;
		overflow-wrap: break-word;
	}

	.book-desc {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		overflow: hidden;
		font-family: var(--font-read);
		font-style: italic;
		font-size: 17px;
		line-height: 1.45;
		color: var(--bb-text-2);
	}

	.book-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: auto;
	}

	.updated {
		padding: 4px 10px;
		font-size: 12.5px;
		color: var(--bb-text-4);
	}

	.new-book {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		min-height: 212px;
		padding: 20px;
		border-radius: var(--r-card);
		border: 1.5px dashed var(--bb-line-dashed);
		background: transparent;
		color: var(--bb-text-label);
		font-family: var(--font-ui);
		transition: border-color 0.15s;
	}

	.new-book:hover {
		border-color: var(--bb-sky);
	}

	.empty .new-book {
		grid-column: 1 / -1;
		min-height: 280px;
	}

	.plus {
		display: grid;
		place-items: center;
		width: 52px;
		height: 52px;
		border-radius: 50%;
		background: var(--bb-royal);
		color: #fff;
	}

	.new-title {
		font-family: var(--font-display);
		font-size: 24px;
		color: var(--bb-text);
	}

	.new-sub {
		font-size: 14px;
		color: var(--bb-text-3);
	}

	/* Parts and recent chapters */
	.lists {
		display: flex;
		flex-wrap: wrap;
		gap: 32px;
	}

	.list {
		flex: 1 1 480px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.list .label {
		margin-bottom: 4px;
	}

	.part-row {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 12px 16px 12px 12px;
		border-radius: var(--r-row);
		background: var(--bb-ink);
		border: 1px solid var(--bb-line-soft);
		text-decoration: none;
		color: var(--bb-text);
	}

	.part-row:hover,
	.recent-row:hover {
		background: var(--bb-hover);
		border-color: var(--bb-line-control);
		color: var(--bb-text);
	}

	.part-icon {
		flex: none;
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 10px;
		background: var(--bb-raised);
		color: var(--bb-sky);
	}

	.part-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.part-title {
		font-family: var(--font-display);
		font-size: 19px;
		overflow-wrap: anywhere;
	}

	.part-title em {
		font-family: var(--font-read);
		font-style: italic;
		color: var(--bb-text-2);
	}

	.part-book,
	.part-count {
		font-size: 13px;
		color: var(--bb-text-3);
	}

	.part-count {
		flex: none;
	}

	.recent {
		border-radius: 16px;
		background: var(--bb-ink);
		border: 1px solid var(--bb-line-soft);
		overflow: hidden;
	}

	.recent-row {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 16px;
		padding: 15px 18px;
		border-bottom: 1px solid var(--bb-line-faint);
		text-decoration: none;
		color: var(--bb-text);
	}

	.recent-row:last-child {
		border-bottom: none;
	}

	.num {
		width: 18px;
		font-family: var(--font-display);
		font-size: 16px;
		color: var(--bb-text-4);
	}

	.num.latest {
		color: var(--bb-sky);
	}

	.recent-title {
		flex: 1 1 200px;
		min-width: 0;
		font-family: var(--font-read);
		font-size: 18px;
	}

	.recent-meta {
		font-size: 13px;
		color: var(--bb-text-3);
	}

	.empty-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 16px;
		padding: 14px 16px 14px 20px;
		border-radius: var(--r-row);
		border: 1.5px dashed var(--bb-line);
		font-size: 15px;
		color: var(--bb-text-2);
	}

	@media (max-width: 600px) {
		.dash {
			padding: 28px 16px 0;
			gap: 32px;
		}

		.book-card {
			gap: 16px;
			padding: 16px;
		}

		.book-title {
			font-size: 24px;
		}

		.recent-meta {
			padding-left: 34px;
		}
	}
</style>
