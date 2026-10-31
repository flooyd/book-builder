<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import type { OutlinePart } from '$lib/library';
	import {
		TEXT_SIZES,
		type ReaderData,
		type ReaderPrefs,
		type ReadingPosition
	} from '$lib/reading';
	import { plainText } from '$lib/rich';
	import RichText from '$lib/components/rich/RichText.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import {
		buildPages,
		geometryFor,
		pageOf,
		positionOf,
		type BookItem,
		type BookLayout,
		type BookPage,
		type Geometry
	} from './book-layout';

	// Reading mode as a book: the cover opens on the title page, the text is set into pages
	// (book-layout.ts), and pages turn in 3D like the book on the home page. Click or tap a page,
	// swipe, use the arrows below or the keyboard (the Reader passes keys on) to turn.
	//
	// 3D: perspective is on .book; only a turning leaf is 3D, and nothing on a leaf may use
	// filter, opacity < 1 or overflow other than visible (those flatten preserve-3d).
	let {
		data,
		outline,
		prefs,
		facts,
		start = null,
		resume = null,
		onmove
	}: {
		data: ReaderData;
		outline: OutlinePart<ReaderData['parts'][number], ReaderData['chapters'][number]>[];
		prefs: ReaderPrefs;
		/** "3 parts · 12 chapters · …" for the title page. */
		facts: string;
		/** Open straight at this place (coming from the scroll view) instead of on the cover. */
		start?: ReadingPosition | null;
		/** Where the reader left off last time, offered on the title page. */
		resume?: (ReadingPosition & { label: string }) | null;
		/** After every turn: where the reader is now, and how far through the book. */
		onmove: (at: { position: ReadingPosition | null; progress: number }) => void;
	} = $props();

	// ---- What goes in the book ---------------------------------------------------------------
	type Flow = {
		key: string;
		over: string | null;
		title: string;
		description: string;
		editHref: string;
	};

	const plan = $derived.by(() => {
		const flows: Flow[] = [];
		const items: BookItem[] = [];
		outline.forEach((entry, index) => {
			if (entry.label) {
				items.push({ kind: 'part', key: `part-${entry.part.id}`, entry: index });
				for (const { chapter, number } of entry.chapters) {
					const key = `chapter-${chapter.id}`;
					items.push({ kind: 'text', key, flow: flows.length, title: chapter.title });
					flows.push({
						key,
						over: `Chapter ${number}`,
						title: chapter.title,
						description: chapter.description,
						editHref: resolve('/chapter/[id]', { id: String(chapter.id) })
					});
				}
			} else {
				const key = `part-${entry.part.id}`;
				items.push({ kind: 'text', key, flow: flows.length, title: entry.part.title });
				flows.push({
					key,
					over: null,
					title: entry.part.title,
					description: entry.part.description,
					editHref: resolve('/part/[id]', { id: String(entry.part.id) })
				});
			}
		});
		return { flows, items };
	});

	const bookHref = $derived(resolve('/book/[id]', { id: String(data.book.id) }));

	// ---- Layout --------------------------------------------------------------------------------
	let area = $state<HTMLElement>();
	let measureBox = $state<HTMLElement>();
	let geo = $state<Geometry | null>(null);
	let layout = $state<BookLayout>({ pages: [], startOf: {} });

	const single = $derived(geo?.single ?? false);
	const pages = $derived(layout.pages);
	/** Spreads in an open book, pages one at a time. */
	const count = $derived(single ? pages.length : Math.ceil(pages.length / 2));
	const viewOf = (page: number) => (single ? page : Math.floor(page / 2));

	const folioOf = (key: string) => {
		const start = layout.startOf[key];
		return start === undefined ? '' : String(pages[start].folio);
	};

	/** Sets the pages for the space there is, keeping the reader at `keep`. */
	async function measure(next: Geometry, keep: ReadingPosition | null) {
		turning = null;
		queued = null;
		geo = next;
		await tick();
		// Lay the copies out first so a typeface not used yet starts loading, then wait for it.
		void measureBox?.offsetHeight;
		await document.fonts.ready;
		if (!measureBox) return;
		const columnsOf = (flow: HTMLElement) =>
			Math.max(1, Math.round((flow.scrollWidth + next.gap) / (next.cw + next.gap)));
		const columns = [...measureBox.querySelectorAll<HTMLElement>('[data-flow]')].map(columnsOf);
		const contents = measureBox.querySelector<HTMLElement>('[data-contents]');
		layout = buildPages(
			plan.items,
			columns,
			contents ? columnsOf(contents) : 1,
			next.single,
			data.book.title
		);
		const page = keep ? pageOf(layout, keep) : null;
		at = page === null ? 0 : viewOf(page);
		report();
	}

	const geometryNow = () =>
		geometryFor(area?.clientWidth ?? 1024, area?.clientHeight ?? 768, TEXT_SIZES[prefs.size]);

	async function relayout(force = false) {
		if (!geo) return;
		const next = geometryNow();
		const same =
			next.single === geo.single &&
			next.pw === geo.pw &&
			next.ph === geo.ph &&
			next.font === geo.font;
		if (same && !force) return;
		await measure(next, position());
	}

	// A new text size or typeface sets the pages again.
	$effect(() => {
		void prefs.size;
		void prefs.face;
		untrack(() => relayout(true));
	});

	// ---- Turning -------------------------------------------------------------------------------
	/** A face: a page by index, the covers, or the blank back of a page (one at a time). */
	type Ref = number | 'cover' | 'inside' | 'reverse' | null;
	type Turn = {
		to: number;
		back: boolean;
		cover: boolean;
		left: Ref;
		right: Ref;
		front: Ref;
		rear: Ref;
	};

	/** The spread (open book) or page (one at a time) on show. */
	let at = $state(0);
	let turning = $state<Turn | null>(null);
	/** Where to go once the current turn lands (pressing again mid-turn). */
	let queued: number | null = null;
	/** Before the cover opens. */
	let closed = $state(true);
	let reduced = false;

	const shown = $derived.by((): { left: Ref; right: Ref } => {
		if (turning) return turning;
		if (closed) return { left: null, right: single ? at : 2 * at + 1 };
		return single ? { left: null, right: at } : { left: 2 * at, right: 2 * at + 1 };
	});

	// Both pages of a spread hold the whole chapter (each shows one column of it): screen readers
	// get it once, from the left page.
	const sameFlow = $derived.by(() => {
		if (typeof shown.left !== 'number' || typeof shown.right !== 'number') return false;
		const left = pages[shown.left];
		const right = pages[shown.right];
		return left?.kind === 'text' && right?.kind === 'text' && left.key === right.key;
	});

	function show(target: number, animate = true) {
		if (!geo || count === 0) return;
		target = Math.min(count - 1, Math.max(0, target));
		if (turning) {
			queued = target;
			return;
		}
		if (target === at) return;
		if (!animate || reduced || closed) {
			closed = false;
			at = target;
			report();
			return;
		}
		const back = target < at;
		turning = single
			? {
					to: target,
					back,
					cover: false,
					left: null,
					right: back ? at : target,
					front: back ? target : at,
					rear: 'reverse'
				}
			: back
				? {
						to: target,
						back,
						cover: false,
						left: 2 * target,
						right: 2 * at + 1,
						front: 2 * target + 1,
						rear: 2 * at
					}
				: {
						to: target,
						back,
						cover: false,
						left: 2 * at,
						right: 2 * target + 1,
						front: 2 * at + 1,
						rear: 2 * target
					};
	}

	function landed(event: AnimationEvent) {
		if (event.target !== event.currentTarget || !turning) return;
		at = turning.to;
		turning = null;
		report();
		if (queued !== null) {
			const next = queued;
			queued = null;
			show(next);
		}
	}

	function open() {
		closed = false;
		if (reduced) return;
		turning = {
			to: at,
			back: false,
			cover: true,
			left: null,
			right: single ? at : 2 * at + 1,
			front: 'cover',
			rear: 'inside'
		};
	}

	/** Turn one page (spread) on or back. */
	export function step(direction: 1 | -1) {
		show((queued ?? turning?.to ?? at) + direction);
	}

	/** The first or the last page. */
	export function edge(last: boolean) {
		show(last ? count - 1 : 0);
	}

	/** Turn to a part or chapter. */
	export function goTo(key: string) {
		const page = layout.startOf[key];
		if (page !== undefined) show(viewOf(page));
	}

	function goToPosition(position: ReadingPosition) {
		const page = pageOf(layout, position);
		if (page !== null) show(viewOf(page));
	}

	/** Where the reader is: the page of story on show, or null around the story. */
	export function position(): ReadingPosition | null {
		if (!geo) return start;
		const view = turning?.to ?? at;
		if (single) return positionOf(pages[view]);
		const left = pages[2 * view];
		const right = pages[2 * view + 1];
		// A chapter opening on the right is where the reader is headed, not the end on the left.
		const opens = (page: BookPage | undefined) =>
			page?.kind === 'part' || (page?.kind === 'text' && page.column === 0);
		if (opens(right) && !opens(left)) return positionOf(right);
		return positionOf(left) ?? positionOf(right);
	}

	function report() {
		onmove({ position: position(), progress: count > 1 ? at / (count - 1) : 1 });
	}

	// ---- Clicks and swipes -----------------------------------------------------------------------
	let book = $state<HTMLElement>();
	let press: { x: number; y: number; touch: boolean } | null = null;

	function onpointerdown(event: PointerEvent) {
		if (event.button !== 0) return;
		press = { x: event.clientX, y: event.clientY, touch: event.pointerType !== 'mouse' };
	}

	function onpointerup(event: PointerEvent) {
		if (!press || !book) return;
		const dx = event.clientX - press.x;
		const dy = event.clientY - press.y;
		const touch = press.touch;
		press = null;
		// A swipe turns the way the finger goes; a mouse drag is selecting text.
		if (touch && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
			step(dx < 0 ? 1 : -1);
			return;
		}
		if (Math.hypot(dx, dy) > 6) return;
		if ((event.target as Element).closest('a, button, input')) return;
		if (getSelection()?.toString()) return;
		const rect = book.getBoundingClientRect();
		const x = (event.clientX - rect.left) / rect.width;
		step(x < (single ? 0.3 : 0.5) ? -1 : 1);
	}

	// ---- Labels --------------------------------------------------------------------------------
	const pageLabel = $derived.by(() => {
		if (pages.length === 0) return '';
		const view = turning?.to ?? at;
		const visible = (single ? [pages[view]] : [pages[2 * view], pages[2 * view + 1]]).filter(
			(page) => page && page.kind !== 'endpaper'
		);
		const total = pages.filter((page) => page.kind !== 'endpaper').length;
		const numbers = visible.map((page) => page.folio).join('–');
		return `${numbers} of ${total}`;
	});

	/** Paper edges beside each page: thicker on the side of the book you have more of. */
	function stack(depth: number, side: -1 | 1) {
		const tones = ['#e4dccb', '#f2ecdf', '#dcd2be', '#efe8da', '#d2c7b1', '#e8e0cf'];
		return Array.from(
			{ length: depth },
			(_, i) => `${side * (i + 1)}px ${(i + 1) * 0.5}px 0 ${tones[i % tones.length]}`
		).join(', ');
	}
	const progress = $derived(count > 1 ? (turning?.to ?? at) / (count - 1) : 0);

	onMount(() => {
		reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		let timer = 0;
		const observer = new ResizeObserver(() => {
			clearTimeout(timer);
			timer = window.setTimeout(() => relayout(), 150);
		});
		// A typeface that arrives after measuring changes how much fits on a page.
		const fontsLoaded = () => {
			clearTimeout(timer);
			timer = window.setTimeout(() => relayout(true), 150);
		};
		document.fonts.addEventListener('loadingdone', fontsLoaded);
		let gone = false;
		(async () => {
			await measure(geometryNow(), start);
			if (gone) return;
			if (start) {
				closed = false;
			} else {
				// A moment on the closed cover before it opens.
				await new Promise((done) => setTimeout(done, reduced ? 0 : 450));
				if (!gone) open();
			}
			if (area) observer.observe(area);
		})();
		return () => {
			gone = true;
			observer.disconnect();
			document.fonts.removeEventListener('loadingdone', fontsLoaded);
			clearTimeout(timer);
		};
	});
