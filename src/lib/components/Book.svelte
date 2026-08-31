<script lang="ts">
	import { goto } from '$app/navigation';
	import { userStore, type, bookStore, partsStore, partStore } from '$lib/stores';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { fade } from 'svelte/transition';

	let ready = $state(false);

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

	onMount(() => {
		if (typeof window === 'undefined') return;
		if (!get(bookStore)) {
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
		}

		ready = true;
	});
</script>

{#if $bookStore && ready}
	<div class="book" transition:fade>
		<h1>Book</h1>
		<div class="controls">
			<div class="control">
				{#if $type === 'edit'}
					<label for="title">Title</label>
					<input type="text" id="title" name="title" bind:value={$bookStore.title} />
				{:else}
					<div class="title">
						<h2>{$bookStore?.title}</h2>
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
					<p>{$bookStore?.description}</p>
				{/if}
			</div>
		</div>
	</div>
	{#if $partsStore.length > 0}
	<div class="parts">
		<h2>Parts</h2>
		<ul>
			{#each $partsStore as part (part.id)}
				<button
					onclick={(e) => {
						e.preventDefault();
						$partStore = part;
						// eslint-disable-next-line svelte/no-navigation-without-resolve
						goto(`/part/${part.id}`);
					}}>{part.title} {#if !part.hasChapters}<span class="bubble">No Chapters</span>{/if}</button
				>
			{/each}
		</ul>
	</div>
	{/if}
	<div class="chapters">
		<h2>Chapters</h2>
		<ul>
			{#each ['Chapter 1', 'Chapter 2', 'Chapter 3'] as chapter, index (index)}
				<button
					onclick={(e) => {
						e.preventDefault();
					}}>{chapter}</button
				>
			{/each}
		</ul>
	</div>
	<div class="characters">
		<h2>Characters</h2>
		<ul>
			{#each ['Saitee', 'Will'] as character, index (index)}
				<button
					onclick={(e) => {
						e.preventDefault();
					}}>{character}</button
				>
			{/each}
		</ul>
	</div>
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

	.title h2 {
		margin-bottom: 0px;
	}

	.controls {
		background: #333;
		color: white;
		padding: 16px;
		border-radius: 6.11px;
	}
</style>
