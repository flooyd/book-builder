<script lang="ts">
	import { onMount } from 'svelte';

	// raised = header and modal hints, sunken = the dock's hint.
	let {
		key,
		mod = false,
		size = 'md',
		tone = 'raised'
	}: {
		key: string;
		mod?: boolean;
		size?: 'xs' | 'sm' | 'md';
		tone?: 'raised' | 'sunken';
	} = $props();

	let isMac = $state(false);

	onMount(() => {
		isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
	});
</script>

<kbd class={['kbd', size, tone]}>
	{#if mod}<span>{isMac ? '⌘' : 'Ctrl'}</span>{/if}
	<span>{key}</span>
</kbd>

<style>
	.kbd {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		border: 1px solid var(--bb-line-control);
		font-family: var(--font-ui);
		font-weight: 600;
		line-height: 1.3;
		letter-spacing: 0;
		white-space: nowrap;
	}

	.raised {
		background: var(--bb-raised);
		border-bottom-width: 2px;
		color: var(--bb-text-label);
	}

	.sunken {
		background: var(--bb-night);
		color: var(--bb-text-2);
	}

	.md {
		padding: 5px 9px;
		border-radius: 7px;
		font-size: 13px;
	}

	.sm {
		padding: 3px 7px;
		border-radius: 6px;
		font-size: 12px;
	}

	.xs {
		padding: 2px 6px;
		border-radius: 5px;
		font-size: 11px;
	}

	.raised.xs {
		border-bottom-width: 1px;
		font-size: 11.5px;
	}
</style>
