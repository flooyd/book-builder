<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { bookOutline, plural } from '$lib/library';
	import { countWords } from '$lib/story-text.svelte';
	import {
		DEFAULT_PREFS,
		TEXT_SIZES,
		readingTime,
		saveReaderPrefs,
		toBlocks,
		type ReaderData,
		type ReaderPrefs
	} from '$lib/reading';
	import BookCover from '$lib/components/ui/BookCover.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';
	import Wordmark from '$lib/components/ui/Wordmark.svelte';

	// Reading mode: the whole book typeset on one page (title page, contents, then every part and
	// chapter in order), with a bar that slides away while reading, a progress line, text
	// settings, and the reading position remembered per book.
	let { data }: { data: ReaderData } = $props();

	const outline = $derived(bookOutline(data.book.id, data.parts, data.chapters));
	const chapterCount = $derived(outline.reduce((sum, entry) => sum + entry.chapters.length, 0));
	const words = $derived(
		Object.values(data.texts).reduce((sum, text) => sum + countWords(text), 0)
	);

	// Every part and chapter in reading order, with its anchor (the element's id).
	type Section = { key: string; overline: string | null; title: string };
	const sections = $derived<Section[]>(
		outline.flatMap((entry): Section[] =>
			entry.label
				? [
						{ key: `part-${entry.part.id}`, overline: entry.label, title: entry.part.title },
						...entry.chapters.map(({ chapter, number }) => ({
							key: `chapter-${chapter.id}`,
							overline: `Chapter ${number}`,
							title: chapter.title
						}))
					]
				: [{ key: `part-${entry.part.id}`, overline: null, title: entry.part.title }]
		)
	);
	const labelOf = (section: Section) =>
		section.overline ? `${section.overline} · ${section.title}` : section.title;

	const bookHref = $derived(resolve('/book/[id]', { id: String(data.book.id) }));

	// ---- Text settings -----------------------------------------------------------------------
	// The cookie's settings as of this page load; after that, these are the source of truth.
	// svelte-ignore state_referenced_locally
	let prefs = $state<ReaderPrefs>({ ...data.prefs });
	let settingsOpen = $state(false);

	async function setPrefs(next: Partial<ReaderPrefs>) {
		// Keep the reader on the same line while the text reflows.
		const at = position();
		prefs = { ...prefs, ...next };
		saveReaderPrefs(prefs);
		await tick();
		if (at) restore(at);
	}

	const sizePercent = $derived(
		Math.round((TEXT_SIZES[prefs.size] / TEXT_SIZES[DEFAULT_PREFS.size]) * 100)
	);

	// ---- Where the reader is -----------------------------------------------------------------
	/** The reading line, as a fraction of the viewport height from the top. */
	const READING_LINE = 0.3;

	let elements: HTMLElement[] = [];
	let current = $state(-1); // index into sections; -1 on the title page and contents
	let progress = $state(0);
	let barHidden = $state(false);
	let contentsOpen = $state(false);
	let lastY = 0;
	let frame = 0;

	type Position = { key: string; fraction: number };

	/** The section under the reading line, and how far through it the line is. */
	function position(): Position | null {
		const element = elements[current];
		if (!element) return null;
		const rect = element.getBoundingClientRect();
		const fraction = (innerHeight * READING_LINE - rect.top) / rect.height;
		return { key: sections[current].key, fraction: Math.min(1, Math.max(0, fraction)) };
	}

	function restore(at: Position, behavior: ScrollBehavior = 'instant') {
		const element = document.getElementById(at.key);
		if (!element) return;
		if (at.fraction < 0.01) {
			element.scrollIntoView({ behavior });
			return;
		}
		const top = element.getBoundingClientRect().top + scrollY;
		scrollTo({
			top: top + at.fraction * element.offsetHeight - innerHeight * READING_LINE,
			behavior
		});
	}

	function measure() {
		frame = 0;
		const y = scrollY;
		const max = document.documentElement.scrollHeight - innerHeight;
		progress = max > 0 ? Math.min(1, Math.max(0, y / max)) : 1;

		// Slide the bar away while reading down; bring it back on any scroll up.
		if (Math.abs(y - lastY) > 8) {
			barHidden = y > lastY && y > 160;
			lastY = y;
		}

		const line = innerHeight * READING_LINE;
		let index = -1;
		for (let i = 0; i < elements.length; i++) {
			if (elements[i].getBoundingClientRect().top > line) break;
			index = i;
		}
		current = index;
		remember();
	}

	const onscroll = () => {
		frame ||= requestAnimationFrame(measure);
	};

	// ---- Remembering the position ------------------------------------------------------------
	const storageKey = $derived(`bb-reading-${data.book.id}`);
	let savedAt = 0;

	function remember(force = false) {
		const now = performance.now();
		if (!force && now - savedAt < 1000) return;
		savedAt = now;
		const at = position();
		if (!at) return;
		try {
			localStorage.setItem(storageKey, JSON.stringify(at));
		} catch {
			// storage unavailable: the position lasts for this visit
		}
	}

	/** Where the reader left off last time, offered on the title page. */
	let resume = $state<(Position & { label: string }) | null>(null);

	function readSaved() {
		try {
			const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
			const index = sections.findIndex((section) => section.key === saved?.key);
			if (index < 0 || typeof saved.fraction !== 'number') return null;
			// Not worth offering the very start of the book.
			if (index === 0 && saved.fraction < 0.05) return null;
			return { key: saved.key, fraction: saved.fraction, label: labelOf(sections[index]) };
		} catch {
			return null;
		}
	}

	// ---- Keyboard: ← → move between parts and chapters ---------------------------------------
	function onkeydown(event: KeyboardEvent) {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
			return;
		if (contentsOpen || settingsOpen) return;
		if ((event.target as Element).closest('input, textarea, select, [contenteditable]')) return;
		event.preventDefault();
		step(event.key === 'ArrowRight' ? 1 : -1);
	}

	function step(direction: 1 | -1) {
		const smooth: ScrollBehavior = matchMedia('(prefers-reduced-motion: reduce)').matches
			? 'instant'
			: 'smooth';
		// Back from inside a section goes to its start first.
		const inside = current >= 0 && elements[current].getBoundingClientRect().top < -40;
		const target = direction > 0 ? current + 1 : inside ? current : current - 1;
		if (target < 0) scrollTo({ top: 0, behavior: smooth });
		else elements[Math.min(target, elements.length - 1)]?.scrollIntoView({ behavior: smooth });
	}

	onMount(() => {
		elements = sections
			.map((section) => document.getElementById(section.key))
			.filter((element) => element !== null);
		resume = readSaved();
		measure();

		const leave = () => remember(true);
		addEventListener('pagehide', leave);
		return () => {
			removeEventListener('pagehide', leave);
			cancelAnimationFrame(frame);
			remember(true);
		};
	});
