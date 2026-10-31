<script lang="ts">
	import { onMount } from 'svelte';
	import type { Editor } from '@tiptap/core';
	import type { Transaction } from '@tiptap/pm/state';
	import type { StoryTextDoc } from '$lib/story-text.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import RichEditor from '$lib/components/rich/RichEditor.svelte';
	import Menu from '$lib/components/rich/Menu.svelte';
	import SaveStatus from './SaveStatus.svelte';

	// Focus mode: the story text alone on a full-screen page (Night or Paper, as on the writing
	// surface). The line being written stays at eye level (typewriter), the other paragraphs can
	// dim, a session timer counts up or runs a sprint, and the text saves itself a moment after
	// typing stops. Esc leaves.
	let {
		doc,
		title,
		paper,
		onexit
	}: { doc: StoryTextDoc; title: string; paper: boolean; onexit: () => void } = $props();

	let dialog = $state<HTMLDialogElement>();
	let page = $state<HTMLElement>();
	let editor = $state<RichEditor>();

	/** Hand over typing the editor hasn't reported yet (before saving or leaving). */
	export function flush() {
		editor?.flush();
	}

	// ---- Settings, remembered per browser ----------------------------------------------------
	const PREFS = 'bb-focus';
	let typewriter = $state(true);
	let dim = $state(false);
	let toolbar = $state(false);
	let prefsLoaded = false;

	$effect(() => {
		const prefs = JSON.stringify({ typewriter, dim, toolbar });
		if (!prefsLoaded) return;
		try {
			localStorage.setItem(PREFS, prefs);
		} catch {
			// storage unavailable: settings last for this visit
		}
	});

	// ---- The session -------------------------------------------------------------------------
	// svelte-ignore state_referenced_locally
	const startWords = doc.words;
	const startedAt = Date.now();
	let now = $state(Date.now());
	let sprint = $state<{ minutes: number; endsAt: number } | null>(null);

	const sessionWords = $derived(doc.words - startWords);
	const elapsed = $derived(Math.floor((now - startedAt) / 1000));
	const remaining = $derived(sprint ? Math.max(0, Math.ceil((sprint.endsAt - now) / 1000)) : null);
	const sprintDone = $derived(remaining === 0);

	function clock(seconds: number) {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = String(seconds % 60).padStart(2, '0');
		return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
	}

	const startSprint = (minutes: number) =>
		(sprint = { minutes, endsAt: Date.now() + minutes * 60_000 });

	// ---- Typewriter: the line being written stays at the same height --------------------------
	// Only while writing (the text changed, nothing selected): selecting, clicking and copying
	// leave the page where it is.
	function follow(instance: Editor, transaction: Transaction) {
		if (!typewriter || !page || !instance.isFocused) return;
		if (!transaction.docChanged || !instance.state.selection.empty) return;
		let top: number;
		try {
			top = instance.view.coordsAtPos(instance.state.selection.head).top;
		} catch {
			return;
		}
		const box = page.getBoundingClientRect();
		const delta = top - (box.top + box.height * 0.42);
		if (Math.abs(delta) > 1) page.scrollTop += delta;
	}

	// ---- Autosave: a moment after typing stops; once per change, so a failure doesn't loop ------
	let attempted = '';
	$effect(() => {
		const content = doc.content;
		if (!doc.dirty || content === attempted) return;
		const timer = setTimeout(() => {
			attempted = content;
			doc.save();
		}, 2500);
		return () => clearTimeout(timer);
	});

	onMount(() => {
		try {
			const prefs = JSON.parse(localStorage.getItem(PREFS) ?? 'null');
			if (typeof prefs?.typewriter === 'boolean') typewriter = prefs.typewriter;
			if (typeof prefs?.dim === 'boolean') dim = prefs.dim;
			if (typeof prefs?.toolbar === 'boolean') toolbar = prefs.toolbar;
		} catch {
			// storage unavailable: defaults
		}
		prefsLoaded = true;

		// A modal dialog makes the rest of the page inert; full screen where the browser allows it
		// (Esc then leaves full screen, and focus mode with it).
		dialog?.showModal();
		let full = false;
		dialog?.requestFullscreen?.({ navigationUI: 'hide' }).then(
			() => (full = true),
			() => {}
		);
		const onfullscreen = () => {
			if (full && !document.fullscreenElement) onexit();
		};
		document.addEventListener('fullscreenchange', onfullscreen);

		const tick = setInterval(() => (now = Date.now()), 1000);
		return () => {
			clearInterval(tick);
			document.removeEventListener('fullscreenchange', onfullscreen);
			if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
		};
	});
