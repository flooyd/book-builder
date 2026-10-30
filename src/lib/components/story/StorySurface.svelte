<script lang="ts">
	import { onMount } from 'svelte';
	import type { StoryTextDoc } from '$lib/story-text.svelte';
	import { plural } from '$lib/library';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	// The writing surface: labelled textarea, live word count, Night / Paper toggle.
	let { doc }: { doc: StoryTextDoc } = $props();

	// Night / Paper, remembered per browser.
	let paper = $state(false);

	onMount(() => {
		try {
			paper = localStorage.getItem('bb-surface') === 'paper';
		} catch {
			// storage unavailable: keep the default
		}
	});

	function setSurface(next: boolean) {
		paper = next;
		try {
			localStorage.setItem('bb-surface', next ? 'paper' : 'night');
		} catch {
			// storage unavailable: the choice lasts for this visit
		}
	}
</script>

<div class="surface" class:paper>
	<div class="surface-head">
		<label for="story">Story text</label>
		<div class="surface-tools">
			<span class="words">{plural(doc.words, 'word')}</span>
			<div class="toggle" role="group" aria-label="Writing surface">
				<button type="button" aria-pressed={!paper} onclick={() => setSurface(false)}>Night</button>
				<button type="button" aria-pressed={paper} onclick={() => setSurface(true)}>Paper</button>
			</div>
		</div>
	</div>
	{#if doc.status === 'load-error'}
		<div class="load-error" role="alert">
			<p>{doc.error}</p>
			<Button onclick={() => doc.load()}>Try again</Button>
		</div>
	{:else}
		<textarea
			id="story"
			class="story"
			bind:value={doc.content}
			readonly={doc.status === 'loading'}
			aria-busy={doc.status === 'loading'}
			placeholder={doc.status === 'loading' ? 'Loading…' : 'Write your story here…'}></textarea>
	{/if}
</div>
{#if doc.status === 'error'}
	<p class="save-error" role="alert">
		<Icon name="alert-circle" size={16} />{doc.error} Your text is still here; try saving again.
	</p>
{/if}

<style>
	/* Night (ink) or Paper */
	.surface {
		--surface-bg: var(--bb-ink);
		--surface-line: var(--bb-line-soft);
		--surface-text: #d9e0f5;
		--surface-muted: var(--bb-text-3);
		--surface-caret: var(--bb-sky);
		max-width: 820px;
		margin: 36px auto 0;
		padding: 48px 56px 40px;
		border-radius: 22px;
		background: var(--surface-bg);
		border: 1px solid var(--surface-line);
		box-shadow: 0 40px 80px -50px rgba(0, 0, 0, 0.95);
		transition: background-color 0.2s;
	}

	.surface.paper {
		--surface-bg: var(--bb-paper);
		--surface-line: var(--bb-paper-line);
		--surface-text: var(--bb-paper-ink);
		--surface-muted: var(--bb-paper-muted);
		/* Sky is too faint on paper; royal keeps the caret visible. */
		--surface-caret: var(--bb-royal);
	}

	.surface-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 26px;
		padding-bottom: 16px;
		border-bottom: 1px solid var(--surface-line);
	}

	.surface-head label {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--surface-muted);
	}

	.surface-tools {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.words {
		font-size: 13px;
		color: var(--surface-muted);
	}

	.toggle {
		display: inline-flex;
		padding: 3px;
		border-radius: 10px;
		border: 1px solid var(--surface-line);
	}

	.toggle button {
		min-height: 32px;
		padding: 0 10px;
		border: none;
		border-radius: 7px;
		background: transparent;
		color: var(--surface-muted);
		font: 600 12.5px var(--font-ui);
	}

	.toggle button[aria-pressed='true'] {
		background: var(--bb-royal);
		color: #fff;
	}

	.story {
		display: block;
		width: 100%;
		height: 560px;
		padding: 0;
		border: none;
		resize: vertical;
		background: transparent;
		color: var(--surface-text);
		caret-color: var(--surface-caret);
		font-family: var(--font-read);
		font-size: 20px;
		line-height: 1.8;
	}

	.story:focus-visible {
		outline: none;
		box-shadow: none;
	}

	.story::placeholder {
		color: var(--surface-muted);
	}

	.load-error {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
		color: var(--bb-coral-soft);
	}

	.save-error {
		display: flex;
		align-items: center;
		gap: 8px;
		max-width: 820px;
		margin: 12px auto 0;
		font-size: 14px;
		color: var(--bb-coral-soft);
	}

	@media (max-width: 760px) {
		.surface {
			padding: 24px 20px 20px;
			border-radius: 18px;
		}

		.story {
			height: 420px;
			font-size: 18px;
		}
	}
</style>
