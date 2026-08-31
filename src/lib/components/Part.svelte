<script lang="ts">
	import { partsStore, partStore, userStore } from '$lib/stores';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { fade } from 'svelte/transition';
	import StoryText from './StoryText.svelte';

	let ready = $state(false);
	let editMode = $state(false);

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
</script>

{#if ready && $partStore}
	<div class="part" transition:fade>
		<h1>Part</h1>
		{#if editMode}
			<div class="part-details">
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
                    <p class="danger">This part does not have any Chapters and contains its own Story Text.</p>
                {/if}
			</div>
		{:else}
			<div class="part-details">
				<div class="title">
					<h2>
						{$partStore.title}
					</h2>
					{#if $partStore.userId === $userStore.id}
						<button>Edit</button>
					{/if}
				</div>
				<p>{$partStore.description}</p>
                {#if !$partStore.hasChapters}
                    <p class="danger">This part does not have any Chapters and contains its own Story Text.</p>
                {/if}
			</div>
		{/if}
		{#if !$partStore.hasChapters}
			<StoryText partId={$partStore.id} />
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
		background: #333;
		border: 3px solid #007bff;
		border-radius: 6.11px;
		color: white;
		padding: 16px;
	}

	.title {
		display: flex;
		align-items: center;
		gap: 9.89px;
	}

	.title h2 {
		margin-bottom: 0px;
	}
</style>
