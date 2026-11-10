<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import {
		PALETTE,
		hexToHsv,
		hsvToHex,
		opaque,
		readHex,
		shortHex,
		type Hsva
	} from '$lib/studio/color';

	// A colour picker for drawing: a square for saturation (across) and brightness (up), sliders for
	// hue and transparency, the colour as hex, the browser's eyedropper where it has one, and recent
	// and palette swatches. Each change is reported as it happens, so the drawing follows the drag.
	let {
		value,
		onchange,
		recent = [],
		none = false
	}: {
		/** #rrggbbaa, or null for no colour. */
		value: string | null;
		onchange: (value: string | null) => void;
		recent?: string[];
		/** Offer "None" (no fill, no stroke). */
		none?: boolean;
	} = $props();

	// The picker keeps its own hue and saturation: grey has neither, and the square shouldn't jump
	// back to red when the brightness touches black.
	let hsv = $state<Hsva>({ h: 210, s: 0.7, v: 0.6, a: 1 });
	let shown = '';
	$effect.pre(() => {
		if (!value || value === shown) return;
		const next = hexToHsv(value);
		hsv = {
			h: next.s > 0 && next.v > 0 ? next.h : hsv.h,
			s: next.v > 0 ? next.s : hsv.s,
			v: next.v,
			a: next.a
		};
		shown = value;
	});

	const hex = $derived(hsvToHex(hsv));
	let typed = $state<string | null>(null);

	function set(next: Partial<Hsva>) {
		hsv = { ...hsv, ...next };
		shown = hsvToHex(hsv);
		onchange(shown);
	}

	// ---- The square ----
	let square = $state<HTMLElement>();
	function pickAt(event: PointerEvent) {
		if (!square) return;
		const box = square.getBoundingClientRect();
		const s = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
		const v = Math.max(0, Math.min(1, 1 - (event.clientY - box.top) / box.height));
		set({ s, v });
	}
	function squareDown(event: PointerEvent) {
		square?.setPointerCapture(event.pointerId);
		pickAt(event);
	}
	function squareMove(event: PointerEvent) {
		if (square?.hasPointerCapture(event.pointerId)) pickAt(event);
	}
	function squareKey(event: KeyboardEvent) {
		const step = event.shiftKey ? 0.1 : 0.01;
		const moves: Record<string, Partial<Hsva>> = {
			ArrowLeft: { s: Math.max(0, hsv.s - step) },
			ArrowRight: { s: Math.min(1, hsv.s + step) },
			ArrowUp: { v: Math.min(1, hsv.v + step) },
			ArrowDown: { v: Math.max(0, hsv.v - step) }
		};
		const move = moves[event.key];
		if (!move) return;
		event.preventDefault();
		set(move);
	}

	function commitTyped() {
		if (typed === null) return;
		const next = readHex(typed, hsv.a);
		typed = null;
		if (next) {
			shown = '';
			onchange(next);
		}
	}

	const canDrop = typeof window !== 'undefined' && 'EyeDropper' in window;
	async function eyedrop() {
		type Picker = { open: () => Promise<{ sRGBHex: string }> };
		const Dropper = (window as unknown as { EyeDropper: new () => Picker }).EyeDropper;
		try {
			const picked = await new Dropper().open();
			const next = readHex(picked.sRGBHex, hsv.a);
			if (next) onchange(next);
		} catch {
			// Esc closes the eyedropper without a colour.
		}
	}
</script>

