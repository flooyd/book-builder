<script lang="ts">
	import { flip } from 'svelte/animate';
	import { plural } from '$lib/library';
	import type { Place } from '$lib/outline.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { indexAt } from './drag';
	import type { Group, Item, OutlineUi } from './types';
	import EditableText from './EditableText.svelte';
	import RichInline from '$lib/components/rich/RichInline.svelte';
	import StatusPill from './StatusPill.svelte';
	import CastStack from './CastStack.svelte';

	// The corkboard: a column per part, a card per chapter. Drag cards within and between
	// columns, and columns by their heads. A part that holds story text is a column of one card.
	let { groups, ui, duration }: { groups: Group[]; ui: OutlineUi; duration: number } = $props();

	let board = $state<HTMLElement>();
	let track = $state<HTMLElement>();

	function locate(item: Item) {
		return (x: number, y: number): Place | null => {
			if (!track) return null;
			const columns = [...track.querySelectorAll<HTMLElement>(':scope > [data-column]')];
			if (item.kind === 'part') {
				const others = columns.filter((column) => column.dataset.key !== item.key);
				return { index: indexAt(others, track, x, 'x') };
			}
			// The column under the pointer, or the nearest one that takes chapters.
			let best: HTMLElement | null = null;
			let distance = Infinity;
			for (const column of columns) {
				if (column.dataset.accepts !== 'true') continue;
				const box = column.getBoundingClientRect();
				const d = x < box.left ? box.left - x : x > box.right ? x - box.right : 0;
				if (d < distance) [best, distance] = [column, d];
			}
			const cards = best?.querySelector<HTMLElement>('[data-cards]');
			if (!best || !cards) return null;
			const others = [...cards.querySelectorAll<HTMLElement>(':scope > [data-card]')].filter(
				(card) => card.dataset.key !== item.key
			);
			return { partId: Number(best.dataset.column), index: indexAt(others, cards, y, 'y') };
		};
	}

	const startDrag = (item: Item, event: PointerEvent) => {
		const element = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-key]');
		if (element) ui.drag(item, event, element, locate(item), board);
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

