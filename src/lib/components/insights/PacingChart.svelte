<script lang="ts">
	import type { ManuscriptInsights, SectionInsight } from '$lib/insights';
	import { readingTime } from '$lib/reading';
	import ChartTip from './ChartTip.svelte';
	import Segmented from './Segmented.svelte';
	import { byPart, nameOf, sectionHref } from './sections';

	// How a book moves: one column for each chapter in reading order, measured one way at a time.
	// Each measure has its own scale, so they take turns rather than share a chart, and the table
	// underneath holds every figure for anyone who'd rather read them or can't hover.
	let { insights }: { insights: ManuscriptInsights } = $props();

	const sections = $derived(insights.sections);
	const totals = $derived(insights.totals);

	type Measure = 'length' | 'dialogue' | 'sentences';

	const MEASURES: { id: Measure; label: string; note: string }[] = [
		{ id: 'length', label: 'Length', note: 'Words in each chapter.' },
		{ id: 'dialogue', label: 'Dialogue', note: 'How much of each chapter is spoken aloud.' },
		{
			id: 'sentences',
			label: 'Sentences',
			note: 'Words in an average sentence. Shorter sentences read faster.'
		}
	];

	let measure = $state<Measure>('length');
	const note = $derived(MEASURES.find((item) => item.id === measure)?.note);

	const words = (value: number) => value.toLocaleString('en');
	const percent = (share: number) => `${Math.round(share * 100)}%`;
	const oneDecimal = (value: number) => value.toFixed(1);

	/** The chosen measure of a chapter, on the chart's scale. */
	const valueOf = (section: SectionInsight) =>
		measure === 'length'
			? section.words
			: measure === 'dialogue'
				? section.dialogue * 100
				: section.sentenceLength;

	const formatted = (value: number) =>
		measure === 'length'
			? words(value)
			: measure === 'dialogue'
				? `${Math.round(value)}%`
				: oneDecimal(value);

	/** What each chapter's measure is read against. */
	const reference = $derived(
		measure === 'length'
			? { value: totals.typical, label: `Typical chapter, ${words(totals.typical)} words` }
			: measure === 'dialogue'
				? { value: totals.dialogue * 100, label: `Whole book, ${percent(totals.dialogue)}` }
				: {
						value: totals.sentenceLength,
						label: `Whole book, ${oneDecimal(totals.sentenceLength)} words`
					}
	);

	/** The next round number at or above a value, for the top of the scale. */
	function roundedUp(value: number) {
		if (value <= 0) return 1;
		const power = 10 ** Math.floor(Math.log10(value));
		const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
		const step = steps.find((candidate) => candidate * power >= value) ?? 10;
		return step * power;
	}

	const top = $derived(roundedUp(Math.max(...sections.map(valueOf), reference.value)));
	const axis = $derived([top, top / 2, 0]);
	const percentOf = (value: number) => `${(value / top) * 100}%`;

	const parts = $derived(byPart(sections));

	let width = $state(0);
	let plot = $state<HTMLElement>();
	let active = $state<{ index: number; x: number; top: number } | null>(null);

	function show(index: number, slot: HTMLElement) {
		if (!plot) return;
		const box = plot.getBoundingClientRect();
		const column = slot.getBoundingClientRect();
		const bar = slot.firstElementChild?.getBoundingClientRect();
		active = {
			index,
			x: column.left + column.width / 2 - box.left,
			top: (bar?.top ?? column.bottom) - box.top
		};
	}

	const describe = (section: SectionInsight) =>
		section.words > 0
			? `${nameOf(section)}: ${formatted(valueOf(section))}`
			: `${nameOf(section)}: not written yet`;

	/** A part's name goes under its chapters where it fits, and stays in the table where it doesn't. */
	function partName(group: number, rows: number) {
		const name = insights.groups[group]?.label ?? insights.groups[group]?.title ?? '';
		return name.length * 7 + 8 <= (width / sections.length) * rows ? name : '';
	}

	const flagged = $derived(measure === 'length' && sections.some((section) => section.flag));
	/** "Long" and "Short" need room, or they run into the next column. */
	const labelled = $derived(width / sections.length >= 36);
	const ticks = $derived(sections.length <= 24 ? 1 : sections.length <= 60 ? 5 : 10);

	/** Against the typical chapter, as a writer would say it. */
	function againstTypical(ratio: number) {
		const difference = Math.round((ratio - 1) * 100);
		if (Math.abs(difference) < 5) return 'About typical';
		return difference > 0 ? `+${difference}%` : `−${-difference}%`;
	}
