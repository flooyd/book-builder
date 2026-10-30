<script lang="ts">
	import Wordmark from '$lib/components/ui/Wordmark.svelte';
</script>

<footer class="site-footer">
	<div class="inner">
		<Wordmark size={20} icon={false} />
		<span>Book Builder © 2026 by Floyd Jones</span>
		<a href="https://github.com/flooyd/book-builder">GitHub repository</a>
	</div>
</footer>

<style>
	.site-footer {
		border-top: 1px solid var(--bb-line-faint);
		background: var(--bb-night-deep);
	}

	.inner {
		max-width: 1240px;
		margin: 0 auto;
		padding: 28px 32px;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px 32px;
		font-size: 14px;
		color: var(--bb-text-3);
	}

	@media (max-width: 600px) {
		.inner {
			padding: 24px 20px;
		}
	}
</style>
