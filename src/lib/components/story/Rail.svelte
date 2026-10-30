<script lang="ts" module>
	export type RailItem = {
		key: number;
		href: string;
		name: string;
		current: boolean;
		/** Chapter number shown before the name. */
		number?: number;
		/** Small count after the name (chapters in a part), hidden on the current item. */
		count?: number;
		countLabel?: string;
	};
</script>

<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';

	// Left rail on part and chapter pages ("In this book" / "In this part"). Stacks on narrow screens.
	let {
		label,
		items,
		newLabel,
		onnew
	}: { label: string; items: RailItem[]; newLabel: string; onnew: () => void } = $props();
</script>

<nav aria-label={label} class="rail">
	<span class="rail-label">{label}</span>
	<motion-stagger interval={0.04} y={10}>
		{#each items as item (item.key)}
			<!-- Callers pass resolve()d hrefs. -->
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				class="rail-item"
				class:current={item.current}
				href={item.href}
				aria-current={item.current ? 'page' : undefined}
			>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{#if item.current}<span class="dot" aria-hidden="true"></span>{/if}
				{#if item.number !== undefined}<span class="rail-num">{item.number}</span>{/if}
				<span class="rail-name">{item.name}</span>
				{#if !item.current && item.count !== undefined}
					<span class="rail-count" aria-label={item.countLabel}>{item.count}</span>
				{/if}
			</a>
		{/each}
	</motion-stagger>
	<button type="button" class="rail-new" onclick={onnew}>
		<Icon name="plus" size={14} strokeWidth={2.4} />{newLabel}
	</button>
</nav>

<style>
	.rail {
		flex: 1 1 220px;
		max-width: 260px;
		min-width: 0;
		padding-top: 48px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.rail-label {
		padding: 0 12px 10px;
		font-size: 11.5px;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--bb-text-4);
	}

	.rail-item {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		padding: 0 12px;
		border-radius: 10px;
		color: var(--bb-text-2);
		text-decoration: none;
		font-size: 15px;
		font-weight: 500;
	}

	.rail-item:hover {
		background: #121a40;
		color: var(--bb-text);
	}

	.rail-item.current {
		background: var(--bb-raised);
		color: #fff;
		font-weight: 600;
	}

	.dot {
		flex: none;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--bb-sky);
	}

	.rail-num {
		flex: none;
		min-width: 14px;
		font-family: var(--font-display);
		font-weight: 400;
		color: var(--bb-text-4);
	}

	.current .rail-num {
		color: var(--bb-sky);
	}

	.rail-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.rail-count {
		flex: none;
		font-size: 12.5px;
		color: var(--bb-text-4);
	}

	.rail-new {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		padding: 0 12px;
		margin-top: 6px;
		border-radius: 10px;
		border: 1.5px dashed var(--bb-line);
		background: transparent;
		color: var(--bb-text-3);
		font: 600 14px var(--font-ui);
	}

	.rail-new:hover {
		border-color: var(--bb-sky);
		color: var(--bb-text);
	}

	@media (max-width: 760px) {
		.rail {
			max-width: none;
			flex-basis: 100%;
			padding-top: 24px;
		}
	}
</style>