</script>

{#snippet ornament()}
	<svg class="ornament" width="64" height="10" viewBox="0 0 64 10" aria-hidden="true"
		><path class="rule" d="M0 5h24M40 5h24" /><path class="diamond" d="M32 0l5 5-5 5-5-5z" /></svg
	>
{/snippet}

{#snippet contentsFlow()}
	<h2 class="contents-title">Contents</h2>
	<ol class="toc">
		{#each outline as entry (entry.part.id)}
			{@const key = `part-${entry.part.id}`}
			<li class="toc-part">
				<a
					href="#{key}"
					onclick={(event) => {
						event.preventDefault();
						goTo(key);
					}}
				>
					{#if entry.label}<span class="toc-label">{entry.label}</span>{/if}
					<span class="toc-title">{entry.part.title}</span>
					<span class="toc-dots"></span>
					<span class="toc-folio">{folioOf(key)}</span>
				</a>
				{#if entry.chapters.length > 0}
					<ol>
						{#each entry.chapters as { chapter, number } (chapter.id)}
							{@const chapterKey = `chapter-${chapter.id}`}
							<li>
								<a
									href="#{chapterKey}"
									onclick={(event) => {
										event.preventDefault();
										goTo(chapterKey);
									}}
								>
									<span class="toc-num">{number}</span>
									<span class="toc-title">{chapter.title}</span>
									<span class="toc-dots"></span>
									<span class="toc-folio">{folioOf(chapterKey)}</span>
								</a>
							</li>
						{/each}
					</ol>
				{/if}
			</li>
		{/each}
	</ol>
{/snippet}

{#snippet flowContent(flow: Flow)}
	{@const text = data.texts[flow.key] ?? ''}
	<header class="opener">
		{#if flow.over}<span class="opener-over">{flow.over}</span>{/if}
		<h2 class="opener-title">{flow.title}</h2>
		{#if flow.description}
			<p class="opener-sub"><RichText value={flow.description} italic /></p>
		{/if}
	</header>
	{#if plainText(text).trim()}
		<RichText value={text} kind="story" class="prose" />
	{:else}
		<p class="no-text">
			No story text yet.
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- editHref is resolve()d -->
			{#if data.owner}<a href={flow.editHref}>Write it</a>{/if}
		</p>
	{/if}
{/snippet}

<!-- One face of a sheet. `side` is where it lies when the book is open flat. -->
{#snippet face(ref: Ref, side: 'left' | 'right')}
	{#if ref === 'cover'}
		<div class="cover-face">
			<span class="cover-frame"></span>
			<span class="cover-over">{data.author}</span>
			<span class="cover-title">{data.book.title}</span>
			<svg width="52" height="10" viewBox="0 0 52 10" aria-hidden="true"
				><path d="M0 5h19M33 5h19" stroke="#7CB4FF" stroke-width="1" /><path
					d="M26 0l5 5-5 5-5-5z"
					fill="#7CB4FF"
				/></svg
			>
		</div>
	{:else if ref === 'inside'}
		<div class="inside-face"><div class="sheet left endpaper inset"></div></div>
	{:else if ref === 'reverse'}
		<div class="sheet {side} reverse"></div>
	{:else if typeof ref === 'number' && pages[ref]}
		{@const page = pages[ref]}
		<div class="sheet {side}" class:endpaper={page.kind === 'endpaper'}>
			{#if page.head}<p class="head">{page.head}</p>{/if}
			<div class="block">
				{#if page.kind === 'text'}
					<div class="clip">
						<div
							class="flow"
							style:transform="translateX({-page.column * ((geo?.cw ?? 0) + (geo?.gap ?? 0))}px)"
						>
							{@render flowContent(plan.flows[page.flow])}
						</div>
					</div>
				{:else if page.kind === 'contents'}
					<div class="clip">
						<div
							class="flow"
							style:transform="translateX({-page.column * ((geo?.cw ?? 0) + (geo?.gap ?? 0))}px)"
						>
							{@render contentsFlow()}
						</div>
					</div>
				{:else if page.kind === 'title'}
					<div class="centered title-page">
						<h1 class="tp-title">{data.book.title}</h1>
						{#if data.author}
							<p class="tp-by">
								{#if data.authorHandle}<a
										href={resolve('/author/[handle]', { handle: data.authorHandle })}
										>{data.author}</a
									>{:else}{data.author}{/if}
							</p>
						{/if}
						{@render ornament()}
						{#if data.book.description}
							<p class="tp-blurb"><RichText value={data.book.description} italic /></p>
						{/if}
						<p class="tp-facts">{facts}</p>
						{#if plan.items.length > 0}
							<div class="tp-actions">
								<button
									type="button"
									class="paper-button primary"
									onclick={() => goTo(plan.items[0].key)}
								>
									Start reading<Icon name="arrow-right" size={15} />
								</button>
								{#if resume}
									{@const saved = resume}
									<button type="button" class="paper-button" onclick={() => goToPosition(saved)}>
										Continue · {saved.label}
									</button>
								{/if}
							</div>
						{/if}
					</div>
				{:else if page.kind === 'part'}
					{@const entry = outline[page.entry]}
					<div class="centered part-page">
						<span class="part-over">{entry.label}</span>
						<h2 class="part-title">{entry.part.title}</h2>
						{#if entry.part.description}
							<p class="part-sub"><RichText value={entry.part.description} italic /></p>
						{/if}
						{@render ornament()}
					</div>
				{:else if page.kind === 'end'}
					<div class="centered end-page">
						{@render ornament()}
						<p class="the-end">The End</p>
						<div class="tp-actions">
							{#if data.owner}<a class="paper-button" href={bookHref}>Back to the book</a>{/if}
							<button type="button" class="paper-button" onclick={() => show(0)}>
								Back to the start
							</button>
						</div>
						{#if !data.owner}
							<p class="made">Written with <a href={resolve('/')}>Book Builder</a></p>
						{/if}
					</div>
				{:else if page.kind === 'empty'}
					<div class="centered">
						<p class="no-text">
							There's nothing to read yet.
							{#if data.owner}<a href={bookHref}>Add parts and chapters</a> first.{/if}
						</p>
					</div>
				{/if}
			</div>
			{#if page.printFolio}<p class="folio">{page.folio}</p>{/if}
		</div>
	{/if}
{/snippet}

<div
	class="area"
	class:sans={prefs.face === 'sans'}
	bind:this={area}
	style:--pw="{geo?.pw ?? 0}px"
	style:--ph="{geo?.ph ?? 0}px"
	style:--pad-x="{geo?.padX ?? 0}px"
	style:--pad-top="{geo?.padTop ?? 0}px"
	style:--pad-bottom="{geo?.padBottom ?? 0}px"
	style:--cw="{geo?.cw ?? 0}px"
	style:--ch="{geo?.ch ?? 0}px"
	style:--gap="{geo?.gap ?? 0}px"
	style:--font="{geo?.font ?? 16}px"
	style:--o="{geo?.overhang ?? 8}px"
	style:--spine-x={single ? '0px' : `${geo?.pw ?? 0}px`}
>
	{#if geo}
		<!-- data-scheme: the pages are paper in either theme. Clicking a page turns it; the
		     buttons below and the arrow keys do the same. -->
		<div
			class="book"
			class:single
			class:closed
			bind:this={book}
			data-scheme="light"
			role="region"
			aria-roledescription="book"
			aria-label={data.book.title}
			{onpointerdown}
			{onpointerup}
		>
			<div class="board" class:shut={closed || turning?.cover}></div>
			{#if shown.left !== null}
				<div class="page left" style:box-shadow={stack(Math.round(1 + progress * 5), -1)}>
					{@render face(shown.left, 'left')}
				</div>
			{/if}
			<div
				class="page right"
				style:box-shadow={stack(Math.round(1 + (1 - progress) * 5), 1)}
				aria-hidden={sameFlow ? 'true' : undefined}
			>
				{@render face(shown.right, 'right')}
			</div>

			{#if turning && !turning.cover}
				<div
					class="leaf"
					class:back={turning.back}
					onanimationend={landed}
					aria-hidden="true"
					inert
				>
					<div class="side front">
						{@render face(turning.front, 'right')}<span class="shade"></span>
					</div>
					<div class="side rear">
						{@render face(turning.rear, single ? 'right' : 'left')}<span class="shade"></span>
					</div>
				</div>
			{/if}

			{#if closed || turning?.cover}
				<div
					class="leaf cover-leaf"
					class:turning={turning?.cover}
					onanimationend={landed}
					aria-hidden="true"
					inert
				>
					<div class="side front">{@render face('cover', 'right')}<span class="shade"></span></div>
					<div class="side rear">{@render face('inside', 'left')}<span class="shade"></span></div>
				</div>
			{/if}
		</div>

		<!-- Hidden copies of every flow, set at page size, to count their pages. -->
		<div class="measure" bind:this={measureBox} data-scheme="light" aria-hidden="true" inert>
			<div class="flow" data-contents>{@render contentsFlow()}</div>
			{#each plan.flows as flow (flow.key)}
				<div class="flow" data-flow>{@render flowContent(flow)}</div>
			{/each}
		</div>
	{/if}
</div>

<div class="controls">
	<button
		type="button"
		class="nav"
		aria-label={single ? 'Previous page' : 'Previous pages'}
		disabled={!geo || (turning?.to ?? at) === 0}
		onclick={() => step(-1)}
	>
		<Icon name="chevron-left" size={20} />
	</button>
	<input
		class="scrub"
		type="range"
		min="0"
		max={Math.max(0, count - 1)}
		step="1"
		value={turning?.to ?? at}
		disabled={!geo}
		aria-label="Page"
		aria-valuetext={pageLabel}
		oninput={(event) => show(Number(event.currentTarget.value), false)}
	/>
	<span class="page-label" aria-hidden="true">{pageLabel}</span>
	<button
		type="button"
		class="nav"
		aria-label={single ? 'Next page' : 'Next pages'}
		disabled={!geo || (turning?.to ?? at) >= count - 1}
		onclick={() => step(1)}
	>
		<Icon name="chevron-right" size={20} />
	</button>
	<p class="sr-only" aria-live="polite">{pageLabel ? `Page ${pageLabel}` : ''}</p>
</div>

<style>
	/* ---- The space and the book ---- */
	.area {
		/* Paper, a touch dimmer at night. Worked out here, outside the pinned light scheme. */
		--paper: light-dark(#f5f0e6, #e9e1d0);
		--reader-face: var(--font-read);
		position: relative;
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: clip;
		touch-action: pinch-zoom;
	}

	.area.sans {
		--reader-face: var(--font-ui);
	}

	.book {
		position: relative;
		width: calc(2 * var(--pw));
		height: var(--ph);
		perspective: 2600px;
		font-size: var(--font);
		color: var(--bb-text-read);
		transition: transform 1.1s cubic-bezier(0.45, 0.05, 0.3, 1);
	}

	.book.single {
		width: var(--pw);
		perspective: 1800px;
	}

	/* Shut, the book sits centred on its right half. */
	.book.closed:not(.single) {
		transform: translateX(calc(var(--pw) / -2));
	}

	.board {
		position: absolute;
		left: calc(-1 * var(--o));
		top: calc(-1 * var(--o));
		width: calc(2 * var(--pw) + 2 * var(--o));
		height: calc(var(--ph) + 2 * var(--o));
		border-radius: 6px;
		background: linear-gradient(
			90deg,
			#142463 0%,
			#1d3184 47%,
			#0c1748 50%,
			#1d3184 53%,
			#142463 100%
		);
		box-shadow:
			0 50px 90px -40px var(--bb-drop),
			0 0 0 1px rgba(124, 180, 255, 0.3);
	}

	.board.shut {
		clip-path: inset(0 0 0 50%);
	}

	.single .board {
		left: -4px;
		width: calc(var(--pw) + var(--o) + 4px);
		background: linear-gradient(90deg, #0c1748 0, #1d3184 10px, #142463 100%);
		clip-path: none;
	}

	.page {
		position: absolute;
		top: 0;
		width: var(--pw);
		height: var(--ph);
	}

	.page.left {
		left: 0;
	}

	.page.right {
		left: var(--spine-x);
	}

	/* ---- A sheet of paper ---- */
	.sheet {
		position: absolute;
		inset: 0;
		overflow: clip;
		background-color: var(--paper);
		cursor: default;
	}

	/* Shade into the spine. */
	.sheet.left {
		background-image: linear-gradient(
			to left,
			rgba(60, 40, 10, 0.24),
			rgba(60, 40, 10, 0.06) 6%,
			rgba(60, 40, 10, 0) 15%
		);
	}

	.sheet.right {
		background-image: linear-gradient(
			to right,
			rgba(60, 40, 10, 0.24),
			rgba(60, 40, 10, 0.06) 6%,
			rgba(60, 40, 10, 0) 15%
		);
	}

	.single .sheet.right {
		background-image: linear-gradient(
			to right,
			rgba(60, 40, 10, 0.16),
			rgba(60, 40, 10, 0.04) 4%,
			rgba(60, 40, 10, 0) 10%
		);
	}

	.sheet.reverse {
		background-color: #ece5d6;
	}

	/* Endpapers: a pattern of small diamonds. */
	.sheet.endpaper {
		background-color: #dfe5f3;
		background-image:
			linear-gradient(to left, rgba(20, 30, 70, 0.22), rgba(20, 30, 70, 0) 15%),
			url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='22'%3E%3Cpath d='M11 7l4 4-4 4-4-4z' fill='%231d3184' fill-opacity='0.16'/%3E%3C/svg%3E");
	}

	.inside-face {
		position: absolute;
		inset: 0;
		border-radius: 6px;
		background: #1d3184;
	}

	/* The pasted-down endpaper on the inside of the front cover. */
	.sheet.inset {
		inset: var(--o) 0 var(--o) var(--o);
	}

	.head,
	.folio {
		position: absolute;
		left: var(--pad-x);
		right: var(--pad-x);
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0;
		font-family: var(--font-ui);
		font-weight: 600;
		color: #8c836f;
		white-space: nowrap;
		overflow: hidden;
	}

	.head {
		top: 0;
		height: var(--pad-top);
		font-size: max(9px, 0.56em);
		letter-spacing: 0.28em;
		text-transform: uppercase;
	}

	.folio {
		bottom: 0;
		height: var(--pad-bottom);
		font-size: max(10px, 0.62em);
		letter-spacing: 0.12em;
	}

	.block {
		position: absolute;
		left: var(--pad-x);
		top: var(--pad-top);
		width: var(--cw);
		height: var(--ch);
	}

	/* clip, not hidden: focus must not scroll the page sideways out of its column. */
	.clip {
		width: 100%;
		height: 100%;
		overflow: clip;
	}

	/* ---- Flows: a part or chapter set in page-wide columns ---- */
	.flow {
		width: var(--cw);
		height: var(--ch);
		column-width: var(--cw);
		column-gap: var(--gap);
		column-fill: auto;
		font-family: var(--reader-face);
	}

	.flow :global(.bb-prose p) {
		orphans: 2;
		widows: 2;
	}

	.flow :global(.bb-prose :is(h4, h5, h6)) {
		break-after: avoid;
	}

	.opener {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4em;
		padding-top: calc(var(--ch) * 0.1);
		margin-bottom: 2em;
		text-align: center;
		break-inside: avoid;
	}

	.opener-over,
	.part-over {
		font-family: var(--font-ui);
		font-size: 0.62em;
		font-weight: 700;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: var(--bb-sky);
	}

	.opener-title {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.9em;
		line-height: 1.1;
		color: var(--bb-text-strong);
		text-wrap: balance;
	}

	.opener-sub,
	.part-sub,
	.tp-blurb {
		font-family: var(--font-read);
		font-style: italic;
		line-height: 1.45;
		color: var(--bb-text-desc);
		text-wrap: balance;
	}

	.no-text {
		text-align: center;
		font-family: var(--font-read);
		font-style: italic;
		color: var(--bb-text-3);
	}

	.no-text a,
	.made a,
	.tp-by a {
		color: inherit;
		text-underline-offset: 3px;
	}

	/* ---- Contents ---- */
	.contents-title {
		margin-bottom: 1.1em;
		text-align: center;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.6em;
		color: var(--bb-text-strong);
	}

	.toc,
	.toc ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.toc-part {
		break-inside: avoid-column;
	}

	.toc-part + .toc-part {
		margin-top: 0.7em;
	}

	.toc a {
		display: flex;
		align-items: baseline;
		gap: 0.5em;
		padding: 0.18em 0;
		color: var(--bb-text);
		text-decoration: none;
		break-inside: avoid;
	}

	.toc a:hover .toc-title {
		color: var(--bb-sky);
	}

	.toc-label {
		flex: none;
		font-family: var(--font-ui);
		font-size: 0.6em;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--bb-sky);
	}

	.toc-num {
		flex: none;
		width: 1.6em;
		text-align: right;
		font-family: var(--font-display);
		font-size: 0.85em;
		color: var(--bb-text-4);
	}

	.toc-title {
		min-width: 0;
		font-size: 0.95em;
		overflow-wrap: break-word;
	}

	.toc-part > a .toc-title {
		font-family: var(--font-display);
		font-size: 1.1em;
	}

	.toc-dots {
		flex: 1;
		min-width: 1em;
		border-bottom: 1px dotted #b8aa8e;
		transform: translateY(-0.3em);
	}

	.toc-folio {
		flex: none;
		width: 2.4em;
		text-align: right;
		font-family: var(--font-ui);
		font-size: 0.75em;
		color: var(--bb-text-3);
		font-variant-numeric: tabular-nums;
	}

	/* ---- Pages set on their own: title, part, end ---- */
	.centered {
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.9em;
		text-align: center;
		overflow: clip;
	}

	.tp-title {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 2.6em;
		line-height: 1.02;
		letter-spacing: -0.01em;
		color: var(--bb-text-strong);
		text-wrap: balance;
		overflow-wrap: break-word;
		max-width: 100%;
	}

	.tp-by {
		font-family: var(--font-ui);
		font-size: 0.66em;
		font-weight: 700;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: var(--bb-text-3);
	}

	.tp-blurb {
		max-width: 22em;
		font-size: 0.95em;
	}

	.tp-facts {
		font-family: var(--font-ui);
		font-size: 0.66em;
		color: var(--bb-text-3);
	}

	.tp-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5em;
		margin-top: 0.4em;
	}

	.paper-button {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 40px;
		padding: 0 16px;
		border: 1px solid #b8aa8e;
		border-radius: 10px;
		background: transparent;
		color: #24232b;
		font: 600 max(13px, 0.72em) var(--font-ui);
		text-decoration: none;
		cursor: pointer;
	}

	.paper-button:hover {
		background: rgba(60, 40, 10, 0.06);
	}

	.paper-button.primary {
		border-color: #2b63f5;
		background: #2b63f5;
		color: #fff;
	}

	.paper-button.primary:hover {
		background: #1f54e3;
	}

	.part-title {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 2.4em;
		line-height: 1.04;
		color: var(--bb-text-strong);
		text-wrap: balance;
	}

	.the-end {
		font-family: var(--font-read);
		font-style: italic;
		font-size: 1.5em;
		color: var(--bb-text-desc);
	}

	.made {
		font-family: var(--font-ui);
		font-size: 0.66em;
		color: var(--bb-text-3);
	}

	.ornament {
		flex: none;
	}

	.ornament .rule {
		stroke: #b8aa8e;
		stroke-width: 1;
	}

	.ornament .diamond {
		fill: var(--bb-sky);
	}

	/* ---- The cover ---- */
	.cover-face {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		padding: 12% 10% 10% 14%;
		border-radius: 3px 8px 8px 3px;
		background:
			radial-gradient(120% 80% at 70% 20%, rgba(124, 180, 255, 0.16), rgba(124, 180, 255, 0) 60%),
			#1d3184;
		box-shadow: inset 12px 0 0 rgba(0, 0, 0, 0.25);
		text-align: center;
		font-size: var(--font);
	}

	.cover-frame {
		position: absolute;
		inset: 3.5% 3.5% 3.5% 7%;
		border: 1px solid rgba(124, 180, 255, 0.4);
		border-radius: 3px;
	}

	.cover-over {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-ui);
		font-size: 0.62em;
		font-weight: 700;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		color: #a9c8ff;
	}

	.cover-title {
		font-family: var(--font-display);
		font-size: calc(var(--pw) * 0.11);
		line-height: 1.02;
		color: #fff;
		text-wrap: balance;
		overflow-wrap: break-word;
		max-width: 100%;
	}

	/* ---- Turning ---- */
	.leaf {
		position: absolute;
		top: 0;
		left: var(--spine-x);
		width: var(--pw);
		height: var(--ph);
		z-index: 2;
		transform-origin: 0 50%;
		transform-style: preserve-3d;
		animation: turn 0.75s cubic-bezier(0.45, 0.05, 0.3, 1) both;
	}

	.leaf.back,
	.leaf.back .shade {
		animation-direction: reverse;
	}

	.cover-leaf {
		top: calc(-1 * var(--o));
		width: calc(var(--pw) + var(--o));
		height: calc(var(--ph) + 2 * var(--o));
		animation: none;
	}

	.cover-leaf.turning {
		animation: turn 1.1s cubic-bezier(0.45, 0.05, 0.3, 1) both;
	}

	.side {
		position: absolute;
		inset: 0;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
	}

	.side.rear {
		transform: rotateY(180deg);
	}

	/* Light falls away from a lifting page. */
	.shade {
		position: absolute;
		inset: 0;
		pointer-events: none;
		opacity: 0;
	}

	.front .shade {
		background: linear-gradient(to left, rgba(30, 20, 0, 0.3), rgba(30, 20, 0, 0) 75%);
		animation: shade-in 0.75s ease-in both;
	}

	.rear .shade {
		background: linear-gradient(to right, rgba(30, 20, 0, 0.3), rgba(30, 20, 0, 0) 75%);
		animation: shade-out 0.75s ease-out both;
	}

	.cover-leaf .shade {
		animation: none;
	}

	@keyframes turn {
		from {
			transform: rotateY(0deg);
		}
		to {
			transform: rotateY(-180deg);
		}
	}

	@keyframes shade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes shade-out {
		from {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}

	/* ---- Measuring ---- */
	.measure {
		position: absolute;
		left: 0;
		top: 0;
		visibility: hidden;
		pointer-events: none;
		font-size: var(--font);
		color: var(--bb-text-read);
	}

	.measure .flow {
		overflow: hidden;
	}

	/* ---- Controls under the book ---- */
	.controls {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 6px 16px 12px;
	}

	.nav {
		display: inline-grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: none;
		border-radius: 50%;
		background: transparent;
		color: var(--bb-text-label);
	}

	.nav:hover:not(:disabled) {
		background: var(--bb-line-faint);
		color: var(--bb-text-strong);
	}

	.nav:disabled {
		opacity: 0.35;
	}

	.scrub {
		width: min(360px, 45vw);
		accent-color: var(--bb-royal);
	}

	.page-label {
		min-width: 9ch;
		font-size: 13.5px;
		color: var(--bb-text-3);
		font-variant-numeric: tabular-nums;
	}

	@media (max-width: 600px) {
		.controls {
			gap: 6px;
			padding: 2px 8px 8px;
		}

		.scrub {
			width: auto;
			flex: 1;
		}
	}
</style>
