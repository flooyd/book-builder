<script lang="ts">
	import { plural } from '$lib/library';
	import type { SectionSummary } from '$lib/insights';
	import type { MapWord, Speaker } from '$lib/word-map';
	import Monogram from '$lib/components/bible/Monogram.svelte';
	import Segmented from './Segmented.svelte';
	import WordCloud from './WordCloud.svelte';
	import WordDetail from './WordDetail.svelte';

	// One map: a cloud to take in at a glance, the same words as a list, and whichever word is open.
	// The whole book and each character share this, so they read the same way.
	let {
		words,
		sections,
		speakers = [],
		speaker,
		comparable = false,
		selected = $bindable(),
		names = $bindable(),
		onspeaker
	}: {
		words: MapWord[];
		sections: SectionSummary[];
		/** Everyone with a map, for naming who says a word. */
		speakers?: Speaker[];
		/** Whose map it is. The whole book has none. */
		speaker?: Speaker;
		/** Whether there's anyone to hold this speaker's words up against. */
		comparable?: boolean;
		/** The open word, kept across maps so one word can be followed from person to person. */
		selected: string | null;
		names: boolean;
		onspeaker?: (key: string) => void;
	} = $props();

	type Rank = 'most' | 'own';

	let rank = $state<Rank>('most');
	const ranks = [
		{ id: 'most' as const, label: 'Most used' },
		{ id: 'own' as const, label: 'Most theirs' }
	];

	const hasNames = $derived(words.some((word) => word.name));

	const shown = $derived.by(() => {
		const kept = words.filter((word) => names || !word.name);
		if (rank === 'most') return kept.sort((a, b) => b.count - a.count);
		return kept.filter((word) => word.own > 0).sort((a, b) => b.own - a.own);
	});

	const open = $derived(shown.find((word) => word.text === selected) ?? shown[0]);

	const timesOf = (count: number) => (count === 1 ? 'once' : `${count.toLocaleString('en')} times`);
	const tipOf = (word: MapWord) =>
		`${timesOf(word.count)}, 1 in ${word.every.toLocaleString('en')}`;

	const cloudWords = $derived(
		shown.map((word) => ({
			key: word.text,
			text: word.text,
			weight: rank === 'own' ? word.own : word.count,
			// Everyone in the story has a place on the book's cloud. A character's holds what they say.
			pinned: !speaker && word.person,
			tip: tipOf(word),
			name: word.name
		}))
	);

	const whose = $derived(speaker ? `${speaker.name}'s words` : 'The words of the whole book');

	const NOTES: Record<Rank, string> = {
		most: 'What they say most, the bigger the more often.',
		own: 'What sets them apart: the words they lean on far more than anyone else does.'
	};

	const speakerOf = (key: string) => speakers.find((item) => item.key === key);
</script>

