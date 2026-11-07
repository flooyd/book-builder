<script lang="ts">
	import type { EntryType } from '$lib/bible';
	import { RELATION_COPY, type MapEdge } from '$lib/connections';
	import type { Entry } from '$lib/stores';
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { Listed } from './ConnectionsPanel.svelte';

	// The connections map as a list: every connection as a line of words, "Juno Halley, Captain of,
	// the Meridian", in the order of the first name. Easier to scan on a phone, and it's what a
	// screen reader gets instead of the drawing.
	let {
		edges,
		lookup,
		entryHref
	}: {
		edges: MapEdge[];
		lookup: Record<string, Listed>;
		entryHref: (type: EntryType, entry: Entry) => string;
	} = $props();

	const rows = $derived(
		edges
			.flatMap((edge) => {
				const [from, to] = [lookup[edge.from], lookup[edge.to]];
				return from && to ? [{ edge, from, to }] : [];
			})
			.sort(
				(a, b) =>
					a.from.entry.name.localeCompare(b.from.entry.name) ||
					a.to.entry.name.localeCompare(b.to.entry.name)
			)
	);
</script>

<ul class="list">
	{#each rows as { edge, from, to } (edge.id)}
		<li>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- entryHref is resolve()d -->
			<a href={entryHref(from.type, from.entry)}>{from.entry.name}</a>
			<span class="tie {edge.kind}" title={RELATION_COPY[edge.kind].long}>
				<span class="dot" aria-hidden="true"></span>
				{edge.label || 'Connected to'}
				<Icon name="arrow-right" size={14} />
			</span>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- entryHref is resolve()d -->
			<a href={entryHref(to.type, to.entry)}>{to.entry.name}</a>
		</li>
	{/each}
</ul>

<style>
	.list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
	}

	li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 12px;
		min-height: 52px;
		padding: 8px 4px;
		border-bottom: 1px solid var(--bb-line-faint);
	}

	li:last-child {
		border-bottom: none;
	}

	a {
		display: inline-flex;
		align-items: center;
		min-height: 36px;
		font-weight: 600;
		font-size: 15.5px;
		color: var(--bb-text-strong);
		text-decoration: none;
		overflow-wrap: anywhere;
	}

	a:hover {
		color: var(--bb-sky);
		text-decoration: underline;
	}

	.tie {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 3px 10px 4px;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--tie) 45%, transparent);
		color: var(--tie);
		font-size: 13.5px;
		font-weight: 600;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--tie);
	}

	.family {
		--tie: var(--bb-tie-family);
	}

	.allies {
		--tie: var(--bb-tie-allies);
	}

	.rivals {
		--tie: var(--bb-tie-rivals);
	}

	.other {
		--tie: var(--bb-tie-other);
	}
</style>
