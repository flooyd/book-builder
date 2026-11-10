<script lang="ts">
	import ColorPicker from './ColorPicker.svelte';
	import { shortHex } from '$lib/studio/color';

	// A colour swatch that opens the colour picker beside it, in the top layer. `stroke` draws the
	// swatch as a ring, the way a stroke well usually looks. The colour is reported as it changes;
	// `onclose` gets the colour it ended on, for the recent colours.
	let {
		value,
		onchange,
		onclose,
		label,
		recent = [],
		none = true,
		stroke = false,
		side = 'right',
		size = 28
	}: {
		value: string | null;
		onchange: (value: string | null) => void;
		onclose?: (value: string | null) => void;
		label: string;
		recent?: string[];
		none?: boolean;
		stroke?: boolean;
		/** Where the picker opens. */
		side?: 'right' | 'left' | 'below' | 'above';
		size?: number;
	} = $props();

	const id = `well-${Math.random().toString(36).slice(2, 9)}`;
	let panel = $state<HTMLElement>();
	let trigger = $state<HTMLButtonElement>();
	const WIDTH = 252;

	function place(event: ToggleEvent) {
		if (!panel || !trigger) return;
		if (event.newState !== 'open') {
			onclose?.(value);
			return;
		}
		const box = trigger.getBoundingClientRect();
		const height = Math.min(panel.scrollHeight || 430, innerHeight - 16);
		let left = box.left;
		let top = box.bottom + 8;
		if (side === 'right') [left, top] = [box.right + 10, box.top - 12];
		if (side === 'left') [left, top] = [box.left - WIDTH - 10, box.top - 12];
		if (side === 'above') top = box.top - height - 8;
		// Narrow screens: just keep it on screen.
		left = Math.max(8, Math.min(left, innerWidth - WIDTH - 8));
		top = Math.max(8, Math.min(top, innerHeight - height - 8));
		panel.style.left = `${left}px`;
		panel.style.top = `${top}px`;
	}
</script>

<button
	bind:this={trigger}
	type="button"
	class="well"
	class:stroke
	class:empty={!value}
	style:--color={value ?? 'transparent'}
	style:--size="{size}px"
	popovertarget={id}
	aria-label="{label}: {value ? shortHex(value) : 'none'}"
	title={label}
></button>

<div
	bind:this={panel}
	{id}
	class="panel"
	popover="auto"
	role="dialog"
	aria-label={label}
	onbeforetoggle={place}
>
	<ColorPicker {value} {onchange} {recent} {none} />
</div>

<style>
	.well {
		position: relative;
		flex: none;
		width: var(--size);
		height: var(--size);
		padding: 0;
		border: 1px solid var(--bb-line-control);
		border-radius: 8px;
		background:
			linear-gradient(var(--color), var(--color)),
			repeating-conic-gradient(#d9d9d9 0 25%, #fff 0 50%) 0 0 / 8px 8px;
		cursor: pointer;
	}

	.well:hover {
		box-shadow: 0 0 0 3px var(--bb-line-faint);
	}

	/* A ring: the colour as a thick edge round a hole. */
	.well.stroke {
		background: var(--bb-panel);
		box-shadow: inset 0 0 0 calc(var(--size) / 4.5) var(--color);
	}

	.well.stroke::after {
		content: '';
		position: absolute;
		inset: calc(var(--size) / 4.5 - 1px);
		border: 1px solid var(--bb-line-control);
		border-radius: 3px;
	}

	.well.stroke:hover {
		box-shadow:
			inset 0 0 0 calc(var(--size) / 4.5) var(--color),
			0 0 0 3px var(--bb-line-faint);
	}

	.well.empty {
		background:
			linear-gradient(to top right, transparent 46%, var(--bb-coral) 46% 54%, transparent 54%),
			var(--bb-ink);
		box-shadow: none;
	}

	.well.stroke.empty::after {
		display: none;
	}

	.panel {
		position: fixed;
		inset: auto;
		width: 252px;
		max-height: calc(100dvh - 16px);
		margin: 0;
		padding: 14px;
		overflow: auto;
		border: 1px solid var(--bb-line-control);
		border-radius: 14px;
		background: var(--bb-ink);
		color: var(--bb-text);
		box-shadow: 0 24px 48px -20px var(--bb-drop);
	}
</style>
