<script lang="ts">
	import { flip } from 'svelte/animate';
	import { plural } from '$lib/library';
	import type { Place } from '$lib/outline.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { indexAt } from './drag';
	import type { Group, Item, OutlineUi } from './types';
	import EditableText from './EditableText.svelte';
	import StatusPill from './StatusPill.svelte';
	import CastStack from './CastStack.svelte';

	// The outline as one nested list: parts, with their chapters under them. Parts fold; while a
	// part is dragged every part folds, so parts move as whole blocks.
	let {
		groups,
		ui,
		collapsed,
		ontoggle,
		duration
	}: {
		groups: Group[];
		ui: OutlineUi;
		collapsed: number[];
		ontoggle: (partId: number) => void;
		/** Reorder animation length (0 for reduced motion). */
		duration: number;
	} = $props();

	type Row = { key: string; item: Item; chapters: number } | { key: string; addTo: number };

	const partDragging = $derived(!!ui.dragging?.startsWith('part-'));

	// One flat, keyed list: a chapter moving to another part keeps its element (and focus).
	const rows = $derived(
		groups.flatMap((group): Row[] => {
			const part = { key: group.part.key, item: group.part, chapters: group.chapters.length };
			if (!group.part.holdsChapters || partDragging || collapsed.includes(group.part.id)) {
				return [part];
			}
			return [
				part,
				...group.chapters.map((item) => ({ key: item.key, item, chapters: 0 })),
				...(ui.canReorder ? [{ key: `add-${group.part.id}`, addTo: group.part.id }] : [])
			];
		})
	);

	let list = $state<HTMLElement>();

	/** Where a dragged part or chapter would land, from the rows' layout. */
	function locate(item: Item) {
		return (_x: number, y: number): Place | null => {
			if (!list) return null;
			const others = ([...list.children] as HTMLElement[]).filter(
				(row) =>
					row.dataset.key !== item.key &&
					(row.dataset.kind === 'part' ||
						(item.kind === 'chapter' && row.dataset.kind === 'chapter'))
			);
			const index = indexAt(others, list, y, 'y');
			if (item.kind === 'part') return { index };

			// A chapter goes into the nearest part above that holds chapters.
			let count = 0;
			for (let i = index - 1; i >= 0; i--) {
				const row = others[i];
				if (row.dataset.kind === 'chapter') count++;
				else if (row.dataset.holds === 'true') {
					// Folded: its chapters aren't on screen, so add to the end.
					const end = row.dataset.collapsed === 'true' ? Number(row.dataset.count) : count;
					return { partId: Number(row.dataset.id), index: end };
				}
			}
			// Above every part that holds chapters: first in the first one.
			const first = others.find((row) => row.dataset.holds === 'true');
			return first ? { partId: Number(first.dataset.id), index: 0 } : null;
		};
	}

	const startDrag = (item: Item, event: PointerEvent) => {
		const row = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-key]');
		if (row) ui.drag(item, event, row, locate(item));
	};

	const words = (n: number) => `${n.toLocaleString('en')} ${n === 1 ? 'word' : 'words'}`;
</script>

