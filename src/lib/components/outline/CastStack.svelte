<script lang="ts">
	import { initials } from '$lib/library';

	// Who appears, as overlapping monograms (three at most, then "+n").
	let {
		ids,
		characters
	}: { ids: number[]; characters: Record<number, { id: number; name: string }> } = $props();

	const people = $derived(ids.map((id) => characters[id]).filter((c) => c !== undefined));
	const names = $derived(people.map((p) => p.name).join(', '));
</script>

{#if people.length > 0}
	<span class="cast" role="img" aria-label="Cast: {names}" title={names}>
		{#each people.slice(0, 3) as person (person.id)}
			<span class="face">{initials(person.name)}</span>
		{/each}
		{#if people.length > 3}<span class="face more">+{people.length - 3}</span>{/if}
	</span>
{/if}

<style>
	.cast {
		flex: none;
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
</style>
