<script lang="ts">
	import { tick } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { useAppHeader } from '$lib/app-header.svelte';
	import { ENTRY_TYPES, type Connection, type EntryType } from '$lib/bible';
	import {
		RELATION_COPY,
		RELATION_KINDS,
		relationKind,
		type MapEdge,
		type MapNode,
		type RelationKind
	} from '$lib/connections';
	import { booksInSeries } from '$lib/series';
	import {
		booksStore,
		charactersStore,
		libraryStatus,
		modalStore,
		placesStore,
		seriesStore,
		systemsStore,
		type Entry
	} from '$lib/stores';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Segmented from '$lib/components/insights/Segmented.svelte';
	import Missing from '$lib/components/story/Missing.svelte';
	import ConnectionsList from './ConnectionsList.svelte';
	import ConnectionsMap from './ConnectionsMap.svelte';
	import ConnectionsPanel, { type Listed } from './ConnectionsPanel.svelte';

	// The story bible's connections drawn as a web, for one book or a whole series. The server sends
	// the connections once; sorting them into kinds, laying out the web and searching it all happen
	// here in the browser (see $lib/connections).
	let {
		scope,
		connections: initial
	}: { scope: { kind: 'book' | 'series'; id: number }; connections: Connection[] } = $props();

	const uid = $props.id();
	// svelte-ignore state_referenced_locally
	let connections = $state(initial);

	const book = $derived(
		scope.kind === 'book' ? $booksStore.find((item) => item.id === scope.id) : undefined
	);
	const series = $derived(
		$seriesStore.find((item) => item.id === (scope.kind === 'series' ? scope.id : book?.seriesId))
	);
	const bookIds = $derived(
		scope.kind === 'book' ? [scope.id] : booksInSeries(scope.id, $booksStore).map((item) => item.id)
	);
	const title = $derived(scope.kind === 'book' ? book?.title : series?.title);
	const id = $derived(String(scope.id));

	const homeHref = $derived(
		scope.kind === 'book' ? resolve('/book/[id]', { id }) : resolve('/series/[id]', { id })
	);
	const bibleHref = $derived(
		scope.kind === 'book'
			? resolve('/book/[id]/bible', { id })
			: resolve('/series/[id]/bible', { id })
	);
	/** From a book in a series to the map of the whole series. */
	const seriesMapHref = $derived(
		scope.kind === 'book' && series
			? resolve('/series/[id]/bible/connections', { id: String(series.id) })
			: null
	);

	useAppHeader((header) => {
		header.wide = true;
		header.crumbs = [
			{ label: 'Library', href: resolve('/') },
			...(title
				? [
						{ label: title, href: homeHref },
						{ label: 'Story bible', href: bibleHref }
					]
				: []),
			{ label: 'Connections' }
		];
	});

	const elsewhere = $derived(
		scope.kind === 'book' ? 'From another book' : 'From outside this series'
	);

	const entryHref = (type: EntryType, entry: Entry) =>
		`${resolve('/bible/[type]/[id]', { type, id: String(entry.id) })}?${scope.kind}=${scope.id}`;

	// ---- What's on the map ------------------------------------------------------------------

	const all = $derived<Record<EntryType, Entry[]>>({
		character: $charactersStore,
		place: $placesStore,
		system: $systemsStore
	});

	/** Every entry the writer has, by key, so a connection can find both its ends. */
	const lookup = $derived.by(() => {
		const found: Record<string, Listed> = {};
		for (const type of ENTRY_TYPES) {
			for (const entry of all[type])
				found[`${type}-${entry.id}`] = { key: `${type}-${entry.id}`, type, entry };
		}
		return found;
	});

	const here = (entry: Entry) => entry.bookIds.some((bookId) => bookIds.includes(bookId));

	const edges = $derived(
		connections.flatMap((connection): MapEdge[] => {
			const from = `${connection.fromType}-${connection.fromId}`;
			const to = `${connection.toType}-${connection.toId}`;
			const [a, b] = [lookup[from], lookup[to]];
			if (!a || !b || (!here(a.entry) && !here(b.entry))) return [];
			const kind = relationKind(connection.label);
			return [{ id: connection.id, from, to, label: connection.label, kind }];
		})
	);

	const degrees = $derived.by(() => {
		const counts: Record<string, number> = {};
		for (const edge of edges) {
			counts[edge.from] = (counts[edge.from] ?? 0) + 1;
			counts[edge.to] = (counts[edge.to] ?? 0) + 1;
		}
		return counts;
	});

	const byName = (a: Listed, b: Listed) => a.entry.name.localeCompare(b.entry.name);

	const nodes = $derived<MapNode[]>(
		Object.keys(degrees)
			.map((key) => lookup[key])
			.sort(byName)
			.map(({ key, type, entry }) => ({
				key,
				type,
				id: entry.id,
				name: entry.name,
				elsewhere: !here(entry),
				degree: degrees[key]
			}))
	);

	/** This book's or series' entries. */
	const bible = $derived(Object.values(lookup).filter((item) => here(item.entry)));
	const loose = $derived(bible.filter((item) => !degrees[item.key]).sort(byName));

	const counts = $derived(
		Object.fromEntries(
			RELATION_KINDS.map((kind) => [kind, edges.filter((edge) => edge.kind === kind).length])
		) as Record<RelationKind, number>
	);

	// ---- What the writer has chosen ---------------------------------------------------------

	let shown = $state<Record<RelationKind, boolean>>({
		family: true,
		allies: true,
		rivals: true,
		other: true
	});
	let query = $state('');
	let view = $state<'map' | 'list'>('map');
	let selected = $state<string | null>(page.url.searchParams.get('focus'));
	let map = $state<ReturnType<typeof ConnectionsMap>>();
	let sheet = $state<HTMLElement>();

	/** On a narrow screen a chosen entry opens in a sheet over the page, not beside the map. */
	const narrow = new MediaQuery('max-width: 960px');

	const needle = $derived(query.trim().toLowerCase());
	const named = (entry: Entry) =>
		[entry.name, ...entry.aliases].some((name) => name.toLowerCase().includes(needle));

	const matches = $derived(
		needle ? nodes.filter((node) => named(lookup[node.key].entry)).map((node) => node.key) : null
	);

	/** The connections the list shows: the kinds turned on, and any search. */
	const listed = $derived(
		edges.filter(
			(edge) =>
				shown[edge.kind] &&
				(!needle || named(lookup[edge.from].entry) || named(lookup[edge.to].entry))
		)
	);

	const chosen = $derived.by(() => {
		const item = selected ? lookup[selected] : undefined;
		return item ? { ...item, elsewhere: !here(item.entry), onMap: !!degrees[item.key] } : undefined;
	});

	const chosenConnections = $derived(
		chosen
			? connections.filter(
					(connection) =>
						`${connection.fromType}-${connection.fromId}` === chosen.key ||
						`${connection.toType}-${connection.toId}` === chosen.key
				)
			: []
	);

	/** Where a phone's bottom sheet starts, so the map keeps the chosen entry above it. */
	function coveredFrom() {
		// Its height rather than its box: the box moves while the sheet slides up.
		return sheet ? innerHeight - sheet.offsetHeight : Infinity;
	}

	// Whatever chose an entry (the map, the search, the panel), bring it into view.
	$effect(() => {
		const key = selected;
		if (!key || view !== 'map') return;
		tick().then(() => map?.reveal(key, coveredFrom()));
	});

	function find(event: SubmitEvent) {
		event.preventDefault();
		const first = matches?.[0] ?? loose.find((item) => named(item.entry))?.key;
		if (first) selected = first;
	}

	function create(category: EntryType) {
		modalStore.set({
			type: 'create',
			category,
			...(scope.kind === 'book' ? { bookId: scope.id } : { seriesId: scope.id, bookIds }),
			// Stay on the map with the new entry picked, ready to connect.
			oncreate: (type, newId) => (selected = `${type}-${newId}`)
		});
	}
