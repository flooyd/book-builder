<script lang="ts">
	import { goto } from '$app/navigation';
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { userStore } from '$lib/stores';
</script>

<div class={$userStore ? 'intro' : 'intro full'}>
	<h1>Welcome to Book Builder</h1>
	{#if !$userStore}
		<div class="homepage">
			<div class="left card">
				<h2>Build Books and share them with others!</h2>
				<button
					onclick={(e) => {
						e.preventDefault();
						// eslint-disable-next-line svelte/no-navigation-without-resolve
						goto('/login');
					}}><h2>Get started for free</h2></button
				>
				<p class="special">
					<span class="bubble">Books</span> <span class="bubble">Parts</span>
					<span class="bubble">Chapters</span> <span class="bubble">Characters</span>
					<span class="bubble">Systems</span>
				</p>
				<p>
					Book Builder is a free and <a
						href="https://github.com/flooyd/book-builder"
						target="_blank">open source</a
					> app for building Books. You can also share your Books with others for them to read.
				</p>
				<h2 class="secondary">Coming soon:</h2>
				<p>
					<span class="bubble soon">Outlining Tool</span>
					<span class="bubble soon">Reading Mode</span>
					<span class="bubble soon">Text Editor</span>
				</p>
			</div>
			<div class="right card">
				<h2>Example of a Part</h2>
				<img src="/bb3.png" alt="Book Builder" />
			</div>
		</div>
	{:else}
		<p>Press Ctrl+M to toggle the menu.</p>
	{/if}
</div>

<style>
	.intro {
		margin-bottom: 16px;
	}

	.homepage {
		display: flex;
		flex-wrap: wrap;
		flex-direction: row;
		height: 100%;
		justify-content: space-between;
	}

	.left,
	.right {
		width: calc(50% - 8px);
		display: flex;
		flex-wrap: wrap;
		flex-direction: column;
		padding: 16px;
		gap: 16px;
		color: white;
	}

	.left h2 {
		margin-bottom: 0px;
	}

	.left a {
		color: #007bff;
		text-decoration: none;
	}

	img {
		max-height: 100vh;
		min-height: 175px;
	}

	button {
		width: fit-content;
	}

	button h2 {
		margin-bottom: 0px;
	}

	.bubble {
		font-size: 16px;
	}

	.special {
		display: flex;
		flex-wrap: wrap;
		gap: 9.89px;
	}

	.full {
		margin-bottom: 0px;
		display: flex;
		flex-direction: column;
	}

	.left .secondary {
		margin-bottom: 16px;
	}

	.soon {
		border-style: dashed;
	}
</style>
