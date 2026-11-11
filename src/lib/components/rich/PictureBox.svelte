<script lang="ts">
	import { tick } from 'svelte';
	// Types only from Tiptap: this is part of the page, and Tiptap loads later (see RichEditor).
	import type { Editor } from '@tiptap/core';
	import type { Node as DocNode } from '@tiptap/pm/model';
	import type { Transaction } from '@tiptap/pm/state';
	import { DESCRIPTION_LIMIT } from '$lib/art';
	import { PICTURE_SIZES, type Picture } from '$lib/rich';
	import { artStore } from '$lib/stores';
	import Icon from '$lib/components/ui/Icon.svelte';
	import RichEditor from './RichEditor.svelte';

	// A picture's settings: how big it's set, its caption, and what it shows for someone who can't
	// see it. It opens when the writer puts a picture in, clicks one or arrows onto one, and every
	// change goes straight into the story's document, so the story saves it.
	//
	// Like the footnote's box it's a popover in the top layer, mounted inside the editor: focus mode
	// is a modal dialog, and everything outside that goes inert.
	let {
		editor,
		onreplace
	}: {
		editor: Editor | null;
		/** Choose another picture from the shelf for the one at `at`. */
		onreplace: (at: number) => void;
	} = $props();

	let panel = $state<HTMLElement>();
	let captionEditor = $state<RichEditor>();
	/** Where the picture being shown starts in the story's document. */
	let at = $state<number | null>(null);
	let picture = $state<Picture | null>(null);
	/** A new caption editor for each picture opened, so one's undo history isn't another's. */
	let opened = $state(0);
	/** The caret goes into the caption as soon as its editor is ready. */
	let writing = $state(false);
	const uid = $props.id();

	const shelf = $derived(
		picture ? ($artStore.find((item) => item.id === picture?.art) ?? null) : null
	);

	function pictureAt(doc: DocNode, start: number) {
		const node = start >= 0 && start < doc.content.size ? doc.nodeAt(start) : null;
		return node?.type.name === 'picture' ? node : null;
	}

	/** Show the picture at `start`; with `edit`, put the caret in its caption. */
	export async function open(start: number, edit: boolean) {
		if (!editor) return;
		const node = pictureAt(editor.state.doc, start);
		if (!node) return;
		if (at !== start) {
			if (at !== null) finish(false);
			at = start;
			picture = { ...(node.attrs as Picture) };
			writing = edit;
			opened++;
		}
		if (panel && !panel.matches(':popover-open')) panel.showPopover();
		await tick();
		place();
		if (edit) {
			// A caption editor still loading takes the caret when it's ready.
			writing = true;
			captionEditor?.focus();
		}
	}

	/** Hand over what's been typed in the caption, before the story is saved. */
	export function flush() {
		captionEditor?.flush();
	}

	/** The story's selection has moved off the picture. Working in the box isn't leaving it. */
	export function leave() {
		if (at === null || panel?.contains(document.activeElement)) return;
		finish(false);
	}

	/** Keep up with the story's document as it changes around the picture, and its selection. */
	export function track(transaction: Transaction) {
		if (at === null || !editor) return;
		if (transaction.docChanged) {
			at = transaction.mapping.map(at, 1);
			const node = pictureAt(editor.state.doc, at);
			if (!node) return close();
			picture = { ...(node.attrs as Picture) };
			requestAnimationFrame(place);
		}
		// The writer has gone back to the text somewhere else.
		const selection = editor.state.selection as { from: number; node?: DocNode };
		const on = selection.node?.type.name === 'picture' && selection.from === at;
		if (transaction.selectionSet && !on) queueMicrotask(leave);
	}

	function set<K extends keyof Picture>(key: K, value: Picture[K]) {
		if (!editor || editor.isDestroyed || at === null || !pictureAt(editor.state.doc, at)) return;
		editor.view.dispatch(editor.state.tr.setNodeAttribute(at, key, value));
	}

	/** Put the box away; with `returning`, the caret goes back to the text after the picture. */
	function finish(returning: boolean) {
		captionEditor?.flush();
		const start = at;
		close();
		if (!returning || !editor || editor.isDestroyed || start === null) return;
		editor.chain().caretAfterPicture(start).focus().run();
	}

	function close() {
		at = null;
		if (panel?.matches(':popover-open')) panel.hidePopover();
	}

	function remove() {
		const start = at;
		close();
		if (!editor || editor.isDestroyed || start === null || !pictureAt(editor.state.doc, start)) {
			return;
		}
		editor
			.chain()
			.focus()
			.deleteRange({ from: start, to: start + 1 })
			.run();
	}

	function replace() {
		if (at === null) return;
		const start = at;
		captionEditor?.flush();
		close();
		onreplace(start);
	}

	function place() {
		if (!panel || !editor || at === null) return;
		const element = editor.view.nodeDOM(at);
		if (!(element instanceof HTMLElement)) return;
		const gap = 10;
		const rect = (element.querySelector('figure') ?? element).getBoundingClientRect();
		const box = panel.getBoundingClientRect();
		// The keyboard on a phone shrinks the visual viewport, not the window.
		const height = window.visualViewport?.height ?? innerHeight;
		const below = rect.bottom + gap;
		const above = rect.top - gap - box.height;
		// Under the picture, or over it, or at the foot of the screen when it's taller than that.
		const top =
			below + box.height <= height - gap
				? below
				: above >= gap
					? above
					: Math.max(gap, height - gap - box.height);
		panel.style.top = `${top}px`;
		const left = rect.left + rect.width / 2 - box.width / 2;
		panel.style.left = `${Math.max(gap, Math.min(left, innerWidth - box.width - gap))}px`;
	}

	/** Esc anywhere in the box is Done. A menu from the caption's toolbar closes itself first. */
	function escape(event: KeyboardEvent) {
		if (event.key !== 'Escape' || event.defaultPrevented) return;
		if ((event.target as HTMLElement).closest('[popover]') !== panel) return;
		event.preventDefault();
		finish(true);
	}

	// While it's open it follows its picture: the page scrolls, the window changes, the box grows.
	$effect(() => {
		if (at === null || !panel) return;
		const box = panel;
		const follow = () => requestAnimationFrame(place);
		const observer = new ResizeObserver(follow);
		observer.observe(box);
		box.addEventListener('keydown', escape);
		addEventListener('scroll', follow, true);
		addEventListener('resize', follow);
		window.visualViewport?.addEventListener('resize', follow);
		return () => {
			observer.disconnect();
			box.removeEventListener('keydown', escape);
			removeEventListener('scroll', follow, true);
			removeEventListener('resize', follow);
			window.visualViewport?.removeEventListener('resize', follow);
		};
	});
