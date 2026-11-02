<script lang="ts">
	import type { RepeatInsight, SectionSummary } from '$lib/insights';
	import SectionTrack, { type TrackCell } from './SectionTrack.svelte';
	import { sectionHref } from './sections';

	// Where a word falls and how it reads in the story, so a writer can judge it: a count alone can't
	// tell a habit from the subject of the book.
	let { item, sections }: { item: RepeatInsight; sections: SectionSummary[] } = $props();

	const uses: Record<number, number> = $derived(Object.fromEntries(item.spread));
	const most = $derived(Math.max(...item.spread.map(([, count]) => count)));

	function cell(index: number): TrackCell {
		if (sections[index].words === 0) return { tone: 'unwritten' };
		const count = uses[index] ?? 0;
		// Never fainter than a third: a single use should still be plain to see.
		return count ? { tone: 'full', level: 0.34 + (0.66 * count) / most } : { tone: 'empty' };
	}

	function tip(index: number) {
		const count = uses[index] ?? 0;
		return count === 1 ? 'Once' : count === 0 ? 'Not used' : `${count} times`;
	}

	const chapterCount = (count: number) => `${count} ${count === 1 ? 'chapter' : 'chapters'}`;
</script>

<div class="detail">
	<p class="where">
		In {chapterCount(item.spread.length)}{#if item.peak !== null}, and at least half of these are in
			{sections[item.peak].label}{/if}.
		{#if item.forms.length > 0}
			Also counts {item.forms.join(', ')}.
		{/if}
	</p>
	{#if sections.length > 1}
		<SectionTrack
			{sections}
			{cell}
			{tip}
			label="{item.text} appears in {chapterCount(item.spread.length)} of {sections.length}"
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

<style>
	.detail {
		display: flex;
		flex-direction: column;
		gap: 14px;
		min-width: 0;
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
		flex: 1 1 260px;
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
</style>
