<script lang="ts">
	import { resolve } from '$app/paths';
	import type { EntryInsight, EntryKind, ManuscriptInsights, SectionInsight } from '$lib/insights';
	import { plural } from '$lib/library';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Monogram from '$lib/components/bible/Monogram.svelte';
	import Segmented from './Segmented.svelte';
	import SectionTrack, { type TrackCell } from './SectionTrack.svelte';

	// Who is on the page, chapter by chapter, and who drifts off it for a long stretch. An entry
	// counts as there if the text mentions it or uses its name, or if it's in the chapter's cast,
	// so this works for a book written before @ mentions as well as for one that uses them.
	let { insights, bookId }: { insights: ManuscriptInsights; bookId: number } = $props();

	const sections: SectionInsight[] = $derived(insights.sections);
	const written = $derived(insights.totals.written);

	const KINDS: { id: EntryKind; label: string }[] = [
		{ id: 'character', label: 'Characters' },
		{ id: 'place', label: 'Places' },
		{ id: 'system', label: 'Systems' }
	];

	const countOf = (kind: EntryKind) =>
		insights.entries.filter((entry) => entry.type === kind).length;
	const options = $derived(
		KINDS.filter((kind) => countOf(kind.id) > 0).map((kind) => ({
			...kind,
			count: countOf(kind.id)
		}))
	);

	/** Start on the first kind the book has any of. */
	let kind = $state<EntryKind>(KINDS.find((item) => countOf(item.id) > 0)?.id ?? 'character');
	let showAll = $state(false);

	const ROWS = 14;
	const rows = $derived(insights.entries.filter((entry) => entry.type === kind));
	const shown = $derived(showAll ? rows : rows.slice(0, ROWS));

	function cellOf(entry: EntryInsight) {
		const cells = Object.fromEntries(entry.cells.map((cell) => [cell.section, cell]));
		const gap = entry.quiet ? entry.gap : null;
		const end = gap ? (gap.to ?? sections.length) : -1;
		return (index: number): TrackCell => {
			const cell = cells[index];
			if (cell) return { tone: cell.uses > 0 ? 'full' : 'ring' };
			if (sections[index].words === 0) return { tone: 'unwritten' };
			return gap && index > gap.from && index < end ? { tone: 'gap' } : { tone: 'empty' };
		};
	}

	function usesAt(entry: EntryInsight) {
		const cells = Object.fromEntries(entry.cells.map((cell) => [cell.section, cell]));
		return (index: number) => {
			const cell = cells[index];
			if (!cell) return sections[index].words === 0 ? 'Not written yet' : 'Not here';
			if (cell.uses === 0) return 'In the cast';
			return cell.uses === 1 ? 'Named once' : `Named ${cell.uses.toLocaleString('en')} times`;
		};
	}

	/** Says what the row shows, in words, for the row itself and for screen readers. */
	function summary(entry: EntryInsight) {
		if (entry.appearances === 0) return 'Not on the page yet';
		const presence = `In ${entry.appearances} of ${plural(written, 'chapter')}`;
		if (!entry.quiet || !entry.gap) return presence;
		const { from, to, sections: away } = entry.gap;
		return to === null
			? `Not seen since ${sections[from].label}`
			: `Gone for ${plural(away, 'chapter')}, after ${sections[from].label}`;
	}

	const entryHref = (entry: EntryInsight) =>
		`${resolve('/bible/[type]/[id]', { type: entry.type, id: String(entry.id) })}?book=${bookId}`;
</script>

{#if insights.entries.length === 0}
	<div class="none">
		<p>
			Your story bible is empty, so there's nobody to follow yet. Add a character, or type @ while
			you write.
		</p>
	</div>
{:else}
	<div class="head">
		{#if options.length > 1}
			<Segmented
				{options}
				bind:value={() => kind, (next) => ((showAll = false), (kind = next))}
				label="Which entries"
			/>
		{/if}
		<div class="legend">
			<span><i class="key full"></i>Named in the text</span>
			<span><i class="key ring"></i>In the cast only</span>
			<span><i class="key gap"></i>A long absence</span>
		</div>
	</div>

	<ul class="rows">
		<li class="row numbers" aria-hidden="true">
			<span></span>
			<SectionTrack {sections} />
			<span></span>
		</li>
		{#each shown as entry (`${entry.type}-${entry.id}`)}
			<li class="row">
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- entryHref uses resolve() -->
				<a class="who" href={entryHref(entry)}>
					<Monogram name={entry.name} id={entry.id} size={32} />
					<span class="name">{entry.name}</span>
				</a>
				<SectionTrack
					{sections}
					cell={cellOf(entry)}
					tip={usesAt(entry)}
					label="{entry.name}: {summary(entry)}"
				/>
				<p class={['summary', entry.quiet && 'quiet']}>
					{#if entry.quiet}<Icon name="alert-circle" size={15} />{/if}
					<span>{summary(entry)}</span>
				</p>
			</li>
		{/each}
	</ul>

	{#if rows.length > ROWS}
		<button type="button" class="more" onclick={() => (showAll = !showAll)}>
			{showAll ? 'Show fewer' : `Show all ${rows.length}`}
		</button>
	{/if}
{/if}

<style>
	.none p {
		font-size: 15px;
		line-height: 1.55;
		color: var(--bb-text-2);
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px 20px;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 18px;
		font-size: 13px;
		color: var(--bb-text-3);
	}

	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

	.key {
		width: 14px;
		height: 14px;
		border-radius: 3px;
	}

	.key.full {
		background: var(--bb-sky);
	}

	.key.ring {
		box-shadow: inset 0 0 0 2px var(--bb-sky);
	}

	.key.gap {
		background: var(--bb-amber-wash);
		box-shadow: inset 0 -2px 0 var(--bb-amber);
	}

	.rows {
		margin: 16px 0 0;
		padding: 0;
		list-style: none;
	}

	.row {
		display: grid;
		grid-template-columns: minmax(150px, 210px) minmax(0, 1fr) minmax(170px, 230px);
		align-items: center;
		gap: 16px;
		min-height: 48px;
	}

	.row.numbers {
		min-height: 20px;
	}

	.who {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
		min-height: 44px;
		border-radius: var(--r-chip);
		text-decoration: none;
	}

	.name {
		min-width: 0;
		font-weight: 600;
		font-size: 15px;
		color: var(--bb-text-strong);
		overflow-wrap: anywhere;
	}

	.who:hover .name {
		color: var(--bb-sky);
	}

	.summary {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		font-size: 13.5px;
		line-height: 1.4;
		color: var(--bb-text-3);
	}

	.summary.quiet {
		color: var(--bb-amber);
	}

	.summary :global(svg) {
		flex: none;
		margin-top: 2px;
	}

	.more {
		min-height: 44px;
		margin-top: 8px;
		padding: 0;
		border: none;
		background: transparent;
		color: var(--bb-sky);
		font: 600 14.5px var(--font-ui);
	}

	@media (max-width: 860px) {
		.row {
			grid-template-columns: minmax(0, 1fr);
			gap: 2px;
			padding: 8px 0;
		}

		.row.numbers {
			display: none;
		}
	}
</style>
