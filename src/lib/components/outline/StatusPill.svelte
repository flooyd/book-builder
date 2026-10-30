<script lang="ts">
	import { STATUSES } from '$lib/status';

	// A status as a coloured dot and label; a native select underneath does the choosing.
	let {
		value,
		label,
		onchange
	}: { value: string; label: string; onchange: (status: string) => void } = $props();
</script>

<span class="status-pill" style:--dot="var(--status-{value})">
	<span class="dot" aria-hidden="true"></span>
	<select
		aria-label={label}
		{value}
		onchange={(event) => onchange(event.currentTarget.value)}
		onclick={(event) => event.stopPropagation()}
	>
		{#each STATUSES as status (status.id)}
			<option value={status.id}>{status.label}</option>
		{/each}
	</select>
</span>

<style>
	.status-pill {
		position: relative;
		flex: none;
		display: inline-flex;
		align-items: center;
		border-radius: var(--r-pill);
		background: var(--bb-ink-2);
		border: 1px solid var(--bb-line-soft);
	}

	.status-pill:hover {
		border-color: var(--bb-line-control);
	}

	.status-pill:focus-within {
		border-color: var(--bb-sky);
		box-shadow: var(--focus-ring);
	}

	.dot {
		position: absolute;
		left: 10px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--dot);
		pointer-events: none;
	}

	select {
		appearance: none;
		min-height: 30px;
		padding: 0 12px 0 24px;
		border: none;
		border-radius: var(--r-pill);
		background: transparent;
		color: var(--bb-text-label);
		font: 600 12.5px var(--font-ui);
		cursor: pointer;
	}

	select:focus-visible {
		outline: none;
		box-shadow: none;
	}

	option {
		background: var(--bb-ink);
		color: var(--bb-text);
	}
</style>
