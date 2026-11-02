<script lang="ts">
	// The one tooltip a chart shows, centred on a mark but kept inside the chart so it can't push
	// the page sideways on a phone. Everything in it can also be read without it, in the chart's
	// table or the words beside it, so it's hidden from screen readers.
	let {
		x,
		top,
		bounds,
		value,
		label
	}: {
		/** The middle of the mark, from the chart's left edge. */
		x: number;
		/** The top of the mark, from the chart's top edge. */
		top: number;
		/** The chart's width. */
		bounds: number;
		value: string;
		label: string;
	} = $props();

	let width = $state(0);
	const left = $derived(Math.max(0, Math.min(x - width / 2, bounds - width)));
</script>

<div
	class="tip"
	style:left="{left}px"
	style:top="{top}px"
	bind:clientWidth={width}
	aria-hidden="true"
>
	<strong>{value}</strong>
	<span>{label}</span>
</div>

<style>
	.tip {
		position: absolute;
		z-index: 5;
		transform: translateY(calc(-100% - 8px));
		display: flex;
		flex-direction: column;
		gap: 2px;
		width: max-content;
		max-width: min(260px, 100%);
		padding: 8px 12px;
		border-radius: var(--r-chip);
		background: var(--bb-raised);
		border: 1px solid var(--bb-line);
		box-shadow: var(--shadow-card);
		pointer-events: none;
	}

	strong {
		font-size: 15px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--bb-text-strong);
	}

	span {
		font-size: 13px;
		line-height: 1.35;
		color: var(--bb-text-2);
		overflow-wrap: anywhere;
	}
</style>