</script>

<div class="chart-head">
	<Segmented
		options={MEASURES}
		bind:value={() => measure, (next) => ((active = null), (measure = next))}
		label="Measure"
	/>
	<p class="note">{note}</p>
</div>

<div class="legend">
	<span><i class="line-key"></i>{reference.label}</span>
	{#if flagged}<span><i class="flag-key"></i>Long or short for this book</span>{/if}
</div>

<div class="chart">
	<div class="plot" bind:this={plot} bind:clientWidth={width}>
		{#each axis as tick (tick)}
			<span class="grid" style:bottom={percentOf(tick)}></span>
			<span class="tick" style:bottom={percentOf(tick)}>{formatted(tick)}</span>
		{/each}

		<div class="columns" role="group" aria-label="{note} Each column links to its chapter.">
			{#each parts as part (part.group)}
				<div class="part" style:flex={part.rows.length}>
					{#each part.rows as { section, index } (section.key)}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- sectionHref uses resolve() -->
						<a
							class="slot"
							href={sectionHref(section)}
							aria-label={describe(section)}
							onpointerenter={(event) => show(index, event.currentTarget)}
							onpointerleave={() => (active = null)}
							onfocus={(event) => show(index, event.currentTarget)}
							onblur={() => (active = null)}
						>
							<span
								class={['bar', measure === 'length' && section.flag && 'flagged']}
								class:none={section.words === 0}
								style:height={percentOf(valueOf(section))}
							>
								{#if measure === 'length' && section.flag && labelled}
									<span class="flag-label">{section.flag === 'long' ? 'Long' : 'Short'}</span>
								{/if}
							</span>
						</a>
					{/each}
				</div>
			{/each}
		</div>

		<span class="reference" style:bottom={percentOf(reference.value)}></span>

		{#if active}
			{@const section = sections[active.index]}
			<ChartTip
				x={active.x}
				top={active.top}
				bounds={width}
				value={section.words > 0 ? formatted(valueOf(section)) : 'Not written yet'}
				label={nameOf(section)}
			/>
		{/if}
	</div>

	<div class="axis" aria-hidden="true">
		{#each parts as part (part.group)}
			<div class="axis-part" style:flex={part.rows.length}>
				<div class="axis-numbers">
					{#each part.rows as { section } (section.key)}
						<span
							>{section.number !== null && (ticks === 1 || section.number % ticks === 0)
								? section.number
								: ''}</span
						>
					{/each}
				</div>
				<span class="axis-name">{partName(part.group, part.rows.length)}</span>
			</div>
		{/each}
	</div>
</div>

<details class="numbers">
	<summary>See every chapter in numbers</summary>
	<div class="table-wrap">
		<table>
			<thead>
				<tr>
					<th scope="col">Chapter</th>
					<th scope="col" class="figure">Words</th>
					<th scope="col" class="figure">Against typical</th>
					<th scope="col" class="figure">Dialogue</th>
					<th scope="col" class="figure">Sentence</th>
					<th scope="col" class="figure">To read</th>
				</tr>
			</thead>
			<tbody>
				{#each sections as section (section.key)}
					<tr>
						<th scope="row">
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- sectionHref uses resolve() -->
							<a href={sectionHref(section)}>
								<span class="row-label">{section.label}</span>
								{#if section.title !== section.label}<span>{section.title}</span>{/if}
							</a>
						</th>
						{#if section.words > 0}
							<td class="figure">{words(section.words)}</td>
							<td class="figure">
								{section.ratio === null ? '' : againstTypical(section.ratio)}
							</td>
							<td class="figure">{percent(section.dialogue)}</td>
							<td class="figure">{oneDecimal(section.sentenceLength)}</td>
							<td class="figure">{readingTime(section.words)}</td>
						{:else}
							<td class="figure unwritten" colspan="5">Not written yet</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</details>

<style>
	.chart-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px 20px;
	}

	.note {
		font-size: 14.5px;
		color: var(--bb-text-2);
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 20px;
		margin-top: 16px;
		font-size: 13px;
		color: var(--bb-text-3);
	}

	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

	.line-key {
		width: 18px;
		height: 2px;
		background: var(--bb-text-2);
	}

	.flag-key {
		width: 12px;
		height: 12px;
		border-radius: 3px;
		background: var(--bb-amber);
	}

	.chart {
		margin-top: 30px;
		padding-left: 48px;
	}

	.plot {
		position: relative;
		height: 240px;
	}

	.grid {
		position: absolute;
		left: 0;
		right: 0;
		height: 1px;
		background: var(--bb-line-soft);
	}

	.tick {
		position: absolute;
		left: -48px;
		width: 40px;
		transform: translateY(50%);
		text-align: right;
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		color: var(--bb-text-4);
	}

	.reference {
		position: absolute;
		left: 0;
		right: 0;
		height: 2px;
		background: var(--bb-text-2);
		pointer-events: none;
	}

	.columns {
		position: absolute;
		inset: 0;
		display: flex;
		gap: 12px;
	}

	.part {
		display: flex;
		min-width: 0;
	}

	/* The whole height of the chart takes the pointer, however short the column. */
	.slot {
		flex: 1 1 0;
		min-width: 0;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		padding: 0 1px;
		border-radius: 4px;
	}

	.slot:hover {
		background: var(--bb-hover);
	}

	.bar {
		position: relative;
		width: 100%;
		max-width: 24px;
		min-height: 2px;
		border-radius: 4px 4px 0 0;
		background: var(--bb-sky);
		transition: height 240ms ease;
	}

	.bar.flagged {
		background: var(--bb-amber);
	}

	/* Not written yet: a mark on the baseline, so its place in the book still shows. */
	.bar.none {
		height: 2px !important;
		border-radius: 0;
		background: var(--bb-line);
	}

	.flag-label {
		position: absolute;
		bottom: calc(100% + 4px);
		left: 50%;
		transform: translateX(-50%);
		font-size: 11px;
		font-weight: 600;
		color: var(--bb-text-2);
	}

	.axis {
		display: flex;
		gap: 12px;
		margin-top: 8px;
	}

	.axis-part {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
	}

	.axis-numbers {
		display: flex;
	}

	.axis-numbers span {
		flex: 1 1 0;
		min-width: 0;
		min-height: 14px;
		text-align: center;
		font-size: 11px;
		font-variant-numeric: tabular-nums;
		color: var(--bb-text-4);
	}

	.axis-name {
		min-height: 16px;
		padding-top: 4px;
		border-top: 1px solid var(--bb-line-soft);
		text-align: center;
		white-space: nowrap;
		font-size: 12px;
		color: var(--bb-text-3);
	}

	.numbers {
		margin-top: 24px;
	}

	summary {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		cursor: pointer;
		font-weight: 600;
		font-size: 14.5px;
		color: var(--bb-sky);
	}

	.table-wrap {
		overflow-x: auto;
		margin-top: 8px;
	}

	table {
		width: 100%;
		min-width: 560px;
		border-collapse: collapse;
		font-size: 14.5px;
		color: var(--bb-text);
	}

	th,
	td {
		padding: 10px 12px;
		border-bottom: 1px solid var(--bb-line-faint);
		text-align: left;
		font-weight: 400;
	}

	thead th {
		font-size: 13px;
		font-weight: 600;
		white-space: nowrap;
		color: var(--bb-text-3);
	}

	tbody th a {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 8px;
		color: var(--bb-text-strong);
		text-decoration: none;
	}

	tbody th a:hover {
		color: var(--bb-sky);
	}

	.row-label {
		color: var(--bb-text-3);
	}

	.figure {
		text-align: right;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.unwritten {
		color: var(--bb-text-3);
	}

	@media (prefers-reduced-motion: reduce) {
		.bar {
			transition: none;
		}
	}

	@media (max-width: 760px) {
		.chart {
			padding-left: 40px;
		}

		.tick {
			left: -40px;
			width: 34px;
			font-size: 11px;
		}

		.plot {
			height: 200px;
		}

		.columns,
		.axis {
			gap: 6px;
		}
	}
</style>
