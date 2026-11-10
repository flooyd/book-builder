<script lang="ts">
	import { tick } from 'svelte';
	import Icon, { type IconName } from '$lib/components/ui/Icon.svelte';
	import { BLENDS, shapeLabel, type Layer, type Shape } from '$lib/drawing';
	import type { Studio } from '$lib/studio/studio.svelte';
	import NumberField from './NumberField.svelte';

	// The layers, top first, as in every drawing program: show or hide, lock, rename (double-click),
	// drag by the grip to reorder (or Alt+↑/↓ on a row), and open a vector layer to see its shapes,
	// where a click selects one. Under the list: the active layer's opacity and blend mode.
	let {
		studio,
		heading = true
	}: {
		studio: Studio;
		/** Off in the small-screen sheet, which has its own. */
		heading?: boolean;
	} = $props();

	const layers = $derived([...studio.doc.layers].reverse());
	const active = $derived(studio.activeLayer);
	let open = $state<Record<string, boolean>>({});
	let renaming = $state<string | null>(null);
	let draft = $state('');
	const SHOWN = 200;

	const SHAPE_ICONS: Record<Shape['kind'], IconName> = {
		rect: 'square',
		ellipse: 'circle',
		polygon: 'hexagon',
		star: 'star',
		line: 'slash',
		path: 'pen-nib',
		group: 'group',
		text: 'type'
	};

	const BLEND_NAMES: Record<string, string> = {
		normal: 'Normal',
		multiply: 'Multiply',
		screen: 'Screen',
		overlay: 'Overlay',
		darken: 'Darken',
		lighten: 'Lighten',
		'color-dodge': 'Colour dodge',
		'color-burn': 'Colour burn',
		'hard-light': 'Hard light',
		'soft-light': 'Soft light',
		difference: 'Difference',
		exclusion: 'Exclusion',
		hue: 'Hue',
		saturation: 'Saturation',
		color: 'Colour',
		luminosity: 'Luminosity'
	};

	async function startRename(id: string, name: string) {
		renaming = id;
		draft = name;
		await tick();
		const input = document.getElementById(`rename-${id}`) as HTMLInputElement | null;
		input?.focus();
		input?.select();
	}

	function finishRename(kind: 'layer' | 'shape') {
		const id = renaming;
		renaming = null;
		if (!id) return;
		const name = draft.trim().slice(0, 80);
		if (kind === 'layer') {
			if (name) studio.changeLayer(id, { name });
		} else studio.changeShape(id, { name });
	}

	function renameKey(event: KeyboardEvent, kind: 'layer' | 'shape') {
		event.stopPropagation();
		if (event.key === 'Enter') finishRename(kind);
		if (event.key === 'Escape') renaming = null;
	}

	function pickShape(event: MouseEvent, shape: Shape) {
		if (event.shiftKey) {
			const has = studio.selection.includes(shape.id);
			studio.select(
				has ? studio.selection.filter((id) => id !== shape.id) : [...studio.selection, shape.id]
			);
		} else studio.select([shape.id]);
	}

	function rowKey(event: KeyboardEvent, layer: Layer) {
		if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
		event.preventDefault();
		event.stopPropagation();
		studio.moveLayer(layer.id, event.key === 'ArrowUp' ? 1 : -1);
		tick().then(() => document.getElementById(`layer-${layer.id}`)?.focus());
	}

	// ---- Dragging a layer by its grip ----
	let list = $state<HTMLElement>();
	let dragging = $state<{ id: string; to: number } | null>(null);

	function gripDown(event: PointerEvent, layer: Layer) {
		if (event.button !== 0) return;
		event.preventDefault();
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		dragging = { id: layer.id, to: layers.indexOf(layer) };
	}

	function gripMove(event: PointerEvent) {
		if (!dragging || !list) return;
		const rows = [...list.querySelectorAll<HTMLElement>('[data-layer-row]')];
		let to = rows.length - 1;
		for (let index = 0; index < rows.length; index++) {
			const box = rows[index].getBoundingClientRect();
			if (event.clientY < box.top + box.height / 2) {
				to = index;
				break;
			}
		}
		const from = layers.findIndex((layer) => layer.id === dragging?.id);
		// Below its own place, the gap it leaves counts.
		dragging = { ...dragging, to: to > from ? to - 1 : to };
		if (event.clientY > rows[rows.length - 1].getBoundingClientRect().bottom)
			dragging.to = rows.length - 1;
	}

	function gripUp() {
		if (!dragging) return;
		const { id, to } = dragging;
		dragging = null;
		// The list is top first; the drawing's layers are bottom first.
		studio.placeLayer(id, layers.length - 1 - to);
	}
