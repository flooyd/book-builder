<script lang="ts" module>
	import type { EntryType } from '$lib/bible';
	import type { Entry } from '$lib/stores';

	/** An entry as the map knows it, keyed "character-12". */
	export type Listed = { key: string; type: EntryType; entry: Entry };
</script>

<script lang="ts">
	import { ENTRY_COPY, ENTRY_TYPES, type Connection } from '$lib/bible';
	import { capitalize } from '$lib/library';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import RichText from '$lib/components/rich/RichText.svelte';
	import EntryConnections from './EntryConnections.svelte';
	import Monogram from './Monogram.svelte';

	// Beside the connections map: the entry picked on it, with its connections to add to or take
	// away, or with nothing picked, how to read the map and who isn't on it yet.
	let {
		chosen,
		connections,
		loose,
		elsewhere,
		showElsewhere,
		entryHref,
		onchoose,
		onclose,
		onadd,
		onremove,
		create
	}: {
		chosen: (Listed & { elsewhere: boolean; onMap: boolean }) | undefined;
		/** The chosen entry's connections. */
		connections: Connection[];
		/** Entries here with no connections, so not on the map. */
		loose: Listed[];
		/** What a visiting entry is called: "From another book". */
		elsewhere: string;
		/** Some entries on the map are visiting. */
		showElsewhere: boolean;
		entryHref: (type: EntryType, entry: Entry) => string;
		onchoose: (key: string) => void;
		onclose: () => void;
		onadd: (connection: Connection) => void;
		onremove: (id: number) => void;
		create: (type: EntryType) => void;
	} = $props();

	const uid = $props.id();

	const kindOf = (item: Listed) =>
		'kind' in item.entry && item.entry.kind
			? item.entry.kind
			: capitalize(ENTRY_COPY[item.type].one);
</script>

