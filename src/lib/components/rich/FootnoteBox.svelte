<script lang="ts">
	import { tick } from 'svelte';
	// Types only from Tiptap: this is part of the page, and Tiptap loads later (see RichEditor).
	import type { Editor } from '@tiptap/core';
	import type { Node as DocNode } from '@tiptap/pm/model';
	import type { Transaction } from '@tiptap/pm/state';
	import { plainText } from '$lib/rich';
	import Icon from '$lib/components/ui/Icon.svelte';
	import RichEditor from './RichEditor.svelte';

	// The note of a footnote, by its number in the text. It opens when the writer adds a footnote,
	// clicks a number or arrows onto one, and the note is written here in a small editor of its own
	// (a description: inline formatting, no notes inside notes). Every change goes straight into
	// the story's document, so the story saves it. A note left empty takes its number with it.
	//
	// Like the mention menu it's a popover in the top layer, mounted inside the editor: focus mode
	// is a modal dialog, and everything outside that goes inert.
	let { editor }: { editor: Editor | null } = $props();

	let panel = $state<HTMLElement>();
	let noteEditor = $state<RichEditor>();
	/** Where the footnote being shown starts in the story's document. */
	let at = $state<number | null>(null);
	let note = $state('');
	let number = $state(0);
	/** A new editor for each footnote opened, so one note's undo history isn't another's. */
	let opened = $state(0);
	/** The caret goes into the note as soon as its editor is ready. */
	let writing = $state(false);

	const blank = (value: string) => !plainText(value, 'description').trim();

	/** The footnote at `start`, if there is one there. */
	function footnoteAt(doc: DocNode, start: number) {
		const node = start >= 0 && start < doc.content.size ? doc.nodeAt(start) : null;
		return node?.type.name === 'footnote' ? node : null;
	}

	/** Its number: one more than the footnotes before it. */
	function footnoteNumber(doc: DocNode, start: number) {
		let count = 0;
		doc.nodesBetween(0, Math.min(start + 1, doc.content.size), (node, position) => {
			if (node.type.name === 'footnote' && position <= start) count++;
		});
		return count;
	}

	/** Show the footnote at `start`; with `edit`, put the caret in its note. */
	export async function open(start: number, edit: boolean) {
		if (!editor) return;
		const node = footnoteAt(editor.state.doc, start);
		if (!node) return;
		if (at !== start) {
			if (at !== null) finish(false);
			at = start;
			note = String(node.attrs.note ?? '');
			writing = edit;
			opened++;
		}
		number = footnoteNumber(editor.state.doc, start);
		if (panel && !panel.matches(':popover-open')) panel.showPopover();
		await tick();
		place();
		if (edit) {
			// A note editor still loading takes the caret when it's ready.
			writing = true;
			noteEditor?.focus();
		}
	}

	/** Hand over what's been typed in the note, before the story is saved. */
	export function flush() {
		noteEditor?.flush();
	}

	/** The story's selection has moved off the number. Writing in the note isn't leaving it. */
	export function leave() {
		if (at === null || panel?.contains(document.activeElement)) return;
		finish(false);
	}

	/** Keep up with the story's document as it changes around the footnote, and its selection. */
	export function track(transaction: Transaction) {
		if (at === null || !editor) return;
		if (transaction.docChanged) {
			at = transaction.mapping.map(at, 1);
			if (!footnoteAt(editor.state.doc, at)) return close();
			requestAnimationFrame(place);
		}
		// The writer has gone back to the text somewhere else. (A selected number is a node
		// selection, which is the only kind with a `node`.)
		const selection = editor.state.selection as { from: number; node?: DocNode };
		const on = selection.node?.type.name === 'footnote' && selection.from === at;
		if (transaction.selectionSet && !on) queueMicrotask(leave);
	}

	/** Put the box away, taking out the footnote if its note is still empty. */
	function finish(returning: boolean) {
		noteEditor?.flush();
		const start = at;
		close();
		if (!editor || editor.isDestroyed || start === null || !footnoteAt(editor.state.doc, start)) {
			return;
		}
		if (blank(note)) {
			editor
				.chain()
				.deleteRange({ from: start, to: start + 1 })
				.run();
			if (returning) editor.commands.focus(start);
		} else if (returning) {
			// Back to the text just after the number, ready to carry on writing.
			editor
				.chain()
				.focus(start + 1)
				.run();
		}
	}

	function close() {
		at = null;
		if (panel?.matches(':popover-open')) panel.hidePopover();
	}

	function remove() {
		note = '';
		finish(true);
	}

	function write(value: string) {
		note = value;
		if (!editor || editor.isDestroyed || at === null || !footnoteAt(editor.state.doc, at)) return;
		editor.view.dispatch(editor.state.tr.setNodeAttribute(at, 'note', value));
	}

	function place() {
		if (!panel || !editor || at === null) return;
		const element = editor.view.nodeDOM(at);
		if (!(element instanceof HTMLElement)) return;
		const gap = 8;
		const rect = element.getBoundingClientRect();
		const box = panel.getBoundingClientRect();
		// The keyboard on a phone shrinks the visual viewport, not the window.
		const height = window.visualViewport?.height ?? innerHeight;
		const below = rect.bottom + gap;
		const fits = below + box.height <= height - gap;
		panel.style.top = `${fits ? below : Math.max(gap, rect.top - gap - box.height)}px`;
		panel.style.left = `${Math.max(gap, Math.min(rect.left - 24, innerWidth - box.width - gap))}px`;
	}

	// While it's open it follows its number: the page scrolls, the window changes, the note grows.
	$effect(() => {
		if (at === null || !panel) return;
		const follow = () => requestAnimationFrame(place);
		const observer = new ResizeObserver(follow);
		observer.observe(panel);
		addEventListener('scroll', follow, true);
		addEventListener('resize', follow);
		window.visualViewport?.addEventListener('resize', follow);
		return () => {
			observer.disconnect();
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
	aria-label={number ? `Footnote ${number}` : 'Footnote'}
	data-footnote-box
>
	{#if at !== null}
		<div class="head">
			<p class="overline">Note {number}</p>
			<button
				type="button"
				class="icon"
				aria-label="Done"
				title="Done (Esc)"
				onclick={() => finish(true)}><Icon name="x" size={16} /></button
			>
		</div>
		{#key opened}
			<RichEditor
				bind:this={noteEditor}
				value={note}
				kind="description"
				label="Note {number}"
				placeholder="Write the note…"
				boxed
				autofocus={writing}
				onchange={write}
				onescape={() => finish(true)}
			/>
		{/key}
		<div class="foot">
			<p class="hint">Enter or a click to write in it.</p>
			<button type="button" class="remove" onclick={remove}>
				<Icon name="trash" size={15} />Remove
			</button>
		</div>
	{/if}
</div>

<style>
	.box {
		position: fixed;
		inset: auto;
		width: min(380px, calc(100vw - 16px));
		max-height: min(420px, 70vh);
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
		gap: 8px;
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin: -4px -6px -2px 0;
	}

	.overline {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--bb-sky);
	}

	.icon {
		display: grid;
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

	/* The note is set in the book's face, as readers will see it. */
	.box :global(.rich-area) {
		font-family: var(--font-read);
		font-size: 16px;
		line-height: 1.5;
		max-height: 220px;
		overflow-y: auto;
	}

	.foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-right: -6px;
	}

	.hint {
		font-size: 12.5px;
		color: var(--bb-text-3);
	}

	/* Once the caret is in the note, there's nothing to explain. */
	.box:focus-within .hint {
		visibility: hidden;
	}

	.remove {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 36px;
		padding: 0 10px;
		border: none;
		border-radius: 9px;
		background: transparent;
		color: var(--bb-text-label);
		font: 600 13px var(--font-ui);
	}

	.remove:hover {
		background: var(--bb-raised);
		color: var(--bb-coral-soft);
	}
</style>