<div class="panel">
	<div class="stage">
		<div class="tools">
			{#if speaker && comparable}
				<Segmented options={ranks} bind:value={rank} label="Which words" />
			{/if}
			{#if hasNames}
				<label class="check">
					<input type="checkbox" bind:checked={names} />
					Show names
				</label>
			{/if}
		</div>
		{#if speaker && comparable}
			<p class="note">{NOTES[rank]}</p>
		{/if}

		{#if shown.length > 0}
			<WordCloud
				words={cloudWords}
				selected={open?.text ?? null}
				onselect={(key) => (selected = key)}
				label={whose}
			/>
			{#if names && hasNames}
				<p class="legend"><span class="swatch" aria-hidden="true"></span>Names are in blue.</p>
			{/if}
		{:else}
			<p class="empty">
				{rank === 'own'
					? 'Nothing sets them apart yet. Give them more to say.'
					: 'No words to show here yet.'}
			</p>
		{/if}
	</div>

	{#if open}
		<div class="open-head" aria-live="polite">
			<h3>{open.text}</h3>
			<p class="count">
				{open.count === 1 ? 'Once' : `${open.count.toLocaleString('en')} times`}, about 1 in every
				{open.every.toLocaleString('en')}
				{speaker ? 'of their' : ''} words
			</p>
		</div>

		<div class="open">
			{#if open.saidBy.length > 0}
				<div class="said">
					<p class="overline">Said aloud by</p>
					<ul>
						{#each open.saidBy as [key, count] (key)}
							{@const person = speakerOf(key)}
							{#if person}
								<li>
									<button type="button" onclick={() => onspeaker?.(key)}>
										<Monogram name={person.name} id={person.id ?? 0} size={28} />
										<span class="who">{person.name}</span>
										<span class="times">{count.toLocaleString('en')}</span>
									</button>
								</li>
							{/if}
						{/each}
					</ul>
				</div>
			{/if}

			<WordDetail item={open} {sections} />
		</div>
	{/if}
</div>

{#if shown.length > 0}
	<details class="twin">
		<summary>See {plural(shown.length, 'word')} as a list</summary>
		<ol>
			{#each shown as word (word.text)}
				<li>
					<button
						type="button"
						class:name={word.name}
						aria-pressed={word.text === open?.text}
						onclick={() => (selected = word.text)}
					>
						<span class="word">{word.text}</span>
						<span class="times">{word.count.toLocaleString('en')}</span>
					</button>
				</li>
			{/each}
		</ol>
	</details>
{/if}

<style>
	.panel {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 340px;
		grid-template-rows: auto 1fr;
		column-gap: 32px;
		align-items: start;
	}

	.stage {
		grid-row: 1 / span 2;
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-width: 0;
	}

	.tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 20px;
	}

	.tools:empty {
		display: none;
	}

	.note,
	.empty {
		font-size: 14.5px;
		line-height: 1.5;
		color: var(--bb-text-2);
	}

	.empty {
		padding: 48px 0;
		text-align: center;
	}

	.check {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		margin-left: auto;
		font-size: 14px;
		color: var(--bb-text-label);
		cursor: pointer;
	}

	.check input {
		width: 18px;
		height: 18px;
		accent-color: var(--bb-royal);
	}

	.legend {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--bb-text-3);
	}

	.swatch {
		width: 10px;
		height: 10px;
		border-radius: 3px;
		background: var(--bb-sky);
	}

	.open-head,
	.open {
		grid-column: 2;
		display: flex;
		flex-direction: column;
		min-width: 0;
		padding-left: 28px;
		border-left: 1px solid var(--bb-line-soft);
	}

	.open-head {
		gap: 6px;
		padding-bottom: 14px;
	}

	.open {
		align-self: stretch;
		gap: 14px;
	}

	h3 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 36px;
		line-height: 1.1;
		color: var(--bb-text-strong);
		overflow-wrap: anywhere;
	}

	.count {
		font-size: 14.5px;
		line-height: 1.5;
		color: var(--bb-text-2);
	}

	.said {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.overline {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--bb-text-3);
	}

	.said ul {
		margin: 0 -8px;
		padding: 0;
		list-style: none;
	}

	.said button {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-height: 44px;
		padding: 0 8px;
		border: none;
		border-radius: var(--r-chip);
		background: transparent;
		color: var(--bb-text);
		text-align: left;
		font: inherit;
		font-size: 14.5px;
	}

	.said button:hover {
		background: var(--bb-hover);
	}

	.who {
		flex: 1 1 auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.times {
		flex: none;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--bb-text-2);
	}

	.twin {
		margin-top: 20px;
		border-top: 1px solid var(--bb-line-soft);
	}

	summary {
		display: flex;
		align-items: center;
		min-height: 48px;
		color: var(--bb-sky);
		font: 600 14.5px var(--font-ui);
		cursor: pointer;
	}

	.twin ol {
		columns: 4 180px;
		column-gap: 24px;
		margin: 4px 0 0;
		padding: 0;
		list-style: none;
	}

	.twin li {
		break-inside: avoid;
	}

	.twin button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		width: 100%;
		min-height: 44px;
		padding: 0 10px;
		border: none;
		border-radius: var(--r-chip);
		background: transparent;
		text-align: left;
		font: inherit;
	}

	.twin button:hover {
		background: var(--bb-hover);
	}

	.twin button[aria-pressed='true'] {
		background: var(--bb-hover);
	}

	.word {
		min-width: 0;
		font-family: var(--font-read);
		font-size: 17px;
		color: var(--bb-text-strong);
		overflow-wrap: anywhere;
	}

	.twin .name .word {
		color: var(--bb-sky);
	}

	.twin .times {
		font-size: 14px;
	}

	@media (max-width: 1060px) {
		/* Not a grid here: a grid item can't stick outside its own row. */
		.panel {
			display: block;
		}

		/* Stays at the foot of the screen while the cloud is up, so a tap always shows its answer. */
		.open-head {
			position: sticky;
			bottom: 0;
			z-index: 2;
			gap: 2px;
			margin-top: 16px;
			padding: 12px 0;
			border-left: none;
			border-top: 1px solid var(--bb-line-soft);
			background: var(--bb-ink);
		}

		h3 {
			font-size: 28px;
		}

		.open {
			padding: 8px 0 0;
			border-left: none;
		}
	}
</style>
