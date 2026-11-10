<script lang="ts">
	import Icon, { type IconName } from '$lib/components/ui/Icon.svelte';
	import { calculate, formatNumber } from '$lib/studio/numbers';

	// A number field for the studio's panels. Type a number or a sum and press Enter (Esc puts it
	// back); the arrow keys step it (Shift for ten steps); drag its label sideways to scrub it.
	// A change made while scrubbing or stepping says so (`live`), so the caller can keep one undo
	// step for the whole gesture.
	let {
		label,
		icon,
		value,
		onchange,
		min = -Infinity,
		max = Infinity,
		step = 1,
		places = 2,
		unit = '',
		mixed = false,
		disabled = false,
		title
	}: {
		/** A short label in the field ("X", "W"), or a word for screen readers when there's an icon. */
		label: string;
		icon?: IconName;
		value: number;
		onchange: (value: number, live: boolean) => void;
		min?: number;
		max?: number;
		step?: number;
		places?: number;
		/** Shown after the number ("%", "°"). */
		unit?: string;
		/** Several shapes with different values. */
		mixed?: boolean;
		disabled?: boolean;
		title?: string;
	} = $props();

	let typed = $state<string | null>(null);
	const shown = $derived(mixed ? '' : `${formatNumber(value, places)}${unit}`);
	const clamp = (next: number) => Math.max(min, Math.min(max, next));

	function commit() {
		if (typed === null) return;
		const next = calculate(typed, value);
		typed = null;
		if (next !== null) onchange(clamp(next), false);
	}

	function key(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			commit();
			(event.currentTarget as HTMLInputElement).select();
		} else if (event.key === 'Escape') {
			typed = null;
			(event.currentTarget as HTMLInputElement).blur();
			event.stopPropagation();
		} else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
			event.preventDefault();
			const by = (event.shiftKey ? 10 : 1) * step * (event.key === 'ArrowUp' ? 1 : -1);
			typed = null;
			onchange(clamp(value + by), true);
		}
	}

	// ---- Scrubbing ----
	let scrub: { x: number; value: number; moved: boolean } | null = null;
	function scrubDown(event: PointerEvent) {
		if (disabled || event.button !== 0) return;
		event.preventDefault();
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		scrub = { x: event.clientX, value, moved: false };
	}
	function scrubMove(event: PointerEvent) {
		if (!scrub) return;
		const dx = event.clientX - scrub.x;
		if (!scrub.moved && Math.abs(dx) < 3) return;
		scrub.moved = true;
		const rate = event.shiftKey ? 10 : event.altKey ? 0.1 : 1;
		const next = scrub.value + Math.round(dx / 2) * step * rate;
		onchange(clamp(Number(formatNumber(next, places))), true);
	}
	function scrubUp() {
		scrub = null;
	}
</script>

<label class="field" class:disabled {title}>
	<span
		class="handle"
		class:has-icon={!!icon}
		onpointerdown={scrubDown}
		onpointermove={scrubMove}
		onpointerup={scrubUp}
		onpointercancel={scrubUp}
		aria-hidden="true"
	>
		{#if icon}<Icon name={icon} size={14} />{:else}{label}{/if}
	</span>
	{#if icon}<span class="sr-only">{label}</span>{/if}
	<input
		type="text"
		inputmode="decimal"
		autocomplete="off"
		spellcheck="false"
		{disabled}
		value={typed ?? shown}
		placeholder={mixed ? 'Mixed' : ''}
		aria-label={icon ? undefined : label}
		onfocus={(event) => event.currentTarget.select()}
		oninput={(event) => (typed = event.currentTarget.value)}
		onblur={commit}
		onkeydown={key}
	/>
</label>

<style>
	.field {
		display: flex;
		align-items: center;
		min-width: 0;
		height: 32px;
		border: 1px solid transparent;
		border-radius: 8px;
		background: var(--studio-field);
		color: var(--bb-text);
		font: 500 12.5px var(--font-ui);
	}

	.field:hover {
		border-color: var(--bb-line-soft);
	}

	.field:focus-within {
		border-color: var(--studio-accent);
		background: var(--bb-night);
	}

	.field.disabled {
		opacity: 0.5;
	}

	.handle {
		display: grid;
		flex: none;
		place-items: center;
		width: 26px;
		height: 100%;
		color: var(--bb-text-3);
		font-size: 11px;
		font-weight: 700;
		cursor: ew-resize;
		touch-action: none;
	}

	input {
		flex: 1;
		width: 100%;
		min-width: 0;
		height: 100%;
		padding: 0 8px 0 0;
		border: none;
		background: none;
		color: inherit;
		font: inherit;
		font-variant-numeric: tabular-nums;
		outline: none;
	}

	input::placeholder {
		color: var(--bb-text-3);
	}
</style>
