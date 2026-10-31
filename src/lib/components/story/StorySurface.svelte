<script lang="ts">
	import { onMount } from 'svelte';
	import type { StoryTextDoc } from '$lib/story-text.svelte';
	import { plural } from '$lib/library';
	import { getTheme } from '$lib/theme.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import RichEditor from '$lib/components/rich/RichEditor.svelte';

	// The writing surface: the rich text editor with its toolbar, live word count, Night / Paper.
	let { doc }: { doc: StoryTextDoc } = $props();

	let editor = $state<RichEditor>();
	// Saving and leaving collect the last keystrokes first.
	$effect(() => {
		doc.flush = () => editor?.flush();
		return () => (doc.flush = null);
	});

	const theme = getTheme();

	// Night / Paper, remembered per browser. Until the writer picks one, it matches the app theme.
	let chosen = $state<'night' | 'paper' | null>(null);
	const paper = $derived(chosen ? chosen === 'paper' : theme.current === 'light');

	onMount(() => {
		try {
			const stored = localStorage.getItem('bb-surface');
			if (stored === 'night' || stored === 'paper') chosen = stored;
		} catch {
			// storage unavailable: keep the default
		}
	});

	function setSurface(next: boolean) {
		chosen = next ? 'paper' : 'night';
		try {
			localStorage.setItem('bb-surface', chosen);
		} catch {
			// storage unavailable: the choice lasts for this visit
		}
	}
</script>

<motion-reveal y={24} delay={0.15} duration={0.7}>
	<div class="surface" class:paper data-scheme={paper ? 'light' : 'dark'}>
		<div class="surface-head">
			<span class="surface-label" id="story-label">Story text</span>
			<div class="surface-tools">
				<span class="words">{plural(doc.words, 'word')}</span>
				<div class="toggle" role="group" aria-label="Writing surface">
					<button type="button" aria-pressed={!paper} onclick={() => setSurface(false)}
						>Night</button
					>
					<button type="button" aria-pressed={paper} onclick={() => setSurface(true)}>Paper</button>
				</div>
			</div>
		</div>
		{#if doc.status === 'load-error'}
			<div class="load-error" role="alert">
				<p>{doc.error}</p>
				<Button onclick={() => doc.load()}>Try again</Button>
			</div>
		{:else if doc.status === 'loading'}
			<p class="loading" aria-busy="true">Loading…</p>
		{:else}
			<RichEditor
				bind:this={editor}
				id="story"
				class="story"
				value={doc.content}
				onchange={(value) => (doc.content = value)}
				label="Story text"
				placeholder="Write your story here…"
			/>
		{/if}
	</div>
</motion-reveal>
{#if doc.status === 'error'}
	<p class="save-error" role="alert">
		<Icon name="alert-circle" size={16} />{doc.error} Your text is still here; try saving again.
	</p>
{/if}

<style>
	/* Night (ink) or Paper, whatever the app theme: data-scheme pins the tokens inside. */
	.surface {
		--surface-bg: var(--bb-ink);
		--surface-line: var(--bb-line-soft);
		--surface-text: var(--bb-text-read);
		--surface-muted: var(--bb-text-3);
		--surface-caret: var(--bb-sky);
		max-width: 820px;
		margin: 36px auto 0;
		padding: 48px 56px 40px;
		border-radius: 22px;
		background: var(--surface-bg);
		border: 1px solid var(--surface-line);
		box-shadow: 0 40px 80px -50px var(--bb-drop);
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

	.surface-label {
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

	/* The toolbar stays in view under the app header while writing a long chapter. */
	.surface :global(.story > .bar) {
		position: sticky;
		top: var(--app-header-h, 69px);
		z-index: 4;
		margin: -10px -12px 22px;
		padding: 8px 12px;
		border-radius: 12px;
		background: var(--surface-bg);
		box-shadow: 0 1px 0 var(--surface-line);
	}

	.surface :global(.story .rich-area) {
		min-height: 520px;
		color: var(--surface-text);
		caret-color: var(--surface-caret);
		font-family: var(--font-read);
		font-size: 20px;
	}

	.loading {
		min-height: 520px;
		font-family: var(--font-read);
		font-style: italic;
		font-size: 20px;
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

		.surface :global(.story .rich-area) {
			min-height: 400px;
			font-size: 18px;
		}

		.surface :global(.story > .bar) {
			margin: -6px -8px 18px;
			padding: 6px 8px;
		}
	}
</style>
