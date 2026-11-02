<script lang="ts">
	import type { ManuscriptInsights, RepeatInsight, SectionInsight } from '$lib/insights';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Segmented from './Segmented.svelte';
	import SectionTrack, { type TrackCell } from './SectionTrack.svelte';
	import { sectionHref } from './sections';

	// The words a book leans on. Opening one shows where it falls and how it reads in the story, so
	// the writer can judge it: a count alone can't tell a habit from the subject of the book.
	let { insights }: { insights: ManuscriptInsights } = $props();

	const sections: SectionInsight[] = $derived(insights.sections);

	type View = 'common' | 'habits' | 'phrases';

	const COPY: Record<View, string> = {
		common: 'The words you use most, leaving out the small ones every book needs and your names.',
		habits: 'Fillers, hedges and stage directions that creep into a draft.',
		phrases: 'Runs of three to five words that come back again and again.'
	};

	const EMPTY: Record<View, string> = {
		common: 'No word stands out yet.',
		habits: 'No habits to speak of.',
		phrases: 'No phrases repeat yet.'
	};

	/** Rows before "Show all". */
	const ROWS = 12;

	/** Each list opens on its top row, which shows what a row holds. */
	const topOf = (list: View) => insights.repeats[list][0]?.text ?? null;

	let view = $state<View>('common');
	let open = $state<string | null>(topOf('common'));
	let showAll = $state(false);

	const items = $derived(insights.repeats[view]);
	const shown = $derived(showAll ? items : items.slice(0, ROWS));
	const tallest = $derived(items[0]?.count ?? 1);

	function choose(next: View) {
		view = next;
		showAll = false;
		open = topOf(next);
	}

	const options = $derived([
		{ id: 'common' as const, label: 'Most used' },
		{ id: 'habits' as const, label: 'Habits' },
		{ id: 'phrases' as const, label: 'Phrases' }
	]);

	function cellOf(item: RepeatInsight) {
		const uses: Record<number, number> = Object.fromEntries(item.spread);
		const most = Math.max(...item.spread.map(([, count]) => count));
		return (index: number): TrackCell => {
			if (sections[index].words === 0) return { tone: 'unwritten' };
			const count = uses[index] ?? 0;
			// Never fainter than a third: a single use should still be plain to see.
			return count ? { tone: 'full', level: 0.34 + (0.66 * count) / most } : { tone: 'empty' };
		};
	}

	function usesAt(item: RepeatInsight) {
		const uses: Record<number, number> = Object.fromEntries(item.spread);
		return (index: number) => {
			const count = uses[index] ?? 0;
			return count === 1 ? 'Once' : count === 0 ? 'Not used' : `${count} times`;
		};
	}

	const chapterCount = (count: number) => `${count} ${count === 1 ? 'chapter' : 'chapters'}`;
</script>

<div class="head">
	<Segmented {options} bind:value={() => view, choose} label="Which words" />
	<p class="note">{COPY[view]}</p>
</div>

