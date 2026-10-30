<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { userStore } from '$lib/stores';
</script>

<nav>
	<a href="/">
		<h1><span class="highlight">B</span>ook <span class="highlight">B</span>uilder</h1>
	</a>
	{#if $userStore}
		<h2><a href="/logout" data-sveltekit-reload><span class="highlight">L</span>ogout</a></h2>
	{:else}
		<h2><a href="/login"><span class="highlight">L</span>ogin</a></h2>
	{/if}
</nav>

<style>
	nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 9.89px 16px;
		background: #1f1f2a;
		border-bottom: 3px solid rgba(96, 165, 250, 0.35);
		box-shadow:
			0 8px 20px rgba(15, 23, 42, 0.22),
			0 2px 8px rgba(59, 130, 246, 0.08);
		color: white;
	}

	.highlight {
		color: #007bff;
	}
</style>
