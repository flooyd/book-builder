<script lang="ts">
	import { resolve } from '$app/paths';
	import { useAppHeader } from '$lib/app-header.svelte';
	import type { Finding, ManuscriptInsights } from '$lib/insights';
	import { plural } from '$lib/library';
	import { readingTime } from '$lib/reading';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon, { type IconName } from '$lib/components/ui/Icon.svelte';
	import PacingChart from './PacingChart.svelte';
	import PresenceGrid from './PresenceGrid.svelte';
	import RepeatList from './RepeatList.svelte';

	// What the numbers say about a book: its shape at a glance, what's worth a look, and then the
	// three things a writer can't easily see from inside a draft. It's all counted from the saved
	// story text on the server, with no AI involved (see $lib/insights).
	let { book, insights }: { book: { id: number; title: string }; insights: ManuscriptInsights } =
		$props();

	const bookHref = $derived(resolve('/book/[id]', { id: String(book.id) }));
	const totals = $derived(insights.totals);

	useAppHeader((header) => {
		header.crumbs = [
			{ label: 'Library', href: resolve('/') },
			{ label: book.title, href: bookHref },
			{ label: 'Insights' }
		];
	});

	/** Under this, percentages and "typical" rest on too little to mean much. */
	const EARLY_DAYS = 1000;

	const AREA_ICONS: Record<Finding['area'], IconName> = {
		pacing: 'bar-chart',
		words: 'highlighter',
		cast: 'users'
	};

	const tiles = $derived([
		{ label: 'Words', value: totals.words.toLocaleString('en') },
		{ label: 'To read', value: readingTime(totals.words) },
		{ label: 'Typical chapter', value: `${totals.typical.toLocaleString('en')} words` },
		{ label: 'Average sentence', value: `${totals.sentenceLength.toFixed(1)} words` },
		{ label: 'Dialogue', value: `${Math.round(totals.dialogue * 100)}%` }
	]);
</script>

<svelte:head>
	<title>Insights · {book.title} · Book Builder</title>
</svelte:head>

