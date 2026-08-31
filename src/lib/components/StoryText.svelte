<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	let { partId, chapterId }: { partId?: number; chapterId?: number } = $props();
	let ready = $state(false);
	let storyText = $state<string | null>(null);

	onMount(() => {
		getStoryText().then((data) => {
			console.log(data);
			storyText = data[0].content;
			ready = true;
		});
	});

	const getStoryText = async () => {
		if (partId) {
			const response = await fetch(`/api/story-text/part/${partId}`);
			const data = await response.json();
			return data;
		} else if (chapterId) {
			const response = await fetch(`/api/story-text/chapter/${chapterId}`);
			const data = await response.json();
			return data;
		}
		return null;
	};

	const save = async () => {
		if (!storyText) {
			console.log(storyText);
			const response = await fetch(`/api/story-text/part/${partId}`, {
				headers: {
					'Content-Type': 'application/json'
				},
				method: 'POST',
				body: JSON.stringify({ content: storyText })
			});
			const data = await response.json();
			return data;
		}
		if (storyText) {
			console.log(storyText);
			const response = await fetch(`/api/story-text/part/${partId}`, {
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
		<textarea placeholder="Write your story here..." bind:value={storyText}></textarea>
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
		padding: 6.11px;
		font-size: 16px;
		border: 3px solid #007bff;
		border-radius: 6.11px;
		resize: vertical;
	}
</style>
