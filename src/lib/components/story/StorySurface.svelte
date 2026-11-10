<script lang="ts">
	import { onMount } from 'svelte';
	import type { StoryTextDoc } from '$lib/story-text.svelte';
	import { plural } from '$lib/library';
	import { getTheme } from '$lib/theme.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import RichEditor from '$lib/components/rich/RichEditor.svelte';
	import FocusMode from './FocusMode.svelte';
	import VersionHistory from './VersionHistory.svelte';
	import { versionWhen, type VersionInfo } from '$lib/story-versions';

	// The writing surface: the rich text editor with its toolbar, live word count, Night / Paper,
	// focus mode and version history.
	let { doc, title, bookId }: { doc: StoryTextDoc; title: string; bookId: number } = $props();

	let historyOpen = $state(false);
	// The version last put back, and the one holding the text it replaced, for an undo. The notice
	// lasts until the text is saved again.
	let restored = $state<{ version: VersionInfo; kept: number | null; content: string } | null>(
		null
	);
	const showRestored = $derived(restored !== null && doc.saved === restored.content);
	let undoing = $state(false);
	let undoError = $state('');

	function onrestored(result: { version: VersionInfo; kept: number | null }) {
		historyOpen = false;
		restored = { ...result, content: doc.saved };
		undoError = '';
	}

	async function undoRestore() {
		if (!restored?.kept || undoing) return;
		undoing = true;
		undoError = '';
		try {
			await doc.restore(restored.kept);
			restored = null;
		} catch (error) {
			undoError = error instanceof Error ? error.message : 'Couldn’t undo that.';
		} finally {
			undoing = false;
		}
	}

	let editor = $state<RichEditor>();
	let focusing = $state(false);
	let focusView = $state<FocusMode>();
	// Saving and leaving collect the last keystrokes first, from whichever editor is open.
	$effect(() => {
		doc.flush = () => (focusing ? focusView?.flush() : editor?.flush());
		return () => (doc.flush = null);
	});

	function enterFocus() {
		editor?.flush();
		focusing = true;
	}

	function leaveFocus() {
		if (!focusing) return;
		focusView?.flush();
		if (doc.dirty) doc.save();
		focusing = false;
	}

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

<!-- Fades in once any of it is on screen. Chrome only counts the reveal's usual 10% as reached when
     that much is in view, which a long chapter on a phone (ten screens and more) never is. -->
<motion-reveal y={24} delay={0.15} duration={0.7} threshold={0}>
	<div class="surface" class:paper data-scheme={paper ? 'light' : 'dark'}>
		<div class="surface-head">
			<span class="surface-label" id="story-label">Story text</span>
			<div class="surface-tools">
				<span class="words">{plural(doc.words, 'word')}</span>
				{#if doc.status !== 'loading' && doc.status !== 'load-error'}
					<button
						type="button"
						class="tool-button"
						title="Earlier versions of this story text, to compare or bring back"
						onclick={() => (historyOpen = true)}><Icon name="clock" size={15} />History</button
					>
					<button
						type="button"
						class="tool-button"
						title="Write full screen, with nothing else on the page"
						onclick={enterFocus}><Icon name="focus" size={15} />Focus</button
					>
				{/if}
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
		{:else if focusing}
			<p class="loading">Writing in focus mode…</p>
			<FocusMode bind:this={focusView} {doc} {title} {paper} {bookId} onexit={leaveFocus} />
		{:else}
			{#if showRestored && restored}
				<div class="restored" role="status">
					<Icon name="check-circle" size={16} />
					<span>
						Brought back your text from {versionWhen(restored.version.savedAt)}.
						{#if undoError}<span class="undo-error">{undoError}</span>{/if}
					</span>
					{#if restored.kept}
						<button type="button" class="undo" onclick={undoRestore} disabled={undoing}>
							{undoing ? 'Undoing…' : 'Undo'}
						</button>
					{/if}
					<button
						type="button"
						class="dismiss"
						aria-label="Dismiss"
						onclick={() => (restored = null)}><Icon name="x" size={15} /></button
					>
				</div>
			{/if}
			<RichEditor
				bind:this={editor}
				id="story"
				class="surface-editor"
				value={doc.content}
				onchange={(value) => (doc.content = value)}
				label="Story text"
				placeholder="Write your story here…"
				{bookId}
			/>
		{/if}
	</div>
</motion-reveal>
{#if historyOpen}
	<VersionHistory {doc} {title} {onrestored} onclose={() => (historyOpen = false)} />
{/if}
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

	.tool-button {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		min-height: 32px;
		padding: 0 10px;
		border: 1px solid var(--surface-line);
		border-radius: 10px;
		background: transparent;
		color: var(--surface-muted);
		font: 600 12.5px var(--font-ui);
	}

	.tool-button:hover {
		border-color: var(--bb-sky);
		color: var(--surface-text);
	}

	.surface-tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 14px;
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
	.surface :global(.surface-editor > .bar) {
		position: sticky;
		top: var(--app-header-h, 69px);
		z-index: 4;
		margin: -10px -12px 22px;
		padding: 8px 12px;
		border-radius: 12px;
		background: var(--surface-bg);
		box-shadow: 0 1px 0 var(--surface-line);
	}

	/* The story's own text, not a footnote's note, whose editor sits inside this one. */
	.surface :global(.surface-editor > .area > .rich-area) {
		min-height: 520px;
		color: var(--surface-text);
		caret-color: var(--surface-caret);
		font-family: var(--font-read);
		font-size: 20px;
	}

	.restored {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
		margin: -8px 0 22px;
		padding: 10px 12px 10px 14px;
		border-radius: 12px;
		border: 1px solid var(--surface-line);
		color: var(--surface-text);
		font: 14px var(--font-ui);
	}

	.restored > :global(svg) {
		color: var(--ink-moss);
	}

	.restored > span {
		flex: 1 1 220px;
	}

	.undo-error {
		display: block;
		color: var(--bb-coral-soft);
	}

	.undo,
	.dismiss {
		min-height: 32px;
		border: 1px solid var(--surface-line);
		border-radius: 9px;
		background: transparent;
		color: var(--surface-text);
		font: 600 13px var(--font-ui);
	}

	.undo {
		padding: 0 12px;
	}

	.dismiss {
		display: grid;
		place-items: center;
		width: 32px;
		border-color: transparent;
		color: var(--surface-muted);
	}

	.undo:hover,
	.dismiss:hover {
		border-color: var(--bb-sky);
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

		.surface :global(.surface-editor > .area > .rich-area) {
			min-height: 400px;
			font-size: 18px;
		}

		.surface :global(.surface-editor > .bar) {
			margin: -6px -8px 18px;
			padding: 6px 8px;
		}
	}
</style>