</script>

<svelte:head>
	<title>{data.book.title}{data.author ? ` by ${data.author}` : ''} · Book Builder</title>
	{#if data.book.description}
		<meta name="description" content={data.book.description} />
	{/if}
</svelte:head>

<svelte:window {onscroll} onresize={onscroll} {onkeydown} />

{#snippet ornament()}
	<svg class="ornament" width="64" height="10" viewBox="0 0 64 10" aria-hidden="true"
		><path class="rule" d="M0 5h24M40 5h24" /><path class="diamond" d="M32 0l5 5-5 5-5-5z" /></svg
	>
{/snippet}

{#snippet contents(inDialog: boolean)}
	<ol class="toc">
		{#each outline as entry (entry.part.id)}
			{@const partKey = `part-${entry.part.id}`}
			<li class={entry.label ? 'toc-part' : 'toc-story'}>
				<a
					href="#{partKey}"
					aria-current={inDialog && sections[current]?.key === partKey ? 'location' : undefined}
					onclick={() => (contentsOpen = false)}
				>
					{#if entry.label}<span class="toc-over">{entry.label}</span>{/if}
					<span class="toc-title">{entry.part.title}</span>
				</a>
				{#if entry.chapters.length > 0}
					<ol>
						{#each entry.chapters as { chapter, number } (chapter.id)}
							{@const key = `chapter-${chapter.id}`}
							<li>
								<a
									href="#{key}"
									aria-current={inDialog && sections[current]?.key === key ? 'location' : undefined}
									onclick={() => (contentsOpen = false)}
								>
									<span class="toc-num">{number}</span>
									<span class="toc-title">{chapter.title}</span>
								</a>
							</li>
						{/each}
					</ol>
				{/if}
			</li>
		{/each}
	</ol>
{/snippet}

{#snippet prose(key: string, editHref: string)}
	{@const blocks = toBlocks(data.texts[key] ?? '')}
	{#if blocks.length > 0}
		<div class="prose">
			{#each blocks as block, i (i)}
				{#if block.kind === 'break'}
					<div class="scene-break" role="separator">{@render ornament()}</div>
				{:else}
					<p>{block.text}</p>
				{/if}
			{/each}
		</div>
	{:else}
		<p class="no-text">
			No story text yet.
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- editHref is resolve()d -->
			{#if data.owner}<a href={editHref}>Write it</a>{/if}
		</p>
	{/if}
{/snippet}

<!-- data-scheme: lets print (below) set this subtree to the light theme. -->
<div class="reader" data-scheme="">
	<div class="progress" style:transform="scaleX({progress})" aria-hidden="true"></div>

	<header class="bar" class:hidden={barHidden && !settingsOpen && !contentsOpen}>
		{#if data.owner}
			<a class="back" href={bookHref}>
				<Icon name="arrow-left" size={18} /><span class="back-title">{data.book.title}</span>
			</a>
		{:else}
			<a class="brand" href={resolve('/')}><Wordmark size={20} iconSize={24} /></a>
		{/if}

		<p class="where">{current >= 0 ? labelOf(sections[current]) : ''}</p>

		<div class="tools">
			{#if sections.length > 0}
				<button type="button" class="tool" onclick={() => (contentsOpen = true)}>
					<Icon name="list-tree" size={18} /><span class="tool-label">Contents</span>
				</button>
			{/if}
			<button
				type="button"
				class="tool"
				popovertarget="reader-settings"
				aria-label="Text settings"
				aria-expanded={settingsOpen}
			>
				<span class="aa" aria-hidden="true">Aa</span>
			</button>
			<ThemeToggle />
		</div>
	</header>

	<div
		id="reader-settings"
		class="settings"
		popover="auto"
		ontoggle={(event) => (settingsOpen = (event as ToggleEvent).newState === 'open')}
	>
		<p class="settings-label" id="size-label">Text size</p>
		<div class="stepper" role="group" aria-labelledby="size-label">
			<button
				type="button"
				aria-label="Smaller text"
				disabled={prefs.size === 0}
				onclick={() => setPrefs({ size: prefs.size - 1 })}><span class="a-small">A</span></button
			>
			<output aria-live="polite">{sizePercent}%</output>
			<button
				type="button"
				aria-label="Larger text"
				disabled={prefs.size === TEXT_SIZES.length - 1}
				onclick={() => setPrefs({ size: prefs.size + 1 })}><span class="a-large">A</span></button
			>
		</div>

		<p class="settings-label" id="face-label">Typeface</p>
		<div class="segmented" role="group" aria-labelledby="face-label">
			<button
				type="button"
				class="face-serif"
				aria-pressed={prefs.face === 'serif'}
				onclick={() => setPrefs({ face: 'serif' })}>Serif</button
			>
			<button
				type="button"
				class="face-sans"
				aria-pressed={prefs.face === 'sans'}
				onclick={() => setPrefs({ face: 'sans' })}>Sans</button
			>
		</div>

		<p class="settings-hint">
			<kbd>←</kbd><kbd>→</kbd> previous or next chapter
		</p>
	</div>

	<main
		class="book"
		class:sans={prefs.face === 'sans'}
		style:--read-size="{TEXT_SIZES[prefs.size]}px"
	>
		<section id="top" class="title-page" aria-labelledby="book-title">
			<BookCover id={data.book.id} title={data.book.title} author={data.author} size="lg" tilt />
			{#key data.book.title}
				<h1 id="book-title">
					<motion-headline by="words" interval={0.07}>{data.book.title}</motion-headline>
				</h1>
			{/key}
			{#if data.author}<p class="byline">by {data.author}</p>{/if}
			{#if data.book.description}<p class="blurb">{data.book.description}</p>{/if}
			<p class="facts">
				{plural(outline.length, 'part')} · {plural(chapterCount, 'chapter')}
				{#if words > 0}
					· {plural(words, 'word')} · about {readingTime(words)}
				{/if}
			</p>
			{#if sections.length > 0}
				<div class="start">
					<Button variant="primary" size="lg" href="#{sections[0].key}">
						Start reading<Icon name="arrow-right" size={17} />
					</Button>
					{#if resume}
						{@const at = resume}
						<Button size="lg" onclick={() => restore(at, 'smooth')}>Continue · {at.label}</Button>
					{/if}
				</div>
			{/if}
		</section>

		{#if sections.length > 0}
			<nav class="contents" aria-labelledby="contents-title">
				<h2 id="contents-title">Contents</h2>
				{@render contents(false)}
			</nav>
		{/if}

		{#each outline as entry (entry.part.id)}
			{@const partHref = resolve('/part/[id]', { id: String(entry.part.id) })}
			{#if entry.label}
				<header class="part-page" id="part-{entry.part.id}">
					<span class="part-over">{entry.label}</span>
					<h2>{entry.part.title}</h2>
					{#if entry.part.description}<p class="subtitle">{entry.part.description}</p>{/if}
					{@render ornament()}
				</header>
				{#each entry.chapters as { chapter, number } (chapter.id)}
					<section
						class="chapter"
						id="chapter-{chapter.id}"
						aria-labelledby="h-chapter-{chapter.id}"
					>
						<header class="chapter-head">
							<span class="chapter-over">Chapter {number}</span>
							<h3 id="h-chapter-{chapter.id}">{chapter.title}</h3>
							{#if chapter.description}<p class="subtitle">{chapter.description}</p>{/if}
						</header>
						{@render prose(
							`chapter-${chapter.id}`,
							resolve('/chapter/[id]', { id: String(chapter.id) })
						)}
					</section>
				{:else}
					<p class="no-text">No chapters yet.</p>
				{/each}
			{:else}
				<section class="chapter" id="part-{entry.part.id}" aria-labelledby="h-part-{entry.part.id}">
					<header class="chapter-head">
						<h2 id="h-part-{entry.part.id}">{entry.part.title}</h2>
						{#if entry.part.description}<p class="subtitle">{entry.part.description}</p>{/if}
					</header>
					{@render prose(`part-${entry.part.id}`, partHref)}
				</section>
			{/if}
		{/each}

		{#if sections.length > 0}
			<footer class="colophon">
				{@render ornament()}
				<p class="the-end">The End</p>
				<div class="end-actions">
					{#if data.owner}<Button href={bookHref}>Back to the book</Button>{/if}
					<Button variant="quiet" href="#top">Back to the top</Button>
				</div>
				{#if !data.owner}
					<p class="made">Written with <a href={resolve('/')}>Book Builder</a></p>
				{/if}
			</footer>
		{:else}
			<p class="nothing">
				There's nothing to read yet.
				{#if data.owner}<a href={bookHref}>Add parts and chapters</a> first.{/if}
			</p>
		{/if}
	</main>
</div>

{#if contentsOpen}
	<Dialog labelledby="toc-title" width={520} onclose={() => (contentsOpen = false)}>
		<div class="toc-dialog">
			<div class="toc-head">
				<h2 id="toc-title">Contents</h2>
				<button
					type="button"
					class="tool"
					aria-label="Close"
					onclick={() => (contentsOpen = false)}
				>
					<Icon name="x" size={20} />
				</button>
			</div>
			{@render contents(true)}
		</div>
	</Dialog>
{/if}

<style>
	/* Anchor jumps (contents, Start reading) glide unless motion is reduced. */
	@media (prefers-reduced-motion: no-preference) {
		:global(html:has(.reader)) {
			scroll-behavior: smooth;
		}
	}

	.reader {
		min-height: 100vh;
	}

	/* ---- Progress line and bar ---- */
	.progress {
		position: fixed;
		z-index: 11;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		background: var(--bb-royal);
		transform-origin: 0 50%;
		pointer-events: none;
	}

	.bar {
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 16px 8px 20px;
		background: light-dark(rgba(245, 240, 230, 0.9), rgba(10, 15, 36, 0.9));
		-webkit-backdrop-filter: blur(10px);
		backdrop-filter: blur(10px);
		border-bottom: 1px solid var(--bb-line-faint);
		transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	/* Keyboard users always see where focus is. */
	.bar.hidden:not(:focus-within) {
		transform: translateY(-100%);
	}

	.back,
	.brand {
		flex: 0 1 auto;
		min-width: 0;
		display: inline-flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		padding: 0 10px;
		margin-left: -10px;
		border-radius: 10px;
		text-decoration: none;
	}

	.back {
		max-width: 34%;
		color: var(--bb-text-2);
		font-weight: 600;
		font-size: 14.5px;
	}

	.back:hover {
		background: var(--bb-line-faint);
		color: var(--bb-text);
	}

	.back :global(svg) {
		flex: none;
	}

	.back-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.where {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: center;
		font-size: 14px;
		color: var(--bb-text-3);
	}

	.tools {
		flex: none;
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.tool {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-width: 44px;
		min-height: 44px;
		padding: 0 10px;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: var(--bb-text-label);
		font: 600 14px var(--font-ui);
	}

	.tool:hover,
	.tool[aria-expanded='true'] {
		background: var(--bb-line-faint);
		color: var(--bb-text-strong);
	}

	.aa {
		font-family: var(--font-display);
		font-size: 19px;
		line-height: 1;
	}

	/* ---- Text settings ---- */
	.settings {
		position: fixed;
		inset: 64px 16px auto auto;
		width: min(290px, calc(100vw - 32px));
		margin: 0;
		padding: 18px;
		border: 1px solid var(--bb-line-control);
		border-radius: 16px;
		background: var(--bb-ink);
		color: var(--bb-text);
		box-shadow: 0 24px 48px -20px var(--bb-drop);
	}

	.settings-label {
		margin-bottom: 8px;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--bb-text-3);
	}

	.stepper {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 18px;
		padding: 3px;
		border: 1px solid var(--bb-line-soft);
		border-radius: 12px;
	}

	.stepper button {
		width: 52px;
		height: 44px;
		border: none;
		border-radius: 9px;
		background: transparent;
		color: var(--bb-text);
		font-family: var(--font-display);
	}

	.stepper button:hover:not(:disabled) {
		background: var(--bb-raised);
	}

	.stepper button:disabled {
		opacity: 0.4;
	}

	.a-small {
		font-size: 15px;
	}

	.a-large {
		font-size: 24px;
	}

	output {
		font-size: 14px;
		font-weight: 600;
		color: var(--bb-text-label);
	}

	.segmented {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 3px;
		padding: 3px;
		border: 1px solid var(--bb-line-soft);
		border-radius: 12px;
	}

	.segmented button {
		min-height: 40px;
		border: none;
		border-radius: 9px;
		background: transparent;
		color: var(--bb-text-2);
		font-size: 16px;
	}

	.face-serif {
		font-family: var(--font-read);
	}

	.face-sans {
		font-family: var(--font-ui);
	}

	.segmented button[aria-pressed='true'] {
		background: var(--bb-royal);
		color: #fff;
	}

	.settings-hint {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 16px;
		font-size: 13px;
		color: var(--bb-text-3);
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

	/* ---- The book ---- */
	.book {
		--reader-face: var(--font-read);
		padding: 0 24px;
		color: var(--bb-text);
	}

	.book.sans {
		--reader-face: var(--font-ui);
	}

	.title-page {
		min-height: calc(100vh - 61px);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		padding: 48px 0 64px;
		text-align: center;
	}

	.title-page h1 {
		max-width: 14em;
		margin-top: 22px;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(44px, 7vw, 84px);
		line-height: 1;
		letter-spacing: -0.015em;
		color: var(--bb-text-strong);
		text-wrap: balance;
	}

	.byline {
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: var(--bb-text-3);
	}

	.blurb {
		max-width: 30em;
		font-family: var(--font-read);
		font-style: italic;
		font-size: 21px;
		line-height: 1.45;
		color: var(--bb-text-desc);
		text-wrap: balance;
	}

	.facts {
		font-size: 14px;
		color: var(--bb-text-3);
	}

	.start {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 10px;
		margin-top: 12px;
	}

	/* Contents, in the book and in the dialog. */
	.contents {
		max-width: 640px;
		margin: 0 auto;
		padding: 40px 0 24px;
	}

	.contents h2 {
		margin-bottom: 22px;
		text-align: center;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 30px;
		color: var(--bb-text-strong);
	}

	.toc,
	.toc ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.toc-part + li,
	.toc-story + li {
		margin-top: 6px;
	}

	.toc a {
		display: flex;
		align-items: baseline;
		gap: 16px;
		padding: 9px 14px;
		border-radius: 10px;
		text-decoration: none;
		color: var(--bb-text);
	}

	.toc a:hover {
		background: var(--bb-hover);
		color: var(--bb-text);
	}

	.toc a[aria-current] {
		background: var(--bb-raised);
	}

	.toc-over {
		flex: none;
		min-width: 88px;
		font-size: 11.5px;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--bb-sky);
	}

	.toc-num {
		flex: none;
		width: 88px;
		text-align: right;
		font-family: var(--font-display);
		color: var(--bb-text-4);
	}

	.toc-title {
		min-width: 0;
		font-family: var(--font-read);
		font-size: 18px;
		overflow-wrap: break-word;
	}

	.toc-part > a .toc-title,
	.toc-story > a .toc-title {
		font-family: var(--font-display);
		font-size: 21px;
	}

	.toc-dialog {
		padding: 16px 16px 20px;
	}

	.toc-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 4px 0 12px 14px;
	}

	.toc-head h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 28px;
		color: var(--bb-text-strong);
	}

	/* Parts and chapters. Sizes are in em of the reader's text size, so the setting scales them. */
	.part-page {
		min-height: 72vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 14px;
		padding: 12vh 0;
		text-align: center;
		font-size: var(--read-size);
	}

	.part-over {
		font-family: var(--font-ui);
		font-size: 0.66em;
		font-weight: 700;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: var(--bb-sky);
	}

	.part-page h2 {
		max-width: 14em;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 2.9em;
		line-height: 1.02;
		color: var(--bb-text-strong);
		text-wrap: balance;
	}

	.chapter {
		max-width: 34em;
		margin: 0 auto;
		padding: 5.5em 0 1.5em;
		font-size: var(--read-size);
	}

	.chapter-head {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.45em;
		margin-bottom: 2.4em;
		text-align: center;
	}

	.chapter-over {
		font-family: var(--font-ui);
		font-size: 0.62em;
		font-weight: 700;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: var(--bb-sky);
	}

	.chapter-head h2,
	.chapter-head h3 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 2.1em;
		line-height: 1.08;
		color: var(--bb-text-strong);
		text-wrap: balance;
	}

	.subtitle {
		max-width: 28em;
		font-family: var(--font-read);
		font-style: italic;
		font-size: 1.1em;
		line-height: 1.45;
		color: var(--bb-text-desc);
		text-wrap: balance;
	}

	.ornament {
		margin-top: 10px;
	}

	.ornament .rule {
		stroke: var(--bb-line-control);
		stroke-width: 1;
	}

	.ornament .diamond {
		fill: var(--bb-sky);
	}

	/* Story text, set like a book: indented paragraphs, a drop cap to open each section. */
	.prose {
		font-family: var(--reader-face);
		line-height: 1.75;
		color: var(--bb-text-read);
		-webkit-hyphens: auto;
		hyphens: auto;
		text-wrap: pretty;
		font-optical-sizing: auto;
	}

	.prose p + p {
		text-indent: 1.6em;
	}

	.prose > p:first-child::first-letter {
		float: left;
		margin: 0.08em 0.1em 0 0;
		font-family: var(--font-display);
		font-size: 3.4em;
		line-height: 0.8;
		color: var(--bb-sky);
	}

	.scene-break {
		display: flex;
		justify-content: center;
		padding: 1.2em 0 1.4em;
	}

	.scene-break .ornament {
		margin: 0;
	}

	.scene-break + p {
		text-indent: 0;
	}

	.no-text,
	.nothing {
		text-align: center;
		font-family: var(--font-read);
		font-style: italic;
		font-size: 1.05em;
		color: var(--bb-text-3);
	}

	.nothing {
		padding: 40px 0 96px;
		font-size: 19px;
	}

	.colophon {
		max-width: 34em;
		margin: 0 auto;
		padding: 6em 0 8em;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 18px;
		text-align: center;
	}

	.the-end {
		font-family: var(--font-read);
		font-style: italic;
		font-size: 28px;
		color: var(--bb-text-desc);
	}

	.end-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 10px;
	}

	.made {
		margin-top: 18px;
		font-size: 13.5px;
		color: var(--bb-text-3);
	}

	@media (max-width: 600px) {
		.bar {
			padding: 6px 8px 6px 14px;
			gap: 4px;
		}

		.where,
		.tool-label {
			display: none;
		}

		.back {
			max-width: none;
			flex: 1;
		}

		.brand {
			flex: 1;
		}

		.book {
			padding: 0 20px;
		}

		.title-page {
			min-height: 0;
			padding-top: 36px;
		}

		.title-page h1 {
			font-size: 42px;
		}

		.chapter {
			padding-top: 3.5em;
		}

		.part-page h2 {
			font-size: 2.3em;
		}

		.toc-over {
			min-width: 0;
		}

		.toc-num {
			width: 24px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.bar {
			transition: none;
		}
	}

	/* Printing gives a plain book: light, no controls, each part and chapter on a new page. */
	@media print {
		.reader {
			color-scheme: light;
		}

		.progress,
		.bar,
		.start,
		.end-actions,
		.made,
		.no-text a {
			display: none;
		}

		.title-page {
			min-height: 0;
		}

		.contents,
		.part-page,
		.chapter {
			break-before: page;
		}

		.part-page {
			min-height: 0;
			padding: 30vh 0 0;
		}

		.part-page + .chapter {
			break-before: page;
		}
	}
</style>
