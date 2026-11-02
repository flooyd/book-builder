<script lang="ts">
	import { resolve } from '$app/paths';
	import type { SectionSummary } from '$lib/insights';
	import type { WordMaps } from '$lib/word-map';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { sectionHref } from './sections';

	// The lines nobody could be placed with. They stay off every map rather than risk landing on the
	// wrong one, so the writer sees them here, and sees the names that would place more of them.
	let {
		bookId,
		sections,
		unplaced,
		strangers
	}: {
		bookId: number;
		sections: SectionSummary[];
		unplaced: WordMaps['unplaced'];
		strangers: WordMaps['strangers'];
	} = $props();

	const bibleHref = $derived(resolve('/book/[id]/bible', { id: String(bookId) }));
	const lines = (count: number) =>
		`${count.toLocaleString('en')} ${count === 1 ? 'line' : 'lines'}`;
</script>

<div class="unsure">
	<div class="intro">
		<h3>Lines that could be anyone's</h3>
		<p>
			{lines(unplaced.lines)} of speech didn't say enough to tell who's talking, so they stay off every
			map rather than risk landing on the wrong one.
		</p>
	</div>

	{#if strangers.length > 0}
		<div class="strangers">
			<p class="overline">Not in your story bible</p>
			<p class="why">
				These names speak in the story. Add them as characters and their lines will get a map of
				their own.
			</p>
			<ul>
				{#each strangers as stranger (stranger.name)}
					<li><strong>{stranger.name}</strong> {lines(stranger.lines)}</li>
				{/each}
			</ul>
			<Button href={bibleHref}><Icon name="book-marked" size={16} />Open the story bible</Button>
		</div>
	{/if}

	{#if unplaced.examples.length > 0}
		<div class="lines">
			<p class="overline">
				{unplaced.examples.length < unplaced.lines ? 'A sample of them' : 'The lines'}
			</p>
			<ul>
				{#each unplaced.examples as example, index (index)}
					{@const section = sections[example.section]}
					<li>
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- sectionHref uses resolve() -->
						<a href={sectionHref(section)}>
							<span class="line">{example.text}</span>
							<span class="from">{section.label}</span>
						</a>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>

<style>
	.unsure {
		display: flex;
		flex-direction: column;
		gap: 22px;
		min-width: 0;
	}

	.intro {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-width: 680px;
	}

	h3 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 30px;
		line-height: 1.2;
		color: var(--bb-text-strong);
	}

	p {
		font-size: 15px;
		line-height: 1.55;
		color: var(--bb-text-2);
	}

	.overline {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--bb-text-3);
	}

	.strangers {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
	}

	.strangers ul {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 4px 0 6px;
		padding: 0;
		list-style: none;
	}

	.strangers li {
		padding: 6px 12px;
		border-radius: var(--r-pill);
		background: var(--bb-amber-wash);
		font-size: 14px;
		color: var(--bb-text-2);
	}

	.strangers strong {
		font-weight: 600;
		color: var(--bb-text-strong);
	}

	.lines {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}

	.lines ul {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(440px, 100%), 1fr));
		gap: 2px 20px;
		margin: 0 -10px;
		padding: 0;
		list-style: none;
	}

	.lines a {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px 10px;
		border-radius: var(--r-chip);
		text-decoration: none;
	}

	.lines a:hover {
		background: var(--bb-hover);
	}

	.line {
		font-family: var(--font-read);
		font-size: 17px;
		line-height: 1.5;
		color: var(--bb-text-read);
		overflow-wrap: anywhere;
	}

	.from {
		font-size: 13px;
		color: var(--bb-text-3);
	}
</style>