{#if chosen}
	<div class="chosen">
		<div class="top">
			<Monogram name={chosen.entry.name} id={chosen.entry.id} size={48} />
			<div class="title">
				<p class="overline">{kindOf(chosen)}</p>
				<h2 id="{uid}-name">{chosen.entry.name}</h2>
			</div>
			<button type="button" class="close" aria-label="Close" onclick={onclose}>
				<Icon name="x" size={18} />
			</button>
		</div>

		{#if chosen.elsewhere}
			<p class="aside">
				<Icon name="info" size={15} />
				<span>{elsewhere}. It's on this map because it's connected to someone who's here.</span>
			</p>
		{/if}

		{#if chosen.entry.description}
			<div class="desc"><RichText value={chosen.entry.description} italic /></div>
		{/if}

		<div class="open">
			<Button href={entryHref(chosen.type, chosen.entry)}>
				Open its page<Icon name="arrow-right" size={16} />
			</Button>
		</div>

		{#key chosen.key}
			<EntryConnections
				type={chosen.type}
				entry={chosen.entry}
				{connections}
				onpick={(type, id) => onchoose(`${type}-${id}`)}
				{onadd}
				{onremove}
			/>
		{/key}

		{#if !chosen.onMap}
			<p class="aside">
				<Icon name="network" size={15} />
				<span>Not on the map yet. Connect {chosen.entry.name} to someone and they will be.</span>
			</p>
		{/if}
	</div>
{:else}
	<div class="idle">
		<section aria-labelledby="{uid}-key">
			<h2 id="{uid}-key">Reading the map</h2>
			<ul class="key">
				{#each ENTRY_TYPES as type (type)}
					<li><span class="mark {type}" aria-hidden="true"></span>{ENTRY_COPY[type].many}</li>
				{/each}
				{#if showElsewhere}
					<li><span class="mark elsewhere" aria-hidden="true"></span>{elsewhere}</li>
				{/if}
			</ul>
			<p class="hint">
				A line takes its colour from its label: “Sister of” is family, “Rival of” a rival. The arrow
				points the way the label reads.
			</p>
			<p class="hint">
				Drag the map to look around, scroll or pinch to zoom, and drag anyone to move them. Where
				you put them is kept in this browser.
			</p>
		</section>

		<section aria-labelledby="{uid}-loose">
			<h2 id="{uid}-loose">Not connected yet</h2>
			{#if loose.length > 0}
				<ul class="loose">
					{#each loose as item (item.key)}
						<li>
							<button type="button" onclick={() => onchoose(item.key)}>
								<Monogram name={item.entry.name} id={item.entry.id} size={32} />
								<span class="loose-text">
									<span class="loose-name">{item.entry.name}</span>
									<span class="loose-kind">{kindOf(item)}</span>
								</span>
								<Icon name="chevron-right" size={16} />
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="hint">Everyone here has at least one connection.</p>
			{/if}
			<div class="add">
				{#each ENTRY_TYPES as type (type)}
					<Button variant="quiet" onclick={() => create(type)}>
						<Icon name="plus" size={15} strokeWidth={2.2} />{capitalize(ENTRY_COPY[type].one)}
					</Button>
				{/each}
			</div>
		</section>
	</div>
{/if}

<style>
	.chosen,
	.idle {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.idle section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.idle section + section {
		padding-top: 18px;
		border-top: 1px solid var(--bb-line-faint);
	}

	.top {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.title {
		flex: 1;
		min-width: 0;
	}

	.overline {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--bb-sky);
	}

	h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 24px;
		line-height: 1.15;
		color: var(--bb-text-strong);
		overflow-wrap: anywhere;
	}

	.top h2 {
		font-size: 26px;
	}

	.close {
		flex: none;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		margin: -6px -10px 0 0;
		align-self: flex-start;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: var(--bb-text-3);
	}

	.close:hover {
		background: var(--bb-hover);
		color: var(--bb-text);
	}

	.desc {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 5;
		line-clamp: 5;
		overflow: hidden;
		font-family: var(--font-read);
		font-size: 16.5px;
		line-height: 1.5;
		color: var(--bb-text-desc);
	}

	.open {
		display: flex;
	}

	.aside {
		display: flex;
		gap: 8px;
		font-size: 14px;
		line-height: 1.45;
		color: var(--bb-text-2);
	}

	.aside :global(svg) {
		margin-top: 2px;
		color: var(--bb-sky);
	}

	.key {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px 12px;
		font-size: 14px;
		color: var(--bb-text-label);
	}

	.key li {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	/* Small copies of the shapes on the map. */
	.mark {
		flex: none;
		width: 18px;
		height: 18px;
		border-radius: 50%;
	}

	.mark.character {
		background: var(--bb-paper);
		box-shadow: inset 0 0 0 1px light-dark(rgba(60, 40, 10, 0.25), transparent);
	}

	.mark.place {
		border-radius: 30%;
		background: var(--bb-royal);
	}

	.mark.system {
		width: 15px;
		height: 15px;
		margin: 0 1.5px;
		border-radius: 22%;
		transform: rotate(45deg);
		background: var(--bb-raised);
		box-shadow: inset 0 0 0 1px var(--bb-line-dashed);
	}

	.mark.elsewhere {
		outline: 2px dashed var(--bb-line-dashed);
		outline-offset: -2px;
	}

	.hint {
		font-size: 14px;
		line-height: 1.5;
		color: var(--bb-text-3);
	}

	.loose {
		margin: 0 -8px;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
	}

	.loose button {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 52px;
		padding: 6px 8px;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: var(--bb-text-3);
		text-align: left;
	}

	.loose button:hover {
		background: var(--bb-hover);
	}

	.loose-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.loose-name {
		font-weight: 600;
		font-size: 15px;
		color: var(--bb-text);
		overflow-wrap: anywhere;
	}

	.loose-kind {
		font-size: 12.5px;
	}

	.add {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-left: -10px;
	}
</style>
