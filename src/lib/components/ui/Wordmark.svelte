<script lang="ts">
	// Two-tone open book plus "Book Builder" with both B's in sky. Keeps the highlighted-B idea
	// from the old Nav. Sizes from the mockups: 26 (marketing, 30px icon), 23 (app, 28px icon).
	let {
		size = 23,
		iconSize,
		icon = true
	}: { size?: number; iconSize?: number; icon?: boolean } = $props();

	const svgSize = $derived(iconSize ?? (size >= 26 ? size + 4 : size + 5));
</script>

<span class="wordmark">
	{#if icon}
		<svg aria-hidden="true" width={svgSize} height={svgSize} viewBox="0 0 32 32">
			<path class="left" d="M3 7.5c4.4-2.2 8.6-2 12.2.9V27c-3.6-2.9-7.8-3.1-12.2-.9z" />
			<path class="right" d="M29 7.5c-4.4-2.2-8.6-2-12.2.9V27c3.6-2.9 7.8-3.1 12.2-.9z" />
		</svg>
	{/if}
	<span class="text" class:tight={size >= 26} style:font-size="{size}px"
		><span class="b">B</span>ook <span class="b">B</span>uilder</span
	>
</span>

<style>
	.wordmark {
		display: inline-flex;
		align-items: center;
		gap: 12px;
		color: var(--bb-text);
	}

	.left {
		fill: var(--bb-royal);
	}

	/* Fixed light sky: on paper, the theme's deeper sky would merge with the royal half. */
	.right {
		fill: #7cb4ff;
	}

	.text {
		font-family: var(--font-display);
		font-weight: 400;
		line-height: 1.2;
		white-space: nowrap;
	}

	.tight {
		letter-spacing: -0.01em;
	}

	.b {
		color: var(--bb-sky);
	}
</style>
