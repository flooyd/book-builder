<script lang="ts">
	import { resolve } from '$app/paths';
	import { useAppHeader } from '$lib/app-header.svelte';
	import type { WordMaps } from '$lib/word-map';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Segmented from './Segmented.svelte';
	import SpeakerList from './SpeakerList.svelte';
	import UnplacedLines from './UnplacedLines.svelte';
	import WordMapPanel from './WordMapPanel.svelte';

	// The words a book is made of, and the words each character says. It's all counted from the saved
	// story text on the server, with no AI involved (see $lib/word-map and $lib/speakers).
	let { book, maps }: { book: { id: number; title: string }; maps: WordMaps } = $props();

	const bookHref = $derived(resolve('/book/[id]', { id: String(book.id) }));
	const bibleHref = $derived(resolve('/book/[id]/bible', { id: String(book.id) }));

	useAppHeader((header) => {
		header.crumbs = [
			{ label: 'Library', href: resolve('/') },
			{ label: book.title, href: bookHref },
			{ label: 'Word map' }
		];
	});

	type View = 'book' | 'characters';

	/** In place of a speaker's key, the lines nobody could be placed with. */
	const UNSURE = 'unsure';

	const views = [
		{ id: 'book' as const, label: 'Whole book' },
		{ id: 'characters' as const, label: 'By character' }
	];

	let view = $state<View>('book');
	let chosen = $state<string | null>(null);
	let selected = $state<string | null>(null);
	let names = $state(true);

	const openKey = $derived(chosen ?? maps.speakers[0]?.key ?? UNSURE);
	const speaker = $derived(maps.speakers.find((item) => item.key === openKey));

	const share = $derived(
		maps.spoken.words > 0
			? Math.round(((maps.spoken.words - maps.unplaced.words) / maps.spoken.words) * 100)
			: 0
	);

	/** From a word on the book's map to the same word in someone's mouth. */
	function follow(key: string) {
		chosen = key;
		view = 'characters';
	}

	const percent = (words: number) => Math.round((words / maps.spoken.words) * 100);

	/** Names to spell out before "and 12 more". */
	const QUIET_NAMES = 8;

	const quiet = $derived(
		new Intl.ListFormat('en').format(
			maps.quiet.length > QUIET_NAMES
				? [...maps.quiet.slice(0, QUIET_NAMES), `${maps.quiet.length - QUIET_NAMES} more`]
				: maps.quiet
		)
	);
</script>

<svelte:head>
	<title>Word map · {book.title} · Book Builder</title>
</svelte:head>