<div class="picker">
	<div
		bind:this={square}
		class="square"
		role="slider"
		tabindex="0"
		aria-label="Saturation and brightness"
		aria-valuetext="Saturation {Math.round(hsv.s * 100)}%, brightness {Math.round(hsv.v * 100)}%"
		aria-valuenow={Math.round(hsv.v * 100)}
		style:--hue="hsl({hsv.h} 100% 50%)"
		onpointerdown={squareDown}
		onpointermove={squareMove}
		onkeydown={squareKey}
	>
		<span
			class="thumb"
			style:left="{hsv.s * 100}%"
			style:top="{(1 - hsv.v) * 100}%"
			style:background={opaque(hex)}
		></span>
	</div>

	<label class="slider hue">
		<span class="sr-only">Hue</span>
		<input
			type="range"
			min="0"
			max="359"
			step="1"
			value={Math.round(hsv.h)}
			oninput={(event) => set({ h: Number(event.currentTarget.value) })}
		/>
	</label>
	<label class="slider alpha" style:--solid={opaque(hex)}>
		<span class="sr-only">Opacity</span>
		<input
			type="range"
			min="0"
			max="100"
			step="1"
			value={Math.round(hsv.a * 100)}
			oninput={(event) => set({ a: Number(event.currentTarget.value) / 100 })}
		/>
	</label>

	<div class="row">
		<span
			class="swatch now"
			style:--color={value ?? 'transparent'}
			class:none={!value}
			aria-hidden="true"
		></span>
		<label class="hex">
			<span class="sr-only">Colour as hex</span>
			<span aria-hidden="true">#</span>
			<input
				type="text"
				spellcheck="false"
				autocomplete="off"
				maxlength="9"
				value={typed ?? (value ? shortHex(value).slice(1) : '')}
				placeholder={value ? '' : 'None'}
				oninput={(event) => (typed = event.currentTarget.value)}
				onblur={commitTyped}
				onkeydown={(event) => {
					if (event.key === 'Enter') commitTyped();
				}}
			/>
		</label>
		<span class="percent" aria-label="Opacity">{Math.round(hsv.a * 100)}%</span>
		{#if canDrop}
			<button
				type="button"
				class="icon"
				aria-label="Pick a colour from the screen"
				title="Pick from the screen"
				onclick={eyedrop}
			>
				<Icon name="pipette" size={16} />
			</button>
		{/if}
	</div>

	{#if none}
		<button type="button" class="none-button" aria-pressed={!value} onclick={() => onchange(null)}>
			<Icon name="no-fill" size={16} /> None
		</button>
	{/if}

	{#if recent.length}
		<p class="label">Recent</p>
		<div class="swatches">
			{#each recent as color (color)}
				<button
					type="button"
					class="swatch"
					style:--color={color}
					aria-label="Use {shortHex(color)}"
					title={shortHex(color)}
					onclick={() => onchange(color)}
				></button>
			{/each}
		</div>
	{/if}
	<p class="label">Palette</p>
	<div class="swatches">
		{#each PALETTE as color (color)}
			<button
				type="button"
				class="swatch"
				style:--color={color}
				aria-label="Use {shortHex(color)}"
				title={shortHex(color)}
				onclick={() => onchange(color)}
			></button>
		{/each}
	</div>
</div>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: 10px;
		font-family: var(--font-ui);
	}

	.square {
		position: relative;
		height: 150px;
		border-radius: 10px;
		background:
			linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, var(--hue));
		touch-action: none;
		cursor: crosshair;
	}

	.thumb {
		position: absolute;
		width: 16px;
		height: 16px;
		margin: -8px 0 0 -8px;
		border: 2px solid #fff;
		border-radius: 50%;
		box-shadow:
			0 0 0 1px rgba(0, 0, 0, 0.35),
			0 2px 6px rgba(0, 0, 0, 0.3);
		pointer-events: none;
	}

	.slider {
		position: relative;
		display: block;
		height: 14px;
		border-radius: 999px;
	}

	.hue {
		background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
	}

	.alpha {
		background:
			linear-gradient(to right, transparent, var(--solid)),
			repeating-conic-gradient(#d9d9d9 0 25%, #fff 0 50%) 0 0 / 10px 10px;
	}

	.slider input {
		position: absolute;
		inset: -6px 0;
		width: 100%;
		height: 26px;
		margin: 0;
		background: transparent;
		appearance: none;
		cursor: pointer;
	}

	.slider input::-webkit-slider-thumb {
		appearance: none;
		width: 18px;
		height: 18px;
		border: 2px solid #fff;
		border-radius: 50%;
		background: transparent;
		box-shadow:
			0 0 0 1px rgba(0, 0, 0, 0.35),
			0 2px 6px rgba(0, 0, 0, 0.3);
	}

	.slider input::-moz-range-thumb {
		width: 14px;
		height: 14px;
		border: 2px solid #fff;
		border-radius: 50%;
		background: transparent;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
	}

	.row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.hex {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 2px;
		min-width: 0;
		height: 36px;
		padding: 0 10px;
		border: 1px solid var(--bb-line-control);
		border-radius: 9px;
		background: var(--bb-night);
		color: var(--bb-text-3);
		font: 600 13px var(--font-ui);
	}

	.hex:focus-within {
		border-color: var(--bb-sky);
		box-shadow: var(--focus-ring);
	}

	.hex input {
		flex: 1;
		min-width: 0;
		border: none;
		background: none;
		color: var(--bb-text);
		font: 600 13px var(--font-ui);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		outline: none;
	}

	.percent {
		min-width: 38px;
		color: var(--bb-text-3);
		font-size: 12.5px;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.icon {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border: 1px solid var(--bb-line-control);
		border-radius: 9px;
		background: none;
		color: var(--bb-text-label);
	}

	.icon:hover {
		background: var(--bb-hover);
	}

	.none-button {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		align-self: flex-start;
		min-height: 32px;
		padding: 0 12px;
		border: 1px solid var(--bb-line-control);
		border-radius: 8px;
		background: none;
		color: var(--bb-text-label);
		font: 600 13px var(--font-ui);
	}

	.none-button[aria-pressed='true'] {
		border-color: var(--bb-sky);
		color: var(--bb-sky);
	}

	.label {
		margin: 2px 0 -4px;
		color: var(--bb-text-3);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.swatches {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		gap: 6px;
	}

	.swatch {
		position: relative;
		aspect-ratio: 1;
		border: 1px solid rgba(0, 0, 0, 0.18);
		border-radius: 6px;
		background:
			linear-gradient(var(--color), var(--color)),
			repeating-conic-gradient(#d9d9d9 0 25%, #fff 0 50%) 0 0 / 8px 8px;
		padding: 0;
	}

	button.swatch:hover {
		transform: scale(1.12);
		box-shadow: 0 2px 8px -2px var(--bb-drop);
	}

	.now {
		width: 36px;
		height: 36px;
		aspect-ratio: auto;
		border-radius: 9px;
	}

	.now.none {
		background:
			linear-gradient(to top right, transparent 47%, var(--bb-coral) 47% 53%, transparent 53%),
			var(--bb-ink);
	}
</style>
