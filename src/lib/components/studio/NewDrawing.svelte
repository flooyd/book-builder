<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import {
		MAX_PIXELS,
		MAX_SIDE,
		MIN_SIDE,
		PRESETS,
		newDrawing,
		newLayer,
		type VectorLayer
	} from '$lib/drawing';
	import { createDraft } from '$lib/studio/draft';
	import { surprise } from '$lib/studio/surprise';

	// Starting a drawing: what it's for (which sets its size), or a size of its own, the ground it's
	// drawn on, and whether it starts with a random picture to draw over. It's made in this browser
	// and opened straight away.
	let { owner, onclose }: { owner: string; onclose: () => void } = $props();

	const GROUNDS = [
		{ key: 'paper', label: 'Paper', color: '#f5f0e6ff' },
		{ key: 'white', label: 'White', color: '#ffffffff' },
		{ key: 'night', label: 'Night', color: '#0d1330ff' },
		{ key: 'clear', label: 'Clear', color: null }
	] as const;

	let preset = $state<string>(PRESETS[0].key);
	let width = $state<number>(PRESETS[0].width);
	let height = $state<number>(PRESETS[0].height);
	let ground = $state<string>('paper');
	let name = $state('');
	let withArt = $state(false);
	let busy = $state(false);
	let error = $state('');

	function pick(key: string) {
		preset = key;
		const found = PRESETS.find((item) => item.key === key);
		if (found) {
			width = found.width;
			height = found.height;
		}
	}

	const valid = $derived(
		Number.isFinite(width) &&
			Number.isFinite(height) &&
			width >= MIN_SIDE &&
			height >= MIN_SIDE &&
			width <= MAX_SIDE &&
			height <= MAX_SIDE &&
			width * height <= MAX_PIXELS
	);

	async function start(event: SubmitEvent) {
		event.preventDefault();
		if (!valid || busy) return;
		busy = true;
		error = '';
		try {
			const background = GROUNDS.find((item) => item.key === ground)?.color ?? null;
			let doc = newDrawing(width, height, background);
			if (withArt) {
				// The picture on a layer of its own at the bottom, and the empty layer above it to draw on.
				const art = surprise(doc.width, doc.height);
				const layer: VectorLayer = {
					...(newLayer('vector', art.label) as VectorLayer),
					shapes: art.shapes
				};
				doc = { ...doc, layers: [layer, ...doc.layers] };
			}
			const fallback = PRESETS.find((item) => item.key === preset)?.label ?? 'Drawing';
			const key = await createDraft(owner, name.trim() || fallback, doc);
			await goto(resolve('/studio/draft/[key]', { key }));
		} catch {
			error =
				'This browser wouldn’t make room for a drawing. Its storage may be full or switched off.';
			busy = false;
		}
	}
</script>