</script>

{#snippet shapeRows(shapes: Shape[], depth: number)}
	{#each [...shapes].reverse().slice(0, SHOWN) as shape (shape.id)}
		{@const picked = studio.selection.includes(shape.id)}
		<li class="shape-row" class:picked class:muted={shape.hidden} style:--depth={depth}>
			{#if shape.kind === 'group'}
				<button
					type="button"
					class="twist"
					aria-expanded={!!open[shape.id]}
					aria-label="{open[shape.id] ? 'Close' : 'Open'} {shape.name || 'group'}"
					onclick={() => (open[shape.id] = !open[shape.id])}
				>
					<Icon name={open[shape.id] ? 'chevron-down' : 'chevron-right'} size={12} />
				</button>
			{:else}
				<span class="twist" aria-hidden="true"></span>
			{/if}
			<Icon name={SHAPE_ICONS[shape.kind]} size={13} />
			{#if renaming === shape.id}
				<input
					id="rename-{shape.id}"
					class="rename"
					bind:value={draft}
					maxlength="80"
					aria-label="Name"
					onblur={() => finishRename('shape')}
					onkeydown={(event) => renameKey(event, 'shape')}
				/>
			{:else}
				<button
					type="button"
					class="name"
					aria-pressed={picked}
					onclick={(event) => pickShape(event, shape)}
					ondblclick={() => startRename(shape.id, shapeLabel(shape))}
				>
					{shapeLabel(shape)}
				</button>
			{/if}
			<button
				type="button"
				class="mini"
				class:set={shape.locked}
				aria-pressed={shape.locked}
				aria-label={shape.locked ? 'Unlock' : 'Lock'}
				title={shape.locked ? 'Unlock' : 'Lock'}
				onclick={() => studio.changeShape(shape.id, { locked: !shape.locked })}
			>
				<Icon name={shape.locked ? 'lock' : 'unlock'} size={12} />
			</button>
			<button
				type="button"
				class="mini"
				class:set={shape.hidden}
				aria-pressed={!shape.hidden}
				aria-label={shape.hidden ? 'Show' : 'Hide'}
				title={shape.hidden ? 'Show' : 'Hide'}
				onclick={() => studio.changeShape(shape.id, { hidden: !shape.hidden })}
			>
				<Icon name={shape.hidden ? 'eye-off' : 'eye'} size={12} />
			</button>
		</li>
		{#if shape.kind === 'group' && open[shape.id]}
			{@render shapeRows(shape.children, depth + 1)}
		{/if}
	{/each}
	{#if shapes.length > SHOWN}
		<li class="more" style:--depth={depth}>and {shapes.length - SHOWN} more</li>
	{/if}
{/snippet}

<div class="layers">
	<div class="head">
		{#if heading}<h3>Layers</h3>{:else}<span></span>{/if}
		<div class="head-actions">
			<button
				type="button"
				class="icon-button"
				aria-label="New layer"
				title="New layer"
				onclick={() => studio.addLayer('vector')}
			>
				<Icon name="plus" size={16} />
			</button>
			<!-- A paint layer button joins this one with the brushes (idea 25b); the studio, the
			     renderer and the drafts already handle paint layers. -->
		</div>
	</div>

	<ol class="list" bind:this={list}>
		{#each layers as layer, index (layer.id)}
			{@const current = layer.id === studio.activeLayerId}
			<li
				class="layer"
				class:current
				class:muted={layer.hidden}
				class:drop-before={dragging && dragging.to === index && dragging.id !== layer.id}
				data-layer-row
			>
				<div class="layer-row">
					<span
						class="grip"
						aria-hidden="true"
						onpointerdown={(event) => gripDown(event, layer)}
						onpointermove={gripMove}
						onpointerup={gripUp}
						onpointercancel={() => (dragging = null)}
					>
						<Icon name="grip" size={12} />
					</span>
					{#if layer.kind === 'vector' && layer.shapes.length}
						<button
							type="button"
							class="twist"
							aria-expanded={!!open[layer.id]}
							aria-label="{open[layer.id] ? 'Close' : 'Open'} {layer.name}"
							onclick={() => (open[layer.id] = !open[layer.id])}
						>
							<Icon name={open[layer.id] ? 'chevron-down' : 'chevron-right'} size={12} />
						</button>
					{:else}
						<span class="twist" aria-hidden="true"></span>
					{/if}
					<Icon name={layer.kind === 'vector' ? 'layers' : 'brush'} size={14} />
					{#if renaming === layer.id}
						<input
							id="rename-{layer.id}"
							class="rename"
							bind:value={draft}
							maxlength="80"
							aria-label="Layer name"
							onblur={() => finishRename('layer')}
							onkeydown={(event) => renameKey(event, 'layer')}
						/>
					{:else}
						<button
							type="button"
							id="layer-{layer.id}"
							class="name"
							aria-pressed={current}
							title="Double-click to rename. Alt+↑ or ↓ moves it."
							onclick={() => (studio.activeLayerId = layer.id)}
							ondblclick={() => startRename(layer.id, layer.name)}
							onkeydown={(event) => rowKey(event, layer)}
						>
							{layer.name}
						</button>
					{/if}
					<button
						type="button"
						class="mini"
						class:set={layer.locked}
						aria-pressed={layer.locked}
						aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
						title={layer.locked ? 'Unlock' : 'Lock'}
						onclick={() => studio.changeLayer(layer.id, { locked: !layer.locked })}
					>
						<Icon name={layer.locked ? 'lock' : 'unlock'} size={13} />
					</button>
					<button
						type="button"
						class="mini"
						class:set={layer.hidden}
						aria-pressed={!layer.hidden}
						aria-label={layer.hidden ? `Show ${layer.name}` : `Hide ${layer.name}`}
						title={layer.hidden ? 'Show' : 'Hide'}
						onclick={() => studio.changeLayer(layer.id, { hidden: !layer.hidden })}
					>
						<Icon name={layer.hidden ? 'eye-off' : 'eye'} size={13} />
					</button>
				</div>
				{#if layer.kind === 'vector' && open[layer.id] && layer.shapes.length}
					<ul class="shapes">
						{@render shapeRows(layer.shapes, 1)}
					</ul>
				{/if}
			</li>
		{/each}
	</ol>

	{#if active}
		<div class="foot">
			<div class="foot-row">
				<NumberField
					label="Layer opacity"
					icon="eye"
					value={active.opacity * 100}
					min={0}
					max={100}
					places={0}
					unit="%"
					title="Layer opacity"
					onchange={(value, live) =>
						studio.changeLayer(
							active.id,
							{ opacity: value / 100 },
							live ? 'layer-opacity' : undefined
						)}
				/>
				<label class="select">
					<span class="sr-only">Blend mode</span>
					<select
						value={active.blend}
						title="How the layer mixes with those under it"
						onchange={(event) => studio.setBlend(active.id, event.currentTarget.value)}
					>
						{#each BLENDS as blend (blend)}
							<option value={blend}>{BLEND_NAMES[blend] ?? blend}</option>
						{/each}
					</select>
				</label>
			</div>
			<div class="foot-actions">
				<button
					type="button"
					class="icon-button"
					aria-label="Move layer up"
					title="Move up"
					onclick={() => studio.moveLayer(active.id, 1)}
				>
					<Icon name="arrow-up" size={15} />
				</button>
				<button
					type="button"
					class="icon-button"
					aria-label="Move layer down"
					title="Move down"
					onclick={() => studio.moveLayer(active.id, -1)}
				>
					<Icon name="arrow-down" size={15} />
				</button>
				<button
					type="button"
					class="icon-button"
					aria-label="Duplicate layer"
					title="Duplicate layer"
					onclick={() => studio.duplicateLayer(active.id)}
				>
					<Icon name="copy" size={15} />
				</button>
				<button
					type="button"
					class="icon-button"
					aria-label="Delete layer"
					title={studio.doc.layers.length > 1
						? 'Delete layer'
						: 'A drawing keeps one layer at least'}
					disabled={studio.doc.layers.length <= 1}
					onclick={() => studio.removeLayer(active.id)}
				>
					<Icon name="trash" size={15} />
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.layers {
		display: flex;
		flex-direction: column;
		min-height: 0;
		font-family: var(--font-ui);
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 10px 6px 16px;
	}

	h3 {
		margin: 0;
		color: var(--bb-text-label);
		font-size: 12.5px;
		font-weight: 700;
	}

	.head-actions,
	.foot-actions {
		display: flex;
		gap: 2px;
	}

	.icon-button {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		padding: 0;
		border: none;
		border-radius: 7px;
		background: none;
		color: var(--bb-text-label);
	}

	.icon-button:hover:not(:disabled) {
		background: var(--bb-hover);
		color: var(--bb-text-strong);
	}

	.icon-button:disabled {
		opacity: 0.4;
	}

	.list,
	.shapes {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.list {
		flex: 1;
		min-height: 0;
		overflow: auto;
		padding: 0 8px 8px;
	}

	.layer {
		border-radius: 9px;
		position: relative;
	}

	.layer.drop-before::before {
		content: '';
		position: absolute;
		top: -1px;
		left: 6px;
		right: 6px;
		height: 2px;
		border-radius: 2px;
		background: var(--studio-accent);
	}

	.layer-row,
	.shape-row {
		display: flex;
		align-items: center;
		gap: 4px;
		min-height: 34px;
		padding: 0 4px;
		border-radius: 8px;
		color: var(--bb-text-2);
	}

	.layer-row:hover,
	.shape-row:hover {
		background: var(--bb-hover);
	}

	.current > .layer-row {
		background: color-mix(in srgb, var(--studio-accent) 16%, transparent);
		color: var(--bb-text-strong);
	}

	.shape-row {
		min-height: 28px;
		padding-left: calc(var(--depth) * 14px + 4px);
		font-size: 12.5px;
	}

	.shape-row.picked {
		background: color-mix(in srgb, var(--studio-accent) 10%, transparent);
		color: var(--bb-text-strong);
	}

	.muted {
		opacity: 0.55;
	}

	.grip {
		display: grid;
		place-items: center;
		width: 14px;
		height: 24px;
		color: var(--bb-text-4);
		cursor: grab;
		touch-action: none;
	}

	.grip:active {
		cursor: grabbing;
	}

	.twist {
		display: grid;
		flex: none;
		place-items: center;
		width: 18px;
		height: 22px;
		padding: 0;
		border: none;
		background: none;
		color: var(--bb-text-3);
	}

	.name {
		flex: 1;
		min-width: 0;
		height: 30px;
		padding: 0 4px;
		overflow: hidden;
		border: none;
		background: none;
		color: inherit;
		font: 500 13px var(--font-ui);
		text-align: left;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.shape-row .name {
		height: 26px;
		font-size: 12.5px;
	}

	.rename {
		flex: 1;
		min-width: 0;
		height: 26px;
		padding: 0 6px;
		border: 1px solid var(--studio-accent);
		border-radius: 6px;
		background: var(--bb-night);
		color: var(--bb-text);
		font: 500 13px var(--font-ui);
		outline: none;
	}

	.mini {
		display: grid;
		flex: none;
		place-items: center;
		width: 24px;
		height: 24px;
		padding: 0;
		border: none;
		border-radius: 6px;
		background: none;
		color: var(--bb-text-3);
		opacity: 0;
	}

	.layer-row:hover .mini,
	.shape-row:hover .mini,
	.mini:focus-visible,
	.mini.set {
		opacity: 1;
	}

	.mini:hover {
		color: var(--bb-text-strong);
	}

	.more {
		padding: 4px 0 4px calc(var(--depth) * 14px + 26px);
		color: var(--bb-text-3);
		font-size: 12px;
	}

	.foot {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 12px 12px 16px;
		border-top: 1px solid var(--bb-line-faint);
	}

	.foot-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.foot-actions {
		justify-content: flex-end;
	}

	.select select {
		width: 100%;
		height: 32px;
		padding: 0 8px;
		border: 1px solid transparent;
		border-radius: 8px;
		background: var(--studio-field);
		color: var(--bb-text);
		font: 500 12.5px var(--font-ui);
	}

	@media (hover: none) {
		.mini {
			opacity: 1;
		}
	}
</style>
