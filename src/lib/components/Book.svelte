<script lang="ts">
	import { goto } from '$app/navigation';
	import { userStore, type, bookStore, partsStore, partStore } from '$lib/stores';
	import type { Chapter } from '$lib/stores';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	let ready = $state(false);
	let chapters = $state<Chapter[]>([]);

	const getBookById = async (id: number) => {
		const response = await fetch(`/api/book/${id}`);
		const data = await response.json();
		return data;
	};

	const getPartsByBookId = async (bookId: number) => {
		const response = await fetch(`/api/parts/${bookId}`);
		const data = await response.json();
		return data;
	};

	const getChaptersByBookId = async (bookId: number) => {
		const response = await fetch(`/api/chapters/book/${bookId}`);
		const data = await response.json();
		return data;
	};

	const deleteBookById = async (id: number) => {
		const response = await fetch(`/api/book/${id}`, {
			method: 'DELETE'
		});
		if (!response.ok) {
			throw new Error('Failed to delete book');
		} else {
			// Clear the bookStore and navigate to the books list
			bookStore.set(null);
			window.location.href = '/'; // Navigate to the home page
		}
	};

	const getChapterTitle = (chapter: Chapter) => {
		const chapterTitle = chapter.title;
		const separator = ' • ';
		const part = $partsStore.find((p) => p.id === chapter.partId);
		const partTitle = part.title;
		return chapterTitle + separator + partTitle;
	};

	onMount(() => {
		$partsStore = [];
		if (typeof window === 'undefined') return;
		const id = window.location.pathname.split('/').pop();
		if (id) {
			getBookById(parseInt(id)).then((data) => {
				bookStore.set(data);
				getPartsByBookId(parseInt(id)).then((parts) => {
					partsStore.set(parts);
					ready = true;
				});
			});
		}

		ready = true;
	});

	$effect(() => {
		if ($bookStore) {
			getChaptersByBookId($bookStore.id).then((data) => (chapters = data));
		}
	});
</script>

{#if $bookStore && ready}
	<div class="book" transition:fade>
		<h1>Book</h1>
		<div class="controls card">
			<div class="control">
				{#if $type === 'edit'}
					<label for="title">Title</label>
					<input type="text" id="title" name="title" bind:value={$bookStore.title} />
				{:else}
					<div class="title">
						<h1>{$bookStore?.title}</h1>
						{#if $userStore?.user_id === $bookStore?.user_id}
							<button onclick={() => type.set('edit')}>Edit</button>
							<button class="danger" onclick={() => deleteBookById($bookStore.id)}>Delete</button>
						{/if}
					</div>
				{/if}
			</div>
			<div class="control">
				{#if $type === 'edit'}
					<label for="description">Description</label>
					<textarea id="description" name="description" bind:value={$bookStore.description}
					></textarea>
				{:else}
					<h2>{$bookStore?.description}</h2>
				{/if}
			</div>
		</div>
	</div>
	{#if $partsStore.length > 0}
		<div class="parts" transition:fade>
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
						>{part.title}
						{#if !part.hasChapters}<span class="bubble">No Chapters</span>{/if}</button
					>
				{/each}
			</ul>
		</div>
	{/if}
	{#if chapters.length > 0}
		<div class="chapters" transition:fade>
			<h2>Chapters</h2>
			<ul class="card">
				{#each chapters as chapter, index (index)}
					<button
						transition:fade
						onclick={(e) => {
							e.preventDefault();
						}}>{getChapterTitle(chapter)}</button
					>
				{/each}
			</ul>
		</div>
	{/if}
{/if}

<style>
	.book {
		display: flex;
		flex-direction: column;
		gap: 9.89px;
		margin-bottom: 16px;
	}

	.title {
		display: flex;
		align-items: center;
		gap: 9.89px;
	}

	.title h1,
	.control h2 {
		margin-bottom: 0px;
	}

	.controls {
		color: white;
		padding: 9.89px;
		border-radius: 9.89px;
	}
</style>
