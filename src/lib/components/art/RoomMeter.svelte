<script lang="ts">
	import { formatBytes, ROOM_BYTES } from '$lib/art';

	// How much of the writer's room on the art shelf is used: a bar and the words for it.
	let { used, compact = false }: { used: number; compact?: boolean } = $props();

	const share = $derived(Math.min(1, used / ROOM_BYTES));
</script>

<div class={['room', { compact, full: share >= 0.9 }]}>
	<div
		class="bar"
		role="meter"
		aria-label="Room on your shelf"
		aria-valuemin={0}
		aria-valuemax={ROOM_BYTES}
		aria-valuenow={Math.min(used, ROOM_BYTES)}
		aria-valuetext="{formatBytes(used)} of {formatBytes(ROOM_BYTES)} used"
	>
		<span style:width="{share * 100}%"></span>
	</div>
	<p>
		<strong>{formatBytes(used)}</strong> of {formatBytes(ROOM_BYTES)} used
	</p>
</div>

<style>
	.room {
		display: grid;
		gap: 8px;
		min-width: 200px;
		font-family: var(--font-ui);
	}

	.bar {
		height: 8px;
		overflow: hidden;
		border-radius: var(--r-pill);
		background: var(--bb-line-soft);
	}

	.bar span {
		display: block;
		height: 100%;
		min-width: 4px;
		border-radius: inherit;
		background: var(--bb-sky);
		transition: width 0.3s ease;
	}

	.full .bar span {
		background: var(--bb-amber);
	}

	p {
		margin: 0;
		color: var(--bb-text-3);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}

	strong {
		color: var(--bb-text);
		font-weight: 600;
	}

	.compact {
		gap: 6px;
	}

	.compact .bar {
		height: 6px;
	}

	.compact p {
		font-size: 12.5px;
	}
</style>
