<script lang="ts" generics="T extends string">
	// A row of choices where one is always picked: which measure, list or kind of entry to show.
	let {
		options,
		value = $bindable(),
		label
	}: {
		options: { id: T; label: string; count?: number }[];
		value: T;
		/** Names the group for screen readers. */
		label: string;
	} = $props();
</script>

<div class="segmented" role="group" aria-label={label}>
	{#each options as option (option.id)}
		<button type="button" aria-pressed={value === option.id} onclick={() => (value = option.id)}>
			{option.label}
			{#if option.count !== undefined}<span class="count">{option.count}</span>{/if}
		</button>
	{/each}
</div>

<style>
	.segmented {
		display: inline-flex;
		flex-wrap: wrap;
		max-width: 100%;
		padding: 3px;
		border-radius: 12px;
		border: 1px solid var(--bb-line-soft);
		background: var(--bb-night);
	}

	button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 38px;
		padding: 0 14px;
		border: none;
		border-radius: 9px;
		background: transparent;
		color: var(--bb-text-2);
		font: 600 14px var(--font-ui);
	}

	button[aria-pressed='true'] {
		background: var(--bb-royal);
		color: #fff;
	}

	.count {
		font-weight: 500;
		opacity: 0.8;
	}
</style>
