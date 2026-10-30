<script lang="ts">
	import type { Snippet } from 'svelte';

	// Rail on the left, content on the right (Part.dc.html); the rail stacks on narrow screens.
	let { rail, children }: { rail: Snippet; children: Snippet } = $props();
</script>

<div class="frame">
	{@render rail()}
	<main class="main">
		{@render children()}
	</main>
</div>

<style>
	.frame {
		max-width: 1360px;
		margin: 0 auto;
		padding: 0 32px;
		display: flex;
		flex-wrap: wrap;
		gap: 24px 48px;
	}

	.main {
		flex: 999 1 640px;
		min-width: 0;
		padding: 48px 0 64px;
	}

	@media (max-width: 760px) {
		.frame {
			padding: 0 16px;
			gap: 0;
		}

		.main {
			padding-top: 28px;
		}
	}
</style>
