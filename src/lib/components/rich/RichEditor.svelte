<script lang="ts">
	import { onMount } from 'svelte';
	import type { Editor } from '@tiptap/core';
	import type { Transaction } from '@tiptap/pm/state';
	import {
		DEFAULT_CAP,
		capPresentation,
		cleanCap,
		parse,
		serialize,
		type RichKind
	} from '$lib/rich';
	import Toolbar from './Toolbar.svelte';

	// The rich text editor (Tiptap): a toolbar over a WYSIWYG area set like reading mode. Changes
	// reach `onchange` as a stored value (see $lib/rich), a moment after typing stops and at once
	// on blur or flush().
	let {
		value,
		kind = 'story',
		onchange,
		label,
		id,
		placeholder = '',
		autofocus = false,
		delay = 300,
		boxed = false,
		italic = false,
		toolbar = true,
		ontransaction,
		class: className = '',
		onescape,
		onblur
	}: {
		value: string;
		kind?: RichKind;
		onchange: (value: string) => void;
		/** Accessible name of the text area. */
		label: string;
		id?: string;
		placeholder?: string;
		autofocus?: boolean;
		/** Milliseconds after the last change before `onchange`. */
		delay?: number;
		/** Drawn as a form field (a bordered box). */
		boxed?: boolean;
		/** Set in italic: emphasis inside it turns roman. */
		italic?: boolean;
		/** Show the formatting toolbar (keyboard shortcuts work either way). */
		toolbar?: boolean;
		/** After every change of text or selection (focus mode's typewriter). */
		ontransaction?: (editor: Editor, transaction: Transaction) => void;
		class?: string;
		onescape?: () => void;
		onblur?: () => void;
	} = $props();

	let host = $state<HTMLDivElement>();
	let editor = $state.raw<Editor | null>(null);
	let version = $state(0);
	let pending = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	// The value this editor last produced or was given: a different `value` is an outside change.
	// svelte-ignore state_referenced_locally
	let known = value;

	/** Hand over the latest text now (before saving, leaving, submitting). */
	export function flush() {
		clearTimeout(timer);
		if (!pending || !editor) return;
		pending = false;
		known = serialize(editor.getJSON(), kind);
		onchange(known);
	}

	export function focus() {
		editor?.commands.focus('end');
	}

	// A new value from outside (loaded, reset after cancel) replaces the content.
	$effect(() => {
		const next = value;
		if (editor && next !== known && !pending) {
			known = next;
			editor.commands.setContent(parse(next, kind), { emitUpdate: false });
		}
	});

	const story = $derived(kind === 'story');

	onMount(() => {
		let instance: Editor | null = null;
		let cancelled = false;

		// Loaded here, in the browser only: pages without an editor never download it.
		Promise.all([import('@tiptap/core'), import('./extensions')]).then(
			([{ Editor }, { extensionsFor, cleanPastedHTML }]) => {
				if (cancelled || !host) return;
				instance = new Editor({
					element: host,
					extensions: extensionsFor(kind, placeholder, onescape),
					content: parse(value, kind),
					autofocus: autofocus ? 'end' : false,
					editorProps: {
						attributes: (state) => {
							const cap = capPresentation(cleanCap(state.doc.attrs.dropCap) ?? DEFAULT_CAP);
							return {
								...(id && { id }),
								'aria-label': label,
								'aria-multiline': 'true',
								class: story
									? `bb-prose rich-area ${cap.class}`
									: `rich-area${italic ? ' rich-italic' : ''}`,
								...(story && { style: cap.style })
							};
						},
						transformPastedHTML: cleanPastedHTML
					},
					onTransaction: ({ editor, transaction }) => {
						version++;
						ontransaction?.(editor, transaction);
					},
					onUpdate: () => {
						pending = true;
						clearTimeout(timer);
						timer = setTimeout(flush, delay);
					},
					onBlur: () => {
						flush();
						onblur?.();
					}
				});
				editor = instance;
			}
		);

		return () => {
			cancelled = true;
			flush();
			instance?.destroy();
		};
	});
</script>

<div class={['rich-editor', kind, { boxed }, className]}>
	{#if editor && toolbar}
		<div class="bar">
			<Toolbar {editor} {version} {kind} />
		</div>
	{/if}
	<div class="area" bind:this={host}></div>
</div>

<style>
	.rich-editor {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.area {
		min-width: 0;
	}

	.area :global(.rich-area) {
		outline: none;
		white-space: pre-wrap;
	}

	/* The page itself is the writing area: no focus ring around it (boxed fields have their own). */
	.area :global(.rich-area:focus-visible) {
		outline: none;
		box-shadow: none;
	}

	.area :global(.rich-area p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		float: left;
		height: 0;
		color: var(--bb-text-4);
		font-style: italic;
		pointer-events: none;
	}

	/* The first letter waits until there is text. */
	.area :global(.rich-area p.is-editor-empty:first-child::first-letter) {
		all: unset;
	}

	.boxed .bar {
		margin-bottom: 6px;
	}

	.boxed .area :global(.rich-area) {
		min-height: 2.9em;
		padding: 10px 14px;
		border-radius: var(--r-control);
		border: 1px solid var(--bb-line-control);
		background: var(--bb-night);
	}

	.boxed .area :global(.rich-area:focus) {
		border-color: var(--bb-sky);
		box-shadow: var(--focus-ring);
	}

	.area :global(.rich-area hr.ProseMirror-selectednode) {
		outline: 2px solid var(--bb-sky);
		outline-offset: 6px;
	}
</style>
