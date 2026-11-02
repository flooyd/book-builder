<script lang="ts" module>
	/**
	 * What a cell shows: `full` and `ring` are marks, `gap` a stretch worth a look, `empty` a chapter
	 * it isn't in, and `unwritten` a chapter with no text yet. `level` thins out a full cell.
	 */
	export type TrackCell = { tone: 'full' | 'ring' | 'gap' | 'empty' | 'unwritten'; level?: number };
</script>

<script lang="ts">
	import type { SectionSummary } from '$lib/insights';
	import ChartTip from './ChartTip.svelte';
	import { byPart, nameOf } from './sections';

	// One small cell for each chapter in reading order, with a space between parts: how a word or
	// a character runs through a book. With no `cell`, it's the numbers that head a set of tracks.
	let {
		sections,
		label,
		cell,
		tip
	}: {
		sections: SectionSummary[];
		/** Says what the track shows, for screen readers. */
		label?: string;
		cell?: (index: number) => TrackCell;
		tip?: (index: number) => string;
	} = $props();

	const parts = $derived(byPart(sections));

	let width = $state(0);
	let track = $state<HTMLElement>();
	let active = $state<{ index: number; x: number } | null>(null);

	function point(event: PointerEvent) {
		const found = (event.target as HTMLElement).closest<HTMLElement>('[data-index]');
		if (!found || !track) {
			active = null;
			return;
		}
		const box = found.getBoundingClientRect();
		active = {
			index: Number(found.dataset.index),
			x: box.left + box.width / 2 - track.getBoundingClientRect().left
		};
	}

	/** A number for every chapter would crowd a long book. */
	const ticks = $derived(sections.length <= 24 ? 1 : sections.length <= 60 ? 5 : 10);
	const shows = (section: SectionSummary) =>
		section.number !== null && (ticks === 1 || section.number % ticks === 0);
</script>

{#if cell}
	<div
		class="track"
		role="img"
		aria-label={label}
		bind:this={track}
		bind:clientWidth={width}
		onpointermove={point}
		onpointerleave={() => (active = null)}
	>
		{#each parts as part (part.group)}
			<span class="part" style:flex={part.rows.length}>
				{#each part.rows as { section, index } (section.key)}
					{@const shown = cell(index)}
					<span class={['slot', shown.tone]} data-index={index}>
						<i style:opacity={shown.level}></i>
					</span>
				{/each}
			</span>
		{/each}
		{#if active && tip}
			<ChartTip
				x={active.x}
				top={0}
				bounds={width}
				value={tip(active.index)}
				label={nameOf(sections[active.index])}
			/>
		{/if}
	</div>
{:else}
	<div class="track numbers" aria-hidden="true">
		{#each parts as part (part.group)}
			<span class="part" style:flex={part.rows.length}>
				{#each part.rows as { section } (section.key)}
					<span class="slot tick">{shows(section) ? section.number : ''}</span>
				{/each}
			</span>
		{/each}
	</div>
{/if}

<style>
	.track {
		position: relative;
		display: flex;
		gap: 8px;
		min-width: 0;
	}

	.part {
		display: flex;
		min-width: 0;
	}

	/* The slot takes the pointer, so a thin cell on a long book is still easy to land on. */
	.slot {
		flex: 1 1 0;
		min-width: 0;
		padding: 5px 1px;
	}

	.slot i {
		display: block;
		height: 14px;
		border-radius: 3px;
		background: var(--bb-sky);
	}

	.empty i {
		background: var(--bb-raised);
	}

	.unwritten i {
		background: transparent;
		box-shadow: inset 0 -2px 0 var(--bb-line);
	}

	.ring i {
		background: transparent;
		box-shadow: inset 0 0 0 2px var(--bb-sky);
	}

	.gap i {
		background: var(--bb-amber-wash);
		box-shadow: inset 0 -2px 0 var(--bb-amber);
	}

	.numbers .slot {
		padding: 0;
		overflow: visible;
		text-align: center;
		font-size: 11px;
		font-variant-numeric: tabular-nums;
		color: var(--bb-text-4);
	}
</style>