<Dialog labelledby="new-drawing-title" {onclose} width={620}>
	<form class="new" onsubmit={start}>
		<h2 id="new-drawing-title">New drawing</h2>

		<fieldset>
			<legend>What it’s for</legend>
			<div class="presets">
				{#each PRESETS as item (item.key)}
					{@const fit = Math.min(64 / item.width, 46 / item.height)}
					<label class="preset" class:on={preset === item.key}>
						<input
							type="radio"
							name="preset"
							value={item.key}
							checked={preset === item.key}
							onchange={() => pick(item.key)}
						/>
						<span
							class="shape"
							style:width="{item.width * fit}px"
							style:height="{item.height * fit}px"
							aria-hidden="true"
						></span>
						<span class="preset-name">{item.label}</span>
						<span class="preset-hint">{item.width} × {item.height}</span>
					</label>
				{/each}
				<label class="preset" class:on={preset === 'custom'}>
					<input
						type="radio"
						name="preset"
						value="custom"
						checked={preset === 'custom'}
						onchange={() => (preset = 'custom')}
					/>
					<span class="shape custom" aria-hidden="true"></span>
					<span class="preset-name">Your own size</span>
					<span class="preset-hint">Up to {MAX_SIDE} a side</span>
				</label>
			</div>
		</fieldset>

		<div class="size">
			<label>
				<span>Width</span>
				<input
					class="bb-field"
					type="number"
					min={MIN_SIDE}
					max={MAX_SIDE}
					bind:value={width}
					oninput={() => (preset = 'custom')}
				/>
			</label>
			<span class="times" aria-hidden="true">×</span>
			<label>
				<span>Height</span>
				<input
					class="bb-field"
					type="number"
					min={MIN_SIDE}
					max={MAX_SIDE}
					bind:value={height}
					oninput={() => (preset = 'custom')}
				/>
			</label>
			<span class="unit">pixels</span>
		</div>
		{#if !valid}
			<p class="warning">
				A side can be {MIN_SIDE} to {MAX_SIDE} pixels{width * height > MAX_PIXELS
					? ', and not both at the most'
					: ''}.
			</p>
		{/if}

		<fieldset>
			<legend>Ground</legend>
			<div class="grounds">
				{#each GROUNDS as item (item.key)}
					<label class="ground" class:on={ground === item.key}>
						<input type="radio" name="ground" value={item.key} bind:group={ground} />
						<span
							class="chip"
							class:clear={!item.color}
							style:--chip={item.color ?? 'transparent'}
							aria-hidden="true"
						></span>
						{item.label}
					</label>
				{/each}
			</div>
		</fieldset>

		<label class="art" class:on={withArt}>
			<input type="checkbox" bind:checked={withArt} />
			<span class="art-icon" aria-hidden="true"><Icon name="dice" size={20} /></span>
			<span class="art-text">
				<span class="art-name">Start with a surprise</span>
				<span class="art-hint">A random picture on a layer of its own, to draw over or change</span>
			</span>
			<span class="art-tick" aria-hidden="true"><Icon name="check" size={14} /></span>
		</label>

		<label class="name">
			<span>Name <span class="optional">(you can change it later)</span></span>
			<input
				class="bb-field"
				type="text"
				maxlength="80"
				bind:value={name}
				placeholder={PRESETS.find((item) => item.key === preset)?.label ?? 'Drawing'}
			/>
		</label>

		{#if error}<p class="warning" role="alert">{error}</p>{/if}

		<div class="actions">
			<Button variant="quiet" onclick={onclose}>Cancel</Button>
			<Button variant="primary" type="submit" disabled={!valid || busy}
				>{busy ? 'Opening…' : 'Start drawing'}</Button
			>
		</div>
	</form>
</Dialog>

<style>
	.new {
		display: flex;
		flex-direction: column;
		gap: 18px;
		padding: 26px 28px 24px;
		font-family: var(--font-ui);
	}

	h2 {
		margin: 0;
		color: var(--bb-text-strong);
		font: 400 26px var(--font-display);
	}

	fieldset {
		margin: 0;
		padding: 0;
		border: none;
	}

	legend,
	.size span,
	.name > span {
		margin-bottom: 8px;
		color: var(--bb-text-label);
		font-size: 13px;
		font-weight: 600;
	}

	.presets {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}

	.preset {
		position: relative;
		display: grid;
		grid-template-rows: 54px auto auto;
		justify-items: center;
		gap: 2px;
		padding: 12px 8px 10px;
		border: 1px solid var(--bb-line-soft);
		border-radius: 14px;
		cursor: pointer;
		text-align: center;
	}

	.preset:hover {
		border-color: var(--bb-line-control);
		background: var(--bb-hover);
	}

	.preset.on {
		border-color: var(--bb-sky);
		background: color-mix(in srgb, var(--bb-sky) 8%, transparent);
	}

	.preset:has(input:focus-visible),
	.ground:has(input:focus-visible) {
		box-shadow: var(--focus-ring);
	}

	.preset input,
	.ground input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.shape {
		align-self: center;
		box-sizing: border-box;
		border: 1.5px solid var(--bb-text-3);
		border-radius: 3px;
		background: var(--bb-paper);
	}

	.shape.custom {
		width: 40px;
		height: 40px;
		border-style: dashed;
		background: none;
	}

	.preset-name {
		color: var(--bb-text);
		font-size: 13.5px;
		font-weight: 600;
	}

	.preset-hint {
		color: var(--bb-text-3);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
	}

	.size {
		display: flex;
		align-items: flex-end;
		gap: 10px;
	}

	.size label {
		display: flex;
		flex-direction: column;
		width: 120px;
	}

	.times,
	.unit {
		padding-bottom: 12px;
		color: var(--bb-text-3);
		font-size: 13px;
	}

	.grounds {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.ground {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 40px;
		padding: 0 14px 0 8px;
		border: 1px solid var(--bb-line-soft);
		border-radius: 999px;
		color: var(--bb-text-2);
		font-size: 13.5px;
		cursor: pointer;
	}

	.ground.on {
		border-color: var(--bb-sky);
		color: var(--bb-text-strong);
	}

	.chip {
		width: 22px;
		height: 22px;
		border: 1px solid var(--bb-line-control);
		border-radius: 50%;
		background: var(--chip);
	}

	.chip.clear {
		background: repeating-conic-gradient(#d9d9d9 0 25%, #fff 0 50%) 0 0 / 8px 8px;
	}

	.art {
		position: relative;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 14px 10px 10px;
		border: 1px solid var(--bb-line-soft);
		border-radius: 14px;
		cursor: pointer;
	}

	.art:hover {
		border-color: var(--bb-line-control);
		background: var(--bb-hover);
	}

	.art.on {
		border-color: var(--bb-sky);
		background: color-mix(in srgb, var(--bb-sky) 8%, transparent);
	}

	.art:has(input:focus-visible) {
		box-shadow: var(--focus-ring);
	}

	.art input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.art-icon {
		display: grid;
		flex: none;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 10px;
		background: color-mix(in srgb, var(--bb-sky) 14%, transparent);
		color: var(--bb-sky);
	}

	.art-text {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.art-name {
		color: var(--bb-text);
		font-size: 13.5px;
		font-weight: 600;
	}

	.art-hint {
		color: var(--bb-text-3);
		font-size: 12.5px;
	}

	.art-tick {
		display: grid;
		flex: none;
		place-items: center;
		width: 22px;
		height: 22px;
		border: 1.5px solid var(--bb-line-control);
		border-radius: 6px;
		color: transparent;
	}

	.art.on .art-tick {
		border-color: var(--bb-sky);
		background: var(--bb-sky);
		color: var(--bb-night);
	}

	.name {
		display: flex;
		flex-direction: column;
	}

	.optional {
		color: var(--bb-text-3);
		font-weight: 400;
	}

	.warning {
		margin: -8px 0 0;
		color: var(--bb-coral);
		font-size: 13px;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		margin-top: 4px;
	}

	@media (max-width: 600px) {
		.new {
			padding: 22px 18px 18px;
		}

		.presets {
			grid-template-columns: repeat(2, 1fr);
		}

		.size label {
			width: 100px;
		}
	}
</style>