</script>

<dialog
	bind:this={dialog}
	class={['focus', { paper }]}
	data-scheme={paper ? 'light' : 'dark'}
	aria-label="Focus mode: {title}"
	oncancel={(event) => {
		event.preventDefault();
		onexit();
	}}
>
	<header class="bar">
		<button type="button" class="tool leave" onclick={onexit}>
			<Icon name="arrow-left" size={16} />Leave<kbd>Esc</kbd>
		</button>
		<p class="title">{title}</p>
		<p class="stats">
			<span>{doc.words.toLocaleString('en')} words</span>
			<span class={['session', { up: sessionWords > 0 }]}
				>{sessionWords >= 0 ? '+' : '−'}{Math.abs(sessionWords).toLocaleString('en')} this session</span
			>
		</p>
		<button
			type="button"
			class={['tool', 'timer', { done: sprintDone }]}
			popovertarget="focus-timer"
			title="Session timer"
		>
			<Icon name="clock" size={16} />
			{#if remaining !== null}
				{sprintDone ? 'Time!' : clock(remaining)}
			{:else}
				{clock(elapsed)}
			{/if}
		</button>
		<Menu id="focus-timer" label="Session timer" width={220}>
			{#snippet children(close)}
				<p class="menu-label">Timer</p>
				<div class="timer-options">
					<button
						type="button"
						aria-pressed={!sprint}
						onclick={() => {
							sprint = null;
							close();
						}}>Session time</button
					>
					{#each [15, 25, 45, 60] as minutes (minutes)}
						<button
							type="button"
							aria-pressed={sprint?.minutes === minutes}
							onclick={() => {
								startSprint(minutes);
								close();
							}}>{minutes} minute sprint</button
						>
					{/each}
				</div>
			{/snippet}
		</Menu>
		<div class="toggles" role="group" aria-label="Focus settings">
			<button type="button" aria-pressed={typewriter} onclick={() => (typewriter = !typewriter)}
				>Typewriter</button
			>
			<button type="button" aria-pressed={dim} onclick={() => (dim = !dim)}>Dim</button>
			<button type="button" aria-pressed={toolbar} onclick={() => (toolbar = !toolbar)}
				>Toolbar</button
			>
		</div>
		<SaveStatus {doc} />
	</header>

	<div class={['page', { typewriter, dim }]} bind:this={page}>
		<div class="column">
			<RichEditor
				bind:this={editor}
				id="story"
				class="focus-editor"
				value={doc.content}
				onchange={(value) => (doc.content = value)}
				label="Story text"
				placeholder="Write…"
				autofocus
				{toolbar}
				ontransaction={follow}
				onescape={onexit}
			/>
		</div>
	</div>

	<p class="sr-only" aria-live="polite">
		{sprintDone ? `Time's up: ${sessionWords} words this session.` : ''}
	</p>
</dialog>

<style>
	.focus {
		--focus-bg: var(--bb-night);
		--focus-text: var(--bb-text-read);
		--focus-caret: var(--bb-sky);
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		max-width: none;
		max-height: none;
		margin: 0;
		padding: 0;
		border: none;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: var(--focus-bg);
		color: var(--focus-text);
	}

	.focus.paper {
		--focus-bg: var(--bb-paper);
		--focus-text: var(--bb-paper-ink);
		--focus-caret: var(--bb-royal);
	}

	.focus::backdrop {
		background: var(--bb-night);
	}

	.focus:focus-visible {
		outline: none;
	}

	/* The bar */
	.bar {
		flex: none;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 14px;
		padding: 10px 18px;
		font-family: var(--font-ui);
		color: var(--bb-text-2);
	}

	.tool {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 40px;
		padding: 0 12px;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: var(--bb-text-label);
		font: 600 14px var(--font-ui);
	}

	.tool:hover {
		background: var(--bb-line-faint);
	}

	kbd {
		padding: 1px 6px;
		border: 1px solid var(--bb-line-control);
		border-radius: 5px;
		font: 600 11px var(--font-ui);
		color: var(--bb-text-3);
	}

	.title {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-display);
		font-size: 17px;
		color: var(--bb-text);
	}

	.stats {
		display: flex;
		gap: 12px;
		font-size: 13.5px;
	}

	.session.up {
		color: var(--bb-sky-text);
		font-weight: 600;
	}

	.timer {
		font-variant-numeric: tabular-nums;
	}

	.timer.done {
		background: var(--bb-sky-wash);
		color: var(--bb-sky-text);
	}

	.toggles {
		display: inline-flex;
		padding: 3px;
		border-radius: 10px;
		border: 1px solid var(--bb-line-soft);
	}

	.toggles button {
		min-height: 32px;
		padding: 0 10px;
		border: none;
		border-radius: 7px;
		background: transparent;
		color: var(--bb-text-3);
		font: 600 12.5px var(--font-ui);
	}

	.toggles button[aria-pressed='true'] {
		background: var(--bb-sky-wash);
		color: var(--bb-sky-text);
	}

	.menu-label {
		margin-bottom: 8px;
		font-size: 11.5px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--bb-text-3);
	}

	.timer-options {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.timer-options button {
		min-height: 38px;
		padding: 0 12px;
		border: 1px solid transparent;
		border-radius: 8px;
		background: transparent;
		color: var(--bb-text);
		font: 500 14px var(--font-ui);
		text-align: left;
	}

	.timer-options button:hover {
		background: var(--bb-hover);
	}

	.timer-options button[aria-pressed='true'] {
		border-color: var(--bb-sky);
		background: var(--bb-sky-wash);
		color: var(--bb-sky-text);
	}

	/* The page */
	.page {
		flex: 1;
		overflow-y: auto;
		scrollbar-width: thin;
	}

	.column {
		max-width: 700px;
		margin: 0 auto;
		padding: 6vh 24px 30vh;
	}

	/* Room above and below, so the first and last lines can sit at eye level too. */
	.typewriter .column {
		padding-top: 38vh;
		padding-bottom: 55vh;
	}

	.page :global(.focus-editor .rich-area) {
		min-height: 40vh;
		font-family: var(--font-read);
		font-size: 21px;
		color: var(--focus-text);
		caret-color: var(--focus-caret);
	}

	.page :global(.focus-editor > .bar) {
		position: sticky;
		top: 0;
		z-index: 2;
		margin-bottom: 24px;
		padding: 8px 0;
		background: var(--focus-bg);
		box-shadow: 0 1px 0 var(--bb-line-soft);
	}

	/* Dim: only the paragraph being written stays bright. */
	.dim :global(.rich-area > *) {
		transition: opacity 0.25s;
	}

	.dim :global(.rich-area.ProseMirror-focused > :not(.has-focus)) {
		opacity: 0.28;
	}

	@media (max-width: 760px) {
		.bar {
			padding: 8px 10px;
			gap: 6px 10px;
		}

		.stats,
		.leave kbd {
			display: none;
		}

		.column {
			padding-left: 18px;
			padding-right: 18px;
		}

		.page :global(.focus-editor .rich-area) {
			font-size: 19px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.dim :global(.rich-area > *) {
			transition: none;
		}
	}
</style>