<main class="word-map">
	<header class="head">
		<div class="head-text">
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- bookHref is resolve()d -->
			<a class="overline" href={bookHref}>{book.title}</a>
			<h1><motion-headline by="chars" interval={0.03}>Word map</motion-headline></h1>
			<p class="sub">
				The words your book is made of, and the words each character says. Counted from your saved
				story text.
			</p>
		</div>
		<div class="actions">
			<Button href={resolve('/book/[id]/insights', { id: String(book.id) })}>
				<Icon name="bar-chart" size={16} />Insights
			</Button>
			<Button href={bibleHref}>
				<Icon name="book-marked" size={16} />Story bible
			</Button>
		</div>
	</header>

	{#if maps.book.length === 0}
		<section class="card blank">
			<h2>Nothing to map yet.</h2>
			<p>Write a chapter and its words will show up here.</p>
			<Button variant="primary" href={resolve('/book/[id]/outline', { id: String(book.id) })}>
				Open the outline<Icon name="arrow-right" size={16} />
			</Button>
		</section>
	{:else}
		<div class="switch">
			<Segmented options={views} bind:value={view} label="Which map" />
		</div>

		{#if view === 'book'}
			<section class="card" aria-label="The whole book">
				<WordMapPanel
					words={maps.book}
					sections={maps.sections}
					speakers={maps.speakers}
					bind:selected
					bind:names
					onspeaker={follow}
				/>
			</section>
		{:else if maps.spoken.lines === 0}
			<section class="card blank">
				<h2>Nobody speaks yet.</h2>
				<p>Once your characters start talking, each of them gets a map of their own.</p>
			</section>
		{:else}
			{#if maps.cast === 0}
				<section class="card blank">
					<h2>Who's talking?</h2>
					<p>
						Add your characters to the story bible and their lines will land on maps of their own.
					</p>
					<Button variant="primary" href={bibleHref}>
						Open the story bible<Icon name="arrow-right" size={16} />
					</Button>
				</section>
			{/if}

			{#if maps.speakers.length > 0 || maps.unplaced.lines > 0}
				<p class="scope">
					{#if share > 0}
						{share}% of what's said in this book has a speaker. The rest stays off these maps rather
						than risk a wrong guess.
					{:else}
						Nothing said in this book could be placed yet, so these lines stay off the maps.
					{/if}
				</p>

				{#if maps.speakers.length > 0}
					<SpeakerList
						speakers={maps.speakers}
						unplaced={maps.unplaced.words}
						chosen={openKey}
						onchoose={(key) => (chosen = key)}
					/>
				{/if}

				{#if maps.quiet.length > 0}
					<p class="scope">No lines placed yet for {quiet}, so no map of their own.</p>
				{/if}

				<section class="card" aria-label={speaker?.name ?? 'Not sure who'}>
					{#if speaker}
						<WordMapPanel
							words={speaker.map}
							sections={maps.sections}
							{speaker}
							comparable={maps.speakers.length > 1 || maps.unplaced.words > 0}
							bind:selected
							bind:names
						/>
					{:else}
						<UnplacedLines
							bookId={book.id}
							sections={maps.sections}
							unplaced={maps.unplaced}
							strangers={maps.strangers}
						/>
					{/if}
				</section>

				<details class="how">
					<summary>How it tells who's talking</summary>
					<div class="how-text">
						<p>
							It reads the words around each line, with no list of speech verbs and no AI, and
							leaves a line alone when it can't tell. It can still get one wrong now and then.
						</p>
						<dl>
							<div>
								<dt>A name beside the line</dt>
								<dd>
									Lines like “How are you doing?” Will inquired. <span class="share"
										>{percent(maps.spoken.placed.named)}% of what's said</span
									>
								</dd>
							</div>
							<div>
								<dt>Someone close by</dt>
								<dd>
									A sentence next to the line says who's acting, or only one person is in the scene.
									<span class="share">{percent(maps.spoken.placed.nearby)}% of what's said</span>
								</dd>
							</div>
							<div>
								<dt>Taking turns</dt>
								<dd>
									Two people trading lines, followed back and forth between lines it's sure of.
									<span class="share">{percent(maps.spoken.placed.turns)}% of what's said</span>
								</dd>
							</div>
						</dl>
						<p>
							Characters are found by the names and aliases in your story bible. A book in the first
							person gets a map for the narrator too.
						</p>
					</div>
				</details>
			{/if}
		{/if}
	{/if}
</main>

<style>
	.word-map {
		max-width: 1280px;
		margin: 0 auto;
		padding: 48px 32px 96px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 20px 32px;
		margin-bottom: 12px;
	}

	.head-text {
		flex: 1 1 420px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.overline {
		align-self: flex-start;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		text-decoration: none;
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
		max-width: 620px;
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

	.switch {
		display: flex;
	}

	.scope {
		font-size: 14px;
		line-height: 1.5;
		color: var(--bb-text-3);
	}

	.card {
		padding: 26px 28px 12px;
		border-radius: var(--r-card);
		background: var(--bb-ink);
		border: 1px solid var(--bb-line-soft);
	}

	.blank {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 14px;
		padding-bottom: 28px;
	}

	h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 30px;
		line-height: 1.2;
		color: var(--bb-text-strong);
	}

	.blank p {
		font-size: 15.5px;
		line-height: 1.55;
		color: var(--bb-text-2);
	}

	.how summary {
		display: flex;
		align-items: center;
		min-height: 44px;
		color: var(--bb-sky);
		font: 600 14.5px var(--font-ui);
		cursor: pointer;
	}

	.how-text {
		display: flex;
		flex-direction: column;
		gap: 12px;
		max-width: 720px;
		font-size: 14.5px;
		line-height: 1.55;
		color: var(--bb-text-2);
	}

	dl {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: 0;
	}

	dt {
		font-weight: 600;
		color: var(--bb-text-strong);
	}

	dd {
		margin: 0;
	}

	.share {
		display: block;
		font-size: 13px;
		color: var(--bb-text-3);
	}

	@media (max-width: 760px) {
		.word-map {
			padding: 28px 16px 96px;
		}

		.card {
			padding: 20px 16px 8px;
		}

		.blank {
			padding-bottom: 22px;
		}
	}
</style>
