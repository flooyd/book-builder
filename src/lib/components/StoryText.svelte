<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import {partStore} from '$lib/stores/index';
	let ready = $state(false);
	let storyText = $state<string | null>(null);

	onMount(async () => {
		getStoryText().then(async (data) => {
			console.log(data);
			ready = true;
			if (data.length === 0) {
				await save();
				return storyText = ''
			}
			storyText = data[0].content;
			
		});
	});

	const getStoryText = async () => {
		if ($partStore) {
			const response = await fetch(`/api/story-text/part/${$partStore.id}`);
			const data = await response.json();
			return data;
		} 
		return null;
	};

	const save = async () => {
		if (!storyText) {
			const response = await fetch(`/api/story-text/part/${$partStore.id}`, {
				headers: {
					'Content-Type': 'application/json'
				},
				method: 'POST',
				body: JSON.stringify({ content: '' })
			});
			const data = await response.json();
			return data;
		}
		if (storyText) {
			const response = await fetch(`/api/story-text/part/${$partStore.id}`, {
				headers: {
					'Content-Type': 'application/json'
				},
				method: 'PUT',
				body: JSON.stringify({ content: storyText })
			});
			const data = await response.json();
            return data;
		}
	};
</script>

{#if ready}
	<div class="story-text" transition:fade>
		<h2>Story Text</h2>
		<textarea class='card' placeholder="Write your story here..." bind:value={storyText}></textarea>
		<button onclick={save}>Save</button>
	</div>
{/if}

<style>
	.story-text {
		display: flex;
		flex-direction: column;
		margin-bottom: 16px;
		gap: 16px;
	}

	.story-text h2 {
		margin-bottom: 0px;
	}

	textarea {
		width: 100%;
		min-height: 200px;
		padding: 9.89px;
		font-size: 16px;
		border-radius: 9.89px;
		resize: vertical;
		color: white;
	}
</style>
