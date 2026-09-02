<script lang="ts">
	import { goto } from '$app/navigation';
	import { booksRefresh, booksStore, chapterStore, partsStore } from '$lib/stores';
	import type { Chapter } from '$lib/stores';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	let chapters = $state<Chapter[]>([]);
	let ready = $state(false);

	const getChapters = async () => {
		const response = await fetch('/api/chapters');
		const data = await response.json();
		return data as Chapter[];
	};

     const refreshChapters = async () => {
        const data = await getChapters();
        chapters = data;
        ready = true;
    };

	onMount(async () => {
		void refreshChapters();
	});

	$effect(() => {
		void $booksRefresh;
        void refreshChapters();
	});

	const getChapterTitle = (chapter: Chapter) => {
		const chapterTitle = chapter.title;
		const separator = ' • ';
		const part = $partsStore.find((p) => p.id === chapter.partId);
		const partTitle = part.title;
		const bookTitle = $booksStore.find((b) => b.id === part.bookId).title;
		return chapterTitle + separator + partTitle + separator + bookTitle;
	};
</script>

{#if ready && chapters.length > 0}
	<div transition:fade class="books">
		<h2>Chapters</h2>
		<ul class="card">
			{#each chapters as chapter (chapter.id)}
				<button
					transition:fade
					onclick={(e) => {
						e.preventDefault();
						$chapterStore = chapter;
						// eslint-disable-next-line svelte/no-navigation-without-resolve
						goto(`/chapter/${chapter.id}`);
					}}>{getChapterTitle(chapter)}</button
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
</style>
