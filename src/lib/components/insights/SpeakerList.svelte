<script lang="ts">
	import type { Speaker } from '$lib/word-map';
	import Monogram from '$lib/components/bible/Monogram.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	// Who talks, most first, with a bar for how much. The last row is everything that couldn't be
	// placed: the list is honest about what's missing from it.
	let {
		speakers,
		unplaced,
		chosen,
		onchoose
	}: {
		speakers: Speaker[];
		/** Spoken words nobody could be placed with. */
		unplaced: number;
		/** A speaker's key, or UNSURE. */
		chosen: string;
		onchoose: (key: string) => void;
	} = $props();

	/** Rows before "Show all": two lines of them on a desk. */
	const ROWS = 9;

	let showAll = $state(false);

	// Always keeps the open person in view, whoever it is.
	const shown = $derived.by(() => {
		if (showAll) return speakers;
		const top = speakers.slice(0, ROWS);
		const open = speakers.find((speaker) => speaker.key === chosen);
		return open && !top.includes(open) ? [...top.slice(0, -1), open] : top;
	});

	const most = $derived(speakers.reduce((top, speaker) => Math.max(top, speaker.words), 1));
	const wordsOf = (count: number) =>
		`${count.toLocaleString('en')} ${count === 1 ? 'word' : 'words'}`;
</script>

<ul class="speakers">
	{#each shown as speaker (speaker.key)}
		<li>
			<button
				type="button"
				aria-pressed={chosen === speaker.key}
				onclick={() => onchoose(speaker.key)}
			>
				<Monogram name={speaker.name} id={speaker.id ?? 0} size={32} />
				<span class="text">
					<span class="name">{speaker.name}</span>
					<span class="said">{wordsOf(speaker.words)}</span>
					<span class="meter" aria-hidden="true">
						<i style:width="{(speaker.words / most) * 100}%"></i>
					</span>
				</span>
			</button>
		</li>
	{/each}
	{#if unplaced > 0}
		<li>
			<button
				type="button"
				class="unsure"
				aria-pressed={chosen === 'unsure'}
				onclick={() => onchoose('unsure')}
			>
				<span class="mark"><Icon name="alert-circle" size={18} /></span>
				<span class="text">
					<span class="name">Not sure who</span>
					<span class="said">{wordsOf(unplaced)}</span>
				</span>
			</button>
		</li>
	{/if}
</ul>

{#if speakers.length > ROWS}
	<button type="button" class="more" onclick={() => (showAll = !showAll)}>
		{showAll ? 'Show fewer' : `Show all ${speakers.length}`}
	</button>
{/if}

<style>
	.speakers {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(210px, 100%), 1fr));
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.speakers button {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-height: 60px;
		padding: 8px 10px;
		border: 1px solid var(--bb-line-soft);
		border-radius: var(--r-row);
		background: var(--bb-ink);
		color: var(--bb-text);
		text-align: left;
		font: inherit;
	}

	.speakers button:hover {
		background: var(--bb-hover);
	}

	.speakers button[aria-pressed='true'] {
		border-color: var(--bb-sky);
		box-shadow: inset 0 0 0 1px var(--bb-sky);
	}

	.text {
		flex: 1 1 auto;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
		font-size: 14.5px;
		color: var(--bb-text-strong);
	}

	.said {
		font-size: 13px;
		color: var(--bb-text-3);
	}

	.meter {
		height: 3px;
		margin-top: 3px;
		border-radius: var(--r-pill);
		background: var(--bb-raised);
		overflow: hidden;
	}

	.meter i {
		display: block;
		height: 100%;
		border-radius: var(--r-pill);
		background: var(--bb-sky);
	}

	.mark {
		flex: none;
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--bb-amber-wash);
		color: var(--bb-amber);
	}

	.more {
		align-self: flex-start;
		min-height: 44px;
		padding: 0 4px;
		border: none;
		background: transparent;
		color: var(--bb-sky);
		font: 600 14.5px var(--font-ui);
	}

	@media (max-width: 760px) {
		.speakers {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