</script>

<div
	bind:this={panel}
	class="box"
	popover="manual"
	role="group"
	aria-labelledby="{uid}-title"
	data-picture-box
>
	{#if at !== null && picture}
		{@const current = picture}
		<div class="head">
			<p class="overline" id="{uid}-title">
				Picture{#if shelf?.title}<span class="name">&nbsp;·&nbsp;{shelf.title}</span>{/if}
			</p>
			<button
				type="button"
				class="icon"
				aria-label="Done"
				title="Done (Esc)"
				onclick={() => finish(true)}><Icon name="x" size={16} /></button
			>
		</div>

		{#if !shelf}
			<p class="gone" role="status">
				<Icon name="alert-circle" size={15} />This picture was taken off your art shelf, so readers
				see nothing here. Choose another, or take it out.
			</p>
		{/if}

		<div class="sizes" role="group" aria-label="How big">
			{#each PICTURE_SIZES as size (size.id)}
				<button
					type="button"
					aria-pressed={current.size === size.id}
					title={size.hint}
					onclick={() => set('size', size.id)}>{size.label}</button
				>
			{/each}
		</div>
		<p class="hint">{PICTURE_SIZES.find((size) => size.id === current.size)?.hint}</p>

		<div class="field">
			<span class="label" id="{uid}-caption">Caption</span>
			{#key opened}
				<RichEditor
					bind:this={captionEditor}
					value={current.caption}
					kind="description"
					label="Caption"
					placeholder="Under the picture, if you want one"
					boxed
					autofocus={writing}
					onchange={(value) => set('caption', value)}
					onescape={() => finish(true)}
				/>
			{/key}
		</div>

		<label class="field">
			<span class="label">What it shows</span>
			<textarea
				rows="2"
				maxlength={DESCRIPTION_LIMIT}
				placeholder="For someone who can’t see it"
				disabled={current.decorative}
				value={current.alt}
				oninput={(event) => set('alt', event.currentTarget.value)}></textarea>
		</label>
		<label class="check">
			<input
				type="checkbox"
				checked={current.decorative}
				onchange={(event) => set('decorative', event.currentTarget.checked)}
			/>
			<span>Only decoration: screen readers pass over it</span>
		</label>

		<div class="foot">
			<button type="button" class="quiet" onclick={replace}>
				<Icon name="image" size={15} />Change picture
			</button>
			<button type="button" class="quiet remove" onclick={remove}>
				<Icon name="trash" size={15} />Remove
			</button>
		</div>
	{/if}
</div>

<style>
	.box {
		position: fixed;
		inset: auto;
		width: min(400px, calc(100vw - 16px));
		max-height: min(560px, calc(100dvh - 20px));
		margin: 0;
		padding: 12px 14px 10px;
		overflow: auto;
		border: 1px solid var(--bb-line-control);
		border-radius: 16px;
		background: var(--bb-ink);
		color: var(--bb-text);
		box-shadow: 0 24px 48px -20px var(--bb-drop);
		font-family: var(--font-ui);
		font-size: 14.5px;
		font-style: normal;
		font-weight: 400;
		line-height: 1.45;
		text-indent: 0;
		text-align: left;
		letter-spacing: normal;
	}

	/* Open with content only: an empty popover would flash a box. */
	.box:popover-open {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin: -4px -6px -4px 0;
	}

	.overline {
		min-width: 0;
		overflow: hidden;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-overflow: ellipsis;
		text-transform: uppercase;
		white-space: nowrap;
		color: var(--bb-sky);
	}

	.overline .name {
		color: var(--bb-text-3);
		letter-spacing: 0.08em;
	}

	.icon {
		display: grid;
		flex: none;
		place-items: center;
		width: 36px;
		height: 36px;
		border: none;
		border-radius: 9px;
		background: transparent;
		color: var(--bb-text-label);
	}

	.icon:hover {
		background: var(--bb-raised);
		color: var(--bb-text-strong);
	}

	.gone {
		display: flex;
		gap: 8px;
		padding: 8px 10px;
		border-radius: 10px;
		background: var(--bb-amber-wash);
		color: var(--bb-text);
		font-size: 13.5px;
	}

	.gone :global(svg) {
		flex: none;
		margin-top: 2px;
		color: var(--bb-amber);
	}

	.sizes {
		display: flex;
		gap: 4px;
	}

	.sizes button {
		flex: 1;
		min-height: 40px;
		padding: 0 8px;
		border: 1px solid var(--bb-line-soft);
		border-radius: 9px;
		background: transparent;
		color: var(--bb-text-label);
		font: 600 13.5px var(--font-ui);
	}

	.sizes button:hover {
		border-color: var(--bb-line-control);
		color: var(--bb-text-strong);
	}

	.sizes button[aria-pressed='true'] {
		border-color: var(--bb-sky);
		background: var(--bb-sky-wash);
		color: var(--bb-sky-text);
	}

	.hint {
		margin-top: -4px;
		font-size: 12.5px;
		color: var(--bb-text-3);
	}

	.field {
		display: grid;
		gap: 5px;
	}

	.label {
		font-size: 12.5px;
		font-weight: 700;
		color: var(--bb-text-label);
	}

	/* The caption is set in the book's face, in italic, as readers will see it. */
	.field :global(.rich-area) {
		max-height: 140px;
		overflow-y: auto;
		font-family: var(--font-read);
		font-size: 16px;
		font-style: italic;
		line-height: 1.5;
	}

	textarea {
		width: 100%;
		min-height: 60px;
		padding: 9px 12px;
		border: 1px solid var(--bb-line-control);
		border-radius: var(--r-control);
		background: var(--bb-night);
		color: var(--bb-text);
		font: 15px / 1.45 var(--font-ui);
		resize: vertical;
	}

	textarea:focus {
		border-color: var(--bb-sky);
		outline: none;
		box-shadow: var(--focus-ring);
	}

	textarea:disabled {
		opacity: 0.5;
	}

	.check {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		font-size: 13.5px;
		color: var(--bb-text-2);
		cursor: pointer;
	}

	.check input {
		width: 18px;
		height: 18px;
		margin: 1px 0 0;
		accent-color: var(--bb-royal);
	}

	.foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin: 0 -6px 0 -6px;
	}

	.quiet {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 40px;
		padding: 0 10px;
		border: none;
		border-radius: 9px;
		background: transparent;
		color: var(--bb-text-label);
		font: 600 13px var(--font-ui);
	}

	.quiet:hover {
		background: var(--bb-raised);
		color: var(--bb-text-strong);
	}

	.quiet.remove:hover {
		color: var(--bb-coral-soft);
	}
</style>