{#snippet grip(item: Item)}
	<button
		type="button"
		class="grip"
		id="grip-{item.key}"
		aria-label="Move {item.title}"
		aria-keyshortcuts="ArrowUp ArrowDown"
		title={ui.canReorder ? 'Drag to move, or use ↑ ↓' : 'Clear the filters to rearrange'}
		onpointerdown={(event) => startDrag(item, event)}
		onkeydown={(event) => ui.gripKeys(item, event)}
	>
		<Icon name="grip" size={16} />
	</button>
{/snippet}

{#snippet meta(item: Item)}
	<CastStack ids={item.cast} characters={ui.characters} />
	{#if !item.holdsChapters}
		<StatusPill
			value={item.status}
			label="Status of {item.title}"
			onchange={(status) => ui.save(item, { status })}
		/>
	{/if}
	<span class="words">{words(item.words)}</span>
	<button
		type="button"
		class="more"
		aria-label="Details of {item.title}"
		onclick={(event) => {
			event.stopPropagation();
			ui.details(item.key);
		}}
	>
		<Icon name="info" size={17} />
	</button>
{/snippet}

<div class="list" bind:this={list}>
	{#each rows as row (row.key)}
		<div
			class="slot"
			animate:flip={{ duration }}
			data-key={row.key}
			data-kind={'item' in row ? row.item.kind : 'add'}
			data-id={'item' in row ? row.item.id : undefined}
			data-holds={'item' in row ? row.item.holdsChapters : undefined}
			data-collapsed={'item' in row ? collapsed.includes(row.item.id) || partDragging : undefined}
			data-count={'item' in row ? row.chapters : undefined}
		>
			{#if 'addTo' in row}
				<button type="button" class="add-chapter" onclick={() => ui.addChapter(row.addTo)}>
					<Icon name="plus" size={15} strokeWidth={2.2} />Add chapter
				</button>
			{:else if row.item.kind === 'part'}
				{@const item = row.item}
				{@const folded = collapsed.includes(item.id)}
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
				<div
					class={[
						'row',
						'part',
						{ story: !item.holdsChapters },
						{ selected: ui.selected === item.key, dragging: ui.dragging === item.key }
					]}
					onclick={() => ui.select(item.key)}
				>
					{#if item.holdsChapters}
						<button
							type="button"
							class="fold"
							aria-expanded={!folded}
							aria-label="{folded ? 'Unfold' : 'Fold'} {item.title}"
							onclick={(event) => {
								event.stopPropagation();
								ontoggle(item.id);
							}}
						>
							<span class="fold-icon" class:folded><Icon name="chevron-down" size={17} /></span>
						</button>
					{:else}
						<span class="fold kind" aria-hidden="true"><Icon name="file-text" size={16} /></span>
					{/if}
					{@render grip(item)}
					<div class="main">
						<span class="overline">{item.label ?? 'Story text'}</span>
						<EditableText
							id="title-{item.key}"
							class="title part-title"
							value={item.title}
							label="Title of {item.label ?? 'story text part'}"
							required
							onsave={(title) => ui.save(item, { title })}
							onkeydown={(event) => ui.titleKeys(item, event)}
							onfocus={() => ui.select(item.key)}
						/>
						{#if ui.synopses}
							<EditableText
								class="synopsis"
								multiline
								value={item.description}
								label="Synopsis of {item.title}"
								placeholder="What is this part about?"
								onsave={(description) => ui.save(item, { description })}
								onfocus={() => ui.select(item.key)}
							/>
						{/if}
					</div>
					<div class="meta">
						{#if item.holdsChapters}
							<span class="count">{plural(row.chapters, 'chapter')}</span>
						{/if}
						{@render meta(item)}
					</div>
				</div>
			{:else}
				{@const item = row.item}
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
				<div
					class={[
						'row',
						'chapter',
						{ selected: ui.selected === item.key, dragging: ui.dragging === item.key }
					]}
					onclick={() => ui.select(item.key)}
				>
					{@render grip(item)}
					<span class="num">{item.number}</span>
					<div class="main">
						<EditableText
							id="title-{item.key}"
							class="title"
							value={item.title}
							label="Title of chapter {item.number}"
							required
							onsave={(title) => ui.save(item, { title })}
							onkeydown={(event) => ui.titleKeys(item, event)}
							onfocus={() => ui.select(item.key)}
						/>
						{#if ui.synopses}
							<EditableText
								class="synopsis"
								multiline
								value={item.description}
								label="Synopsis of {item.title}"
								placeholder="What happens here?"
								onsave={(description) => ui.save(item, { description })}
								onfocus={() => ui.select(item.key)}
							/>
						{/if}
					</div>
					<div class="meta">{@render meta(item)}</div>
				</div>
			{/if}
		</div>
	{/each}
</div>

<style>
	/* Layout positions are measured from here (see drag.ts). */
	.list {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.slot[data-kind='part']:not(:first-child) {
		margin-top: 14px;
	}

	.row {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		padding: 8px 10px;
		border: 1px solid transparent;
		border-radius: var(--r-row);
		background: transparent;
		color: var(--bb-text);
	}

	.row:hover {
		background: var(--bb-hover);
	}

	.row.selected {
		background: var(--bb-ink);
		border-color: var(--bb-line-soft);
		box-shadow: inset 3px 0 0 var(--bb-sky);
	}

	.row.part {
		padding: 12px 10px;
		background: var(--bb-ink);
		border-color: var(--bb-line-soft);
	}

	.row.part.selected {
		border-color: var(--bb-line-control);
	}

	.row.chapter {
		margin-left: 34px;
	}

	/* The dragged item's place: an outline of where it will land. */
	.row.dragging {
		border: 1.5px dashed var(--bb-line-dashed);
		background: transparent;
		box-shadow: none;
	}

	.row.dragging > :global(*) {
		opacity: 0.25;
	}

	:global(.drag-ghost) .row {
		background: var(--bb-ink);
		border-color: var(--bb-line-control);
		box-shadow: 0 24px 48px -16px var(--bb-drop);
	}

	.fold,
	.grip,
	.more {
		flex: none;
		display: grid;
		place-items: center;
		width: 32px;
		height: 36px;
		padding: 0;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--bb-text-3);
	}

	.fold:hover,
	.more:hover {
		background: var(--bb-raised);
		color: var(--bb-text);
	}

	.fold.kind {
		color: var(--bb-sky);
	}

	.fold-icon {
		display: grid;
		transition: transform 0.2s;
	}

	.fold-icon.folded {
		transform: rotate(-90deg);
	}

	.grip {
		width: 24px;
		cursor: grab;
		touch-action: none;
	}

	.grip:hover {
		color: var(--bb-text);
	}

	:global(.outline-dragging),
	:global(.outline-dragging *) {
		cursor: grabbing !important;
		-webkit-user-select: none;
		user-select: none;
	}

	.num {
		flex: none;
		width: 26px;
		padding-top: 7px;
		text-align: right;
		font-family: var(--font-display);
		font-size: 16px;
		color: var(--bb-text-4);
	}

	.main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.overline {
		padding: 2px 7px 0;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--bb-sky);
	}

	.main :global(.title) {
		font-family: var(--font-read);
		font-size: 18px;
		line-height: 1.4;
	}

	.main :global(.part-title) {
		font-family: var(--font-display);
		font-size: 23px;
		line-height: 1.2;
		color: var(--bb-text-strong);
	}

	.main :global(.synopsis) {
		font-family: var(--font-read);
		font-style: italic;
		font-size: 15.5px;
		line-height: 1.45;
		color: var(--bb-text-desc);
	}

	.meta {
		flex: none;
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 36px;
	}

	.part .meta {
		min-height: 52px;
	}

	.count,
	.words {
		font-size: 13px;
		color: var(--bb-text-3);
		white-space: nowrap;
	}

	.words {
		min-width: 74px;
		text-align: right;
	}

	.add-chapter {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 40px;
		margin: 2px 0 0 66px;
		padding: 0 12px;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: var(--bb-text-3);
		font: 600 14px var(--font-ui);
	}

	.add-chapter:hover {
		background: var(--bb-hover);
		color: var(--bb-sky);
	}

	@media (max-width: 700px) {
		.row {
			flex-wrap: wrap;
			padding: 8px 6px;
		}

		.row.chapter {
			margin-left: 14px;
		}

		.main {
			flex-basis: calc(100% - 80px);
		}

		.meta {
			width: 100%;
			justify-content: flex-end;
			min-height: 0;
		}

		.part .meta {
			min-height: 0;
		}

		.add-chapter {
			margin-left: 24px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.fold-icon {
			transition: none;
		}
	}
</style>