</script>

<svelte:head>
	<title>{title ? `Connections · ${title} · Book Builder` : 'Connections · Book Builder'}</title>
</svelte:head>

{#snippet side(picked: typeof chosen)}
	<ConnectionsPanel
		chosen={picked}
		connections={chosenConnections}
		{loose}
		{elsewhere}
		showElsewhere={nodes.some((node) => node.elsewhere)}
		{entryHref}
		{create}
		onchoose={(key) => (selected = key)}
		onclose={() => (selected = null)}
		onadd={(connection) => connections.push(connection)}
		onremove={(removed) =>
			(connections = connections.filter((connection) => connection.id !== removed))}
	/>
{/snippet}

{#if title}
	<main class="connections">
		<header class="head">
			<div class="head-text">
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- homeHref is resolve()d -->
				<a class="overline" href={homeHref}>{title}</a>
				<h1><motion-headline by="chars" interval={0.03}>Connections</motion-headline></h1>
				<p class="sub">
					Who's family, who's a rival and who owes whom: your story bible's connections, drawn as a
					web.
				</p>
			</div>
			<div class="actions">
				{#if seriesMapHref}
					<Button href={seriesMapHref}><Icon name="library" size={16} />Whole series</Button>
				{/if}
				<Button href={bibleHref}><Icon name="book-marked" size={16} />Story bible</Button>
			</div>
		</header>

		<div class="tools">
			<form class="search" role="search" onsubmit={find}>
				<label class="sr-only" for="{uid}-find">Find someone on the map</label>
				<Icon name="search" size={17} />
				<input
					id="{uid}-find"
					class="bb-field"
					type="search"
					placeholder="Find someone"
					autocomplete="off"
					bind:value={query}
				/>
			</form>
			<div class="kinds" role="group" aria-label="Show these connections">
				{#each RELATION_KINDS as kind (kind)}
					<button
						type="button"
						class={['kind', kind]}
						aria-pressed={shown[kind]}
						title={RELATION_COPY[kind].long}
						onclick={() => (shown[kind] = !shown[kind])}
					>
						<span class="swatch" aria-hidden="true"></span>
						{RELATION_COPY[kind].label}
						<span class="count">{counts[kind]}</span>
					</button>
				{/each}
			</div>
			<Segmented
				options={[
					{ id: 'map', label: 'Map' },
					{ id: 'list', label: 'List', count: edges.length }
				]}
				bind:value={view}
				label="Show as"
			/>
		</div>

		<div class="stage">
			{#if view === 'map'}
				<section class="map" aria-label="Connections map">
					<p class="sr-only">
						Each entry on the map is a button that shows its connections. The list has every
						connection written out.
					</p>
					<ConnectionsMap
						bind:this={map}
						bind:selected
						{nodes}
						{edges}
						{shown}
						{matches}
						{elsewhere}
						storageKey="bb-connections-{scope.kind}-{scope.id}"
						onready={() => selected && map?.reveal(selected, coveredFrom())}
					>
						{#snippet empty()}
							{#if $libraryStatus === 'ready'}
								<div class="blank">
									{#if bible.length === 0}
										<h2>No one's here yet.</h2>
										<p>Add characters, places and systems to the story bible, then connect them.</p>
										<Button variant="primary" onclick={() => create('character')}>
											<Icon name="plus" size={16} strokeWidth={2.2} />New character
										</Button>
									{:else}
										<h2>Nothing's connected yet.</h2>
										<p>
											Choose someone who isn't connected yet and say how they're tied to someone
											else: sister of, rival of, captain of.
										</p>
									{/if}
								</div>
							{/if}
						{/snippet}
					</ConnectionsMap>
				</section>
			{:else}
				<section class="card" aria-label="Every connection">
					{#if listed.length > 0}
						<ConnectionsList edges={listed} {lookup} {entryHref} />
					{:else}
						<p class="nothing">
							{edges.length === 0
								? 'Nothing is connected yet.'
								: 'No connections match. Try another name, or turn a kind back on.'}
						</p>
					{/if}
				</section>
			{/if}

			<!-- On a phone this stays put under the map while a chosen entry opens in the sheet, so
			     the page keeps its height and doesn't scroll by itself. -->
			<aside
				class="panel"
				aria-label={chosen && !narrow.current ? chosen.entry.name : 'About the map'}
			>
				{@render side(narrow.current ? undefined : chosen)}
			</aside>
		</div>
	</main>

	{#if narrow.current && chosen}
		<aside class="sheet" bind:this={sheet} aria-label={chosen.entry.name}>
			{@render side(chosen)}
		</aside>
	{/if}
{:else}
	<Missing noun={scope.kind} />
{/if}

<style>
	.connections {
		max-width: 1360px;
		margin: 0 auto;
		padding: 40px 32px 64px;
		display: flex;
		flex-direction: column;
		gap: 22px;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 20px 32px;
	}

	.head-text {
		flex: 1 1 420px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.overline {
		align-self: flex-start;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--bb-sky);
		text-decoration: none;
		overflow-wrap: anywhere;
	}

	.overline:hover {
		text-decoration: underline;
	}

	h1 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(38px, 6vw, 58px);
		line-height: 1.05;
		color: var(--bb-text-strong);
	}

	.sub {
		max-width: 600px;
		font-family: var(--font-read);
		font-size: 19px;
		line-height: 1.5;
		color: var(--bb-text-2);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px 16px;
	}

	.search {
		position: relative;
		flex: 1 1 240px;
		min-width: 0;
		max-width: 380px;
		color: var(--bb-text-3);
	}

	.search :global(svg) {
		position: absolute;
		top: 50%;
		left: 14px;
		transform: translateY(-50%);
		pointer-events: none;
	}

	.search input {
		min-height: 44px;
		padding-left: 40px;
		font-size: 15px;
	}

	.kinds {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-right: auto;
	}

	.kind {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		padding: 0 14px;
		border-radius: 12px;
		border: 1px solid var(--bb-line-soft);
		background: var(--bb-ink);
		color: var(--bb-text-label);
		font: 600 14px var(--font-ui);
	}

	.kind:hover {
		border-color: var(--tie);
	}

	.swatch {
		width: 16px;
		height: 4px;
		border-radius: 2px;
		background: var(--tie);
	}

	.count {
		font-weight: 500;
		color: var(--bb-text-3);
	}

	.kind[aria-pressed='false'] {
		background: transparent;
		border-style: dashed;
		color: var(--bb-text-3);
	}

	.kind[aria-pressed='false'] .swatch {
		background: transparent;
		box-shadow: inset 0 0 0 1.5px var(--tie);
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

	.stage {
		/* The map fits on the first screen, under the page's heading and tools. */
		--stage-h: clamp(420px, calc(100dvh - 380px), 1000px);
		display: grid;
		grid-template-columns: minmax(0, 1fr) 340px;
		align-items: start;
		gap: 16px;
	}

	.map {
		position: relative;
		height: var(--stage-h);
		overflow: hidden;
		border-radius: var(--r-card);
		border: 1px solid var(--bb-line-soft);
	}

	.card {
		min-height: 240px;
		padding: 8px 22px;
		border-radius: var(--r-card);
		border: 1px solid var(--bb-line-soft);
		background: var(--bb-ink);
	}

	.nothing {
		padding: 24px 0;
		font-size: 15px;
		color: var(--bb-text-3);
	}

	.panel {
		position: sticky;
		top: calc(var(--app-header-h, 64px) + 16px);
		max-height: var(--stage-h);
		overflow: auto;
		overscroll-behavior: contain;
		padding: 20px 22px;
		border-radius: var(--r-card);
		border: 1px solid var(--bb-line-soft);
		background: var(--bb-ink);
	}

	.blank {
		max-width: 380px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		pointer-events: auto;
	}

	.blank h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 28px;
		color: var(--bb-text-strong);
	}

	.blank p {
		margin-bottom: 6px;
		font-family: var(--font-read);
		font-size: 17px;
		line-height: 1.5;
		color: var(--bb-text-2);
	}

	@media (max-width: 960px) {
		.stage {
			grid-template-columns: minmax(0, 1fr);
		}

		.map {
			height: clamp(360px, 62dvh, 620px);
		}

		.panel {
			position: static;
			max-height: none;
		}
	}

	/* A chosen entry on a narrow screen, in a sheet over the bottom of the page. */
	.sheet {
		position: fixed;
		z-index: 30;
		left: 0;
		right: 0;
		bottom: 0;
		max-height: 60dvh;
		overflow: auto;
		overscroll-behavior: contain;
		padding: 20px 16px calc(20px + env(safe-area-inset-bottom));
		border-radius: 22px 22px 0 0;
		border: 1px solid var(--bb-line-soft);
		border-bottom: none;
		background: var(--bb-ink);
		box-shadow: var(--shadow-modal);
		animation: rise 0.24s ease-out;
	}

	@media (max-width: 760px) {
		.connections {
			padding: 28px 16px 64px;
			gap: 18px;
		}

		.search {
			max-width: none;
			flex-basis: 100%;
		}

		.kind {
			padding: 0 11px;
		}
	}

	@keyframes rise {
		from {
			transform: translateY(40px);
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sheet {
			animation: none;
		}
	}
</style>
