<script lang="ts">
	import { ENTRY_COPY, type Cast, type EntryType } from '$lib/bible';
	import { initials } from '$lib/library';
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { CastEntry } from './types';

	// Who and what appears: characters as overlapping monograms (three at most, then "+n"), places
	// and systems as an icon and a count, with every name in the label.
	let { cast, entries }: { cast: Cast; entries: Record<EntryType, Record<number, CastEntry>> } =
		$props();

	const present = (type: EntryType) =>
		cast[type].map((id) => entries[type][id]).filter((entry) => entry !== undefined);
	const named = (list: CastEntry[]) => list.map((entry) => entry.name).join(', ');

	const people = $derived(present('character'));
	const tags = $derived(
		(['place', 'system'] as const)
			.map((type) => ({ type, list: present(type), copy: ENTRY_COPY[type] }))
			.filter((tag) => tag.list.length > 0)
	);
	const label = $derived(
		[
			people.length > 0 ? `Cast: ${named(people)}` : '',
			...tags.map((tag) => `${tag.copy.many}: ${named(tag.list)}`)
		]
			.filter(Boolean)
			.join('. ')
	);
</script>

{#if label}
	<span class="cast" role="img" aria-label={label} title={label}>
		{#if people.length > 0}
			<span class="faces">
				{#each people.slice(0, 3) as person (person.id)}
					<span class="face">{initials(person.name)}</span>
				{/each}
				{#if people.length > 3}<span class="face more">+{people.length - 3}</span>{/if}
			</span>
		{/if}
		{#each tags as tag (tag.type)}
			<span class="tag"><Icon name={tag.copy.icon} size={13} />{tag.list.length}</span>
		{/each}
	</span>
{/if}

<style>
	.cast {
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

	.faces {
		display: inline-flex;
		padding-left: 6px;
	}

	.face {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		margin-left: -6px;
		border-radius: 50%;
		border: 2px solid var(--bb-ink);
		background: var(--bb-raised);
		color: var(--bb-sky-text);
		font: 400 10.5px var(--font-display);
	}

	.more {
		font-family: var(--font-ui);
		font-weight: 700;
		font-size: 10px;
		color: var(--bb-text-2);
	}

	.tag {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		color: var(--bb-text-3);
		font: 600 12px var(--font-ui);
		font-variant-numeric: tabular-nums;
	}
</style>