<main class="insights">
	<header class="head">
		<div class="head-text">
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- bookHref is resolve()d -->
			<a class="overline" href={bookHref}>{book.title}</a>
			<h1><motion-headline by="chars" interval={0.03}>Insights</motion-headline></h1>
			<p class="sub">
				What the numbers say about your draft, counted from your saved story text with no AI
				involved. Read them as questions, not verdicts.
			</p>
		</div>
		<div class="actions">
			<Button href={resolve('/book/[id]/word-map', { id: String(book.id) })}>
				<Icon name="quote" size={16} />Word map
			</Button>
			<Button href={resolve('/book/[id]/outline', { id: String(book.id) })}>
				<Icon name="list-tree" size={16} />Outline
			</Button>
			<Button href={resolve('/book/[id]/bible', { id: String(book.id) })}>
				<Icon name="book-marked" size={16} />Story bible
			</Button>
		</div>
	</header>

	{#if totals.written === 0}
		<section class="card blank">
			<h2>Nothing to count yet.</h2>
			<p>Write a chapter and your numbers will show up here.</p>
			<Button variant="primary" href={resolve('/book/[id]/outline', { id: String(book.id) })}>
				Open the outline<Icon name="arrow-right" size={16} />
			</Button>
		</section>
	{:else}
		<dl class="tiles">
			{#each tiles as tile (tile.label)}
				<div class="tile">
					<dt>{tile.label}</dt>
					<dd>{tile.value}</dd>
				</div>
			{/each}
		</dl>

		<p class="scope">
			From {plural(totals.written, 'chapter')} with story text{#if totals.planned > totals.written},
				out of {totals.planned} planned{/if}.
			{#if totals.words < EARLY_DAYS}
				It's early days, so expect these to settle as the book grows.
			{/if}
		</p>

		<section class="card" aria-labelledby="h-worth">
			<h2 id="h-worth">Worth a look</h2>
			{#if insights.findings.length > 0}
				<ul class="findings">
					{#each insights.findings as finding (finding.title)}
						<li>
							<a href="#{finding.area}">
								<span class="finding-icon"><Icon name={AREA_ICONS[finding.area]} size={18} /></span>
								<span class="finding-text">
									<strong>{finding.title}</strong>
									<span>{finding.body}</span>
								</span>
								<Icon name="arrow-down" size={16} />
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="quiet">Nothing stands out so far. Your chapters and your cast look steady.</p>
			{/if}
		</section>

		<section id="pacing" class="card" aria-labelledby="h-pacing">
			<h2 id="h-pacing">Pacing</h2>
			<PacingChart {insights} />
		</section>

		<section id="words" class="card" aria-labelledby="h-words">
			<h2 id="h-words">Words you lean on</h2>
			<RepeatList {insights} />
		</section>

		<section id="cast" class="card" aria-labelledby="h-cast">
			<h2 id="h-cast">Who's on the page</h2>
			<PresenceGrid {insights} bookId={book.id} />
		</section>
	{/if}
</main>

<style>
	.insights {
		max-width: 1280px;
		margin: 0 auto;
		padding: 48px 32px 96px;
		display: flex;
		flex-direction: column;
		gap: 20px;
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

	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
		gap: 12px;
		margin: 0;
	}

	.tile {
		padding: 16px 20px;
		border-radius: var(--r-row);
		background: var(--bb-ink);
		border: 1px solid var(--bb-line-soft);
	}

	dt {
		font-size: 13.5px;
		color: var(--bb-text-3);
	}

	dd {
		margin: 4px 0 0;
		font-family: var(--font-display);
		font-size: 28px;
		line-height: 1.2;
		color: var(--bb-text-strong);
	}

	.scope {
		font-size: 14px;
		line-height: 1.5;
		color: var(--bb-text-3);
	}

	/* Clears the sticky header when "Worth a look" jumps here. */
	.card {
		scroll-margin-top: 96px;
		padding: 26px 28px 28px;
		border-radius: var(--r-card);
		background: var(--bb-ink);
		border: 1px solid var(--bb-line-soft);
	}

	h2 {
		margin: 0 0 18px;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 30px;
		line-height: 1.2;
		color: var(--bb-text-strong);
	}

	.blank {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 14px;
	}

	.blank h2 {
		margin: 0;
	}

	.blank p,
	.quiet {
		font-size: 15.5px;
		line-height: 1.55;
		color: var(--bb-text-2);
	}

	.findings {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(420px, 100%), 1fr));
		gap: 2px 20px;
		margin: 0 -10px;
		padding: 0;
		list-style: none;
	}

	.findings a {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 60px;
		padding: 8px 10px;
		border-radius: var(--r-row);
		color: var(--bb-text-3);
		text-decoration: none;
	}

	.findings a:hover {
		background: var(--bb-hover);
	}

	.finding-icon {
		flex: none;
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: var(--r-control);
		background: var(--bb-amber-wash);
		color: var(--bb-amber);
	}

	.finding-text {
		flex: 1 1 auto;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
		font-size: 14.5px;
		line-height: 1.4;
		color: var(--bb-text-2);
		overflow-wrap: anywhere;
	}

	.finding-text strong {
		font-weight: 600;
		font-size: 15.5px;
		color: var(--bb-text-strong);
	}

	.findings a > :global(svg) {
		flex: none;
	}

	@media (max-width: 760px) {
		.insights {
			padding: 28px 16px 96px;
		}

		.card {
			padding: 20px 16px 22px;
		}

		.tiles {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.tile {
			padding: 12px 14px;
		}

		/* An odd one out takes the whole row rather than leave a hole. */
		.tile:last-child:nth-child(odd) {
			grid-column: 1 / -1;
		}

		dd {
			font-size: 23px;
		}
	}
</style>
