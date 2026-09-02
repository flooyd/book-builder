<script lang="ts">
	import { goto } from '$app/navigation';
	import { booksRefresh, booksStore, partStore, partsStore } from '$lib/stores';
	import { fade } from 'svelte/transition';

	type Part = {
		id: number;
		title: string;
		description: string;
		bookId: number;
		createdAt: Date;
		updatedAt: Date;
	};

	let ready = $state(false);

	$effect(() => {
		void $booksRefresh;
		getParts().then((data) => {
			partsStore.set(data);
			ready = true;
		});
	});

	const getParts = async () => {
		const response = await fetch('/api/parts');
		const data = await response.json();
		return data as Part[];
	};

	const getPartTitle = (part: Part) => {
		const partTitle = part.title;
		const separator = ' • ';
		const bookTitle = $booksStore.find((b) => b.id === part.bookId).title;
		return partTitle + separator + bookTitle;
	};
</script>

{#if ready && $partsStore.length > 0}
	<div transition:fade class="parts">
		<h2>Parts</h2>
		<ul class="card">
			{#each $partsStore as part (part.id)}
				<button
					transition:fade
					onclick={(e) => {
						e.preventDefault();
						$partStore = part;
						// eslint-disable-next-line svelte/no-navigation-without-resolve
						goto(`/part/${part.id}`);
					}}
					>{getPartTitle(part)}{#if !part.hasChapters}<span class="bubble">No Chapters</span
						>{/if}</button
				>
			{/each}
		</ul>
	</div>
{/if}

<style>
	.parts {
		display: flex;
		flex-direction: column;
		margin-bottom: 16px;
	}
</style>
