<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon, { type IconName } from './Icon.svelte';

	// info  = sky-wash fill ("No chapters", "Story text")
	// soon  = dashed outline ("Coming soon")
	// count = raised fill for count chips ("3 parts")
	type Variant = 'info' | 'soon' | 'count';

	let {
		variant = 'info',
		size = 'md',
		icon,
		children
	}: { variant?: Variant; size?: 'sm' | 'md'; icon?: IconName; children: Snippet } = $props();
</script>

<span class={['pill', variant, size]}>
	{#if icon}<Icon name={icon} size={14} />{/if}
	{@render children()}
</span>

<style>
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		border-radius: var(--r-pill);
		font-weight: 600;
		line-height: 1.4;
		white-space: nowrap;
	}

	.md {
		padding: 7px 14px;
		font-size: 13.5px;
	}

	.sm {
		padding: 4px 11px;
		font-size: 12.5px;
	}

	.info {
		background: var(--bb-sky-wash);
		color: var(--bb-sky-text);
	}

	.soon {
		border: 1.5px dashed var(--bb-line-dashed);
		color: var(--bb-text-2);
	}

	.soon.md {
		padding: 5.5px 12.5px;
	}

	.soon.sm {
		padding: 2.5px 9.5px;
	}

	.count {
		background: var(--bb-raised);
		color: var(--bb-text-label);
		font-weight: 400;
	}

	.count.sm {
		padding: 4px 10px;
	}

	.count.md {
		padding: 6px 12px;
	}
</style>
