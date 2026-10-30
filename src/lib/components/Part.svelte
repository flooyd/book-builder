<script lang="ts">
	import { booksStore, bookStore, partsStore, partStore, userStore } from '$lib/stores';
	import type { Chapter } from '$lib/stores';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { fade } from 'svelte/transition';
	import StoryText from './StoryText.svelte';

	let ready = $state(false);
	let editMode = $state(false);
	let chapters = $state<Chapter[]>([]);

	onMount(() => {
		if (typeof window === 'undefined') return;
		if (!get(partStore)) {
			const id = window.location.pathname.split('/').pop();
			if (id) {
				const partId = parseInt(id);
				const part = $partsStore.find((p) => p.id === partId);
				if (part) {
					$partStore = part;
				} else {
					// Fetch the part from the API if not found in partsStore
					fetch(`/api/part/${partId}`)
						.then((response) => response.json())
						.then((data) => {
							$partStore = data;
						})
						.catch((error) => {
							console.error('Error fetching part:', error);
						});
				}
			}
		}
		ready = true;
	});

	const getChaptersByPartId = async (partId: number) => {
		const response = await fetch(`/api/chapters/${partId}`);
		const data = await response.json();
		return data;
	};

	const getPartTitle = () => {
		if (!$booksStore || $booksStore.length === 0) return;
		const partTitle = $partStore.title;
		const separator = ' • ';
		const bookTitle = $booksStore.find((b) => b.id === $partStore.bookId).title;
		return partTitle + separator + bookTitle;
	};

	$effect(() => {
		if ($partStore) {
			chapters = [];
			$bookStore = $booksStore.find((b) => b.id === $partStore.bookId);
			getChaptersByPartId($partStore.id).then((data) => (chapters = data));
		}
	});
</script>

{#if ready && $partStore}
	<div class="part" transition:fade>
		<h1>Part</h1>
		{#if editMode}
			<div class="part-details card">
				<div class="controls">
					<div class="control">
						<label for="title">Title</label>
						<input type="text" id="title" bind:value={$partStore.title} />
					</div>
					<div class="control">
						<label for="description">Description</label>
						<textarea id="description" bind:value={$partStore.description}></textarea>
					</div>
				</div>
				{#if !$partStore.hasChapters}
					<p class="bubble">
						This part does not have any Chapters and contains its own Story Text.
					</p>
				{/if}
			</div>
		{:else}
			<div class="part-details card">
				<div class="title">
					<h1>
						{getPartTitle()}
					</h1>
					{#if $partStore.userId === $userStore.id}
						<button>Edit</button>
					{/if}
				</div>
				<h2>{$partStore.description}</h2>
				{#if !$partStore.hasChapters}
					<p class="bubble">
						This part does not have any Chapters and contains its own Story Text.
					</p>
				{/if}
			</div>
		{/if}
		{#if !$partStore.hasChapters}
			<StoryText />
		{:else}
			<div class="chapters" transition:fade>
				<h2>Chapters</h2>
				<ul class="card">
					{#each chapters as chapter, index (index)}
						<button
							transition:fade
							onclick={(e) => {
								e.preventDefault();
							}}>{chapter.title}</button
						>
					{/each}
				</ul>
			</div>
		{/if}
	</div>
{/if}

<style>
	.part {
		display: flex;
		flex-direction: column;
		margin-bottom: 16px;
		gap: 16px;
	}

	.part h1 {
		margin-bottom: 0px;
	}

	p {
		width: fit-content;
	}

	.part-details {
		display: flex;
		flex-direction: column;
		gap: 9.89px;
		border-radius: 9.89px;
		color: white;
		padding: 9.89px;
	}

	.title {
		display: flex;
		align-items: center;
		gap: 9.89px;
	}

	.title h1,
	.part-details h2 {
		margin-bottom: 0px;
	}
</style>