{#snippet details(item: Item)}
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

{#snippet foot(item: Item)}
	<footer class="card-foot">
		<StatusPill
			value={item.status}
			label="Status of {item.title}"
			onchange={(status) => ui.save(item, { status })}
		/>
		<CastStack ids={item.cast} characters={ui.characters} />
		<span class="words">{words(item.words)}</span>
	</footer>
{/snippet}

<div class="board" bind:this={board}>
	<div class="track" bind:this={track}>
		{#each groups as group (group.part.key)}
			{@const part = group.part}
			<section
				class={['column', { dragging: ui.dragging === part.key }]}
				animate:flip={{ duration }}
				data-column={part.id}
				data-accepts={part.holdsChapters}
				data-key={part.key}
				aria-label={part.label ? `${part.label}: ${part.title}` : part.title}
			>
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
				<header
					class={['column-head', { selected: ui.selected === part.key }]}
					onclick={() => ui.select(part.key)}
				>
					<div class="head-row">
						{@render grip(part)}
						<span class="overline">{part.label ?? 'Story text'}</span>
						{@render details(part)}
					</div>
					<EditableText
						id="title-{part.key}"
						class="column-title"
						value={part.title}
						label="Title of {part.label ?? 'story text part'}"
						required
						onsave={(title) => ui.save(part, { title })}
						onkeydown={(event) => ui.titleKeys(part, event)}
						onfocus={() => ui.select(part.key)}
					/>
					{#if part.holdsChapters}
						<p class="column-meta">
							{plural(group.chapters.length, 'chapter')} · {words(part.words)}
						</p>
						{#if ui.synopses}
							<RichInline
								class="synopsis"
								value={part.description}
								label="Synopsis of {part.title}"
								placeholder="What is this part about?"
								onsave={(description) => ui.save(part, { description })}
								onfocus={() => ui.select(part.key)}
							/>
						{/if}
					{/if}
				</header>

				{#if part.holdsChapters}
					<div class="cards" data-cards>
						{#each group.chapters as card (card.key)}
							<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
							<article
								class={[
									'card',
									{ selected: ui.selected === card.key, dragging: ui.dragging === card.key }
								]}
								style:--stripe="var(--status-{card.status})"
								animate:flip={{ duration }}
								data-card
								data-key={card.key}
								onclick={() => ui.select(card.key)}
							>
								<div class="card-top">
									{@render grip(card)}
									<span class="card-num">Chapter {card.number}</span>
									{@render details(card)}
								</div>
								<EditableText
									id="title-{card.key}"
									class="card-title"
									value={card.title}
									label="Title of chapter {card.number}"
									required
									onsave={(title) => ui.save(card, { title })}
									onkeydown={(event) => ui.titleKeys(card, event)}
									onfocus={() => ui.select(card.key)}
								/>
								{#if ui.synopses}
									<RichInline
										class="synopsis"
										value={card.description}
										label="Synopsis of {card.title}"
										placeholder="What happens here?"
										onsave={(description) => ui.save(card, { description })}
										onfocus={() => ui.select(card.key)}
									/>
								{/if}
								{@render foot(card)}
							</article>
						{/each}
					</div>
					{#if ui.canReorder}
						<button type="button" class="add" onclick={() => ui.addChapter(part.id)}>
							<Icon name="plus" size={15} strokeWidth={2.2} />Add chapter
						</button>
					{/if}
				{:else}
					<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
					<article
						class={['card', 'story-card', { selected: ui.selected === part.key }]}
						style:--stripe="var(--status-{part.status})"
						onclick={() => ui.select(part.key)}
					>
						{#if ui.synopses}
							<RichInline
								class="synopsis"
								value={part.description}
								label="Synopsis of {part.title}"
								placeholder="What happens here?"
								onsave={(description) => ui.save(part, { description })}
								onfocus={() => ui.select(part.key)}
							/>
						{/if}
						{@render foot(part)}
					</article>
				{/if}
			</section>
		{/each}

		{#if ui.canReorder}
			<div class="add-column">
				<button type="button" class="add" onclick={() => ui.addPart(true)}>
					<Icon name="plus" size={15} strokeWidth={2.2} />Add part
				</button>
				<button type="button" class="add" onclick={() => ui.addPart(false)}>
					<Icon name="file-text" size={15} />Add story text
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.board {
		overflow-x: auto;
		padding: 4px 4px 20px;
		margin: 0 -4px;
		scroll-snap-type: x proximity;
	}

	/* Layout positions are measured from here (see drag.ts). */
	.track {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: 16px;
		width: max-content;
	}

	.column {
		flex: none;
		width: 290px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 10px;
		border-radius: var(--r-card);
		background: var(--bb-panel);
		border: 1px solid var(--bb-line-faint);
		scroll-snap-align: start;
	}

	.column.dragging {
		border: 1.5px dashed var(--bb-line-dashed);
		background: transparent;
	}

	.column.dragging > :global(*) {
		opacity: 0.25;
	}

	.column-head {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 6px 4px 8px;
		border-radius: 14px;
	}

	.column-head.selected {
		box-shadow: inset 0 0 0 1px var(--bb-line-control);
		background: var(--bb-ink);
	}

	.head-row,
	.card-top {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.overline,
	.card-num {
		flex: 1;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--bb-sky);
	}

	.card-num {
		color: var(--bb-text-3);
	}

	.column-head :global(.column-title) {
		font-family: var(--font-display);
		font-size: 22px;
		line-height: 1.2;
		color: var(--bb-text-strong);
	}

	.column-meta {
		padding: 0 7px;
		font-size: 13px;
		color: var(--bb-text-3);
	}

	.cards {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-height: 60px;
	}

	/* Index cards: a status stripe along the top. */
	.card {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px 10px 10px;
		border-radius: 14px;
		background: var(--bb-ink);
		border: 1px solid var(--bb-line-soft);
		box-shadow:
			inset 0 3px 0 var(--stripe),
			0 10px 24px -18px var(--bb-drop);
	}

	.card:hover {
		border-color: var(--bb-line-control);
	}

	.card.selected {
		border-color: var(--bb-sky);
	}

	.card.dragging {
		border: 1.5px dashed var(--bb-line-dashed);
		background: transparent;
		box-shadow: none;
	}

	.card.dragging > :global(*) {
		opacity: 0.25;
	}

	:global(.drag-ghost).card,
	:global(.drag-ghost).column {
		box-shadow: 0 24px 48px -16px var(--bb-drop);
	}

	.card :global(.card-title) {
		font-family: var(--font-read);
		font-weight: 500;
		font-size: 18px;
		line-height: 1.3;
	}

	.column :global(.synopsis) {
		font-family: var(--font-read);
		font-style: italic;
		font-size: 15px;
		line-height: 1.45;
		color: var(--bb-text-desc);
	}

	.card-foot {
		display: flex;
		align-items: center;
		gap: 8px;
		padding-top: 4px;
	}

	.words {
		margin-left: auto;
		font-size: 12.5px;
		color: var(--bb-text-3);
		white-space: nowrap;
	}

	.grip,
	.more {
		flex: none;
		display: grid;
		place-items: center;
		width: 30px;
		height: 32px;
		padding: 0;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--bb-text-3);
	}

	.grip {
		cursor: grab;
		touch-action: none;
	}

	.grip:hover,
	.more:hover {
		background: var(--bb-raised);
		color: var(--bb-text);
	}

	.add {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: 44px;
		border: 1.5px dashed var(--bb-line-control);
		border-radius: 12px;
		background: transparent;
		color: var(--bb-text-3);
		font: 600 14px var(--font-ui);
	}

	.add:hover {
		border-color: var(--bb-sky);
		color: var(--bb-sky);
	}

	.add-column {
		flex: none;
		width: 200px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding-top: 10px;
	}

	@media (max-width: 600px) {
		.column {
			width: min(290px, calc(100vw - 72px));
		}
	}
</style>