{#if items.length === 0}
	<p class="empty">{EMPTY[view]}</p>
{:else}
	<ol class="rows">
		{#each shown as item (item.text)}
			{@const expanded = open === item.text}
			<li class:expanded>
				<button
					type="button"
					class="row"
					aria-expanded={expanded}
					onclick={() => (open = expanded ? null : item.text)}
				>
					<span class="word">{item.text}</span>
					<span class="meter" aria-hidden="true">
						<span style:width="{(item.count / tallest) * 100}%"></span>
					</span>
					<span class="count">{item.count.toLocaleString('en')}</span>
					<span class="every">1 in {item.every.toLocaleString('en')} words</span>
					<span class="chevron" class:turned={expanded}><Icon name="chevron-down" size={18} /></span
					>
				</button>

				{#if expanded}
					<div class="detail">
						<p class="where">
							In {chapterCount(item.spread.length)}{#if item.peak !== null}, and at least half of
								these are in {sections[item.peak].label}{/if}.
							{#if item.forms.length > 0}
								Also counts {item.forms.join(', ')}.
							{/if}
						</p>
						{#if sections.length > 1}
							<SectionTrack
								{sections}
								cell={cellOf(item)}
								tip={usesAt(item)}
								label="{item.text} appears in {chapterCount(
									item.spread.length
								)} of {sections.length}"
							/>
						{/if}
						<ul class="examples">
							{#each item.examples as example, index (index)}
								{@const section = sections[example.section]}
								<li>
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- sectionHref uses resolve() -->
									<a href={sectionHref(section)}>
										<span class="line">
											{example.before}<mark>{example.match}</mark>{example.after}
										</span>
										<span class="from">{section.label}</span>
									</a>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</li>
		{/each}
	</ol>

	{#if items.length > ROWS}
		<button type="button" class="more" onclick={() => (showAll = !showAll)}>
			{showAll ? 'Show fewer' : `Show all ${items.length}`}
		</button>
	{/if}
{/if}

<style>
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px 20px;
	}

	.note {
		flex: 1 1 280px;
		font-size: 14.5px;
		color: var(--bb-text-2);
	}

	.empty {
		margin-top: 20px;
		font-size: 15px;
		color: var(--bb-text-2);
	}

	.rows {
		margin: 16px 0 0;
		padding: 0;
		list-style: none;
	}

	li.expanded {
		border-radius: var(--r-row);
		background: var(--bb-hover);
	}

	.row {
		display: grid;
		grid-template-columns: minmax(120px, 240px) minmax(40px, 1fr) 52px 128px 20px;
		align-items: center;
		gap: 16px;
		width: 100%;
		min-height: 48px;
		padding: 4px 14px;
		border: none;
		border-radius: var(--r-row);
		background: transparent;
		color: var(--bb-text);
		text-align: left;
		font: inherit;
	}

	.row:hover {
		background: var(--bb-hover);
	}

	.word {
		font-family: var(--font-read);
		font-size: 19px;
		color: var(--bb-text-strong);
		overflow-wrap: anywhere;
	}

	.meter {
		height: 6px;
		border-radius: var(--r-pill);
		background: var(--bb-raised);
		overflow: hidden;
	}

	.meter span {
		display: block;
		height: 100%;
		border-radius: var(--r-pill);
		background: var(--bb-sky);
	}

	.count {
		text-align: right;
		font-weight: 600;
		font-size: 15px;
		font-variant-numeric: tabular-nums;
		color: var(--bb-text-strong);
	}

	.every {
		font-size: 13px;
		color: var(--bb-text-3);
	}

	.chevron {
		display: grid;
		color: var(--bb-text-3);
		transition: transform 160ms ease;
	}

	.chevron.turned {
		transform: rotate(180deg);
	}

	.detail {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 6px 14px 18px;
	}

	.where {
		font-size: 14.5px;
		line-height: 1.5;
		color: var(--bb-text-2);
	}

	.examples {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.examples a {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 2px 20px;
		padding: 8px 10px;
		border-radius: var(--r-chip);
		text-decoration: none;
	}

	.examples a:hover {
		background: var(--bb-raised);
	}

	.line {
		flex: 1 1 300px;
		min-width: 0;
		font-family: var(--font-read);
		font-size: 17px;
		line-height: 1.5;
		color: var(--bb-text-read);
		overflow-wrap: anywhere;
	}

	mark {
		padding: 0 2px;
		border-radius: 3px;
		background: var(--mark-yellow);
		color: inherit;
	}

	.from {
		flex: none;
		font-size: 13px;
		color: var(--bb-text-3);
	}

	.more {
		min-height: 44px;
		margin-top: 8px;
		padding: 0 14px;
		border: none;
		background: transparent;
		color: var(--bb-sky);
		font: 600 14.5px var(--font-ui);
	}

	@media (prefers-reduced-motion: reduce) {
		.chevron {
			transition: none;
		}
	}

	@media (max-width: 760px) {
		.row {
			grid-template-columns: minmax(0, 1fr) 40px 20px;
			gap: 4px 12px;
			padding: 8px 10px;
		}

		.meter {
			grid-column: 1 / -1;
			grid-row: 2;
		}

		.every {
			display: none;
		}

		.detail {
			padding: 6px 10px 16px;
		}
	}
</style>
