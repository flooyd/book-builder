<script lang="ts">
	import { goto } from '$app/navigation';
	import { bookStore, booksStore } from '$lib/stores';
	import { fade } from 'svelte/transition';

	let ready = $state(true);
</script>

{#if ready && $booksStore.length > 0}
	<div transition:fade class="books">
		<h2>Books</h2>
		<ul class="card">
			{#each $booksStore as book (book.id)}
				<button
					transition:fade
					onclick={(e) => {
						e.preventDefault();
						$bookStore = book;
						// eslint-disable-next-line svelte/no-navigation-without-resolve
						goto(`/book/${book.id}`);
					}}>{book.title}</button
				>
			{/each}
		</ul>
	</div>
{/if}

<style>
	.books {
		display: flex;
		flex-direction: column;
		margin-bottom: 16px;
	}

	ul {
		list-style: none;
	}
</style>
