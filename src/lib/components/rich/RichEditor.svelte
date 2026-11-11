<script lang="ts">
	import { onMount, untrack } from 'svelte';
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
	import { get } from 'svelte/store';
	import type { ArtPicture } from '$lib/art';
	import { uploadFile } from '$lib/art-shelf';
	import { artUploadsOpen } from '$lib/stores';
	import ShelfPicker from '$lib/components/studio/ShelfPicker.svelte';
	import Toolbar from './Toolbar.svelte';
	import MentionMenu from './MentionMenu.svelte';
	import MentionCard from './MentionCard.svelte';
	import FootnoteBox from './FootnoteBox.svelte';
	import PictureBox from './PictureBox.svelte';
	import SlashMenu from './SlashMenu.svelte';

	// The rich text editor (Tiptap): a toolbar over a WYSIWYG area set like reading mode. Changes
	// reach `onchange` as a stored value (see $lib/rich), a moment after typing stops and at once
	// on blur or flush(). Given a `bookId`, typing @ links the story bible (see ./mention.ts), and
	// the bible's names link themselves wherever they're written (see ./auto-mention.ts). Story
	// text can hold footnotes, whose notes open in FootnoteBox (see ./footnote.ts), and pictures
	// from the art shelf, whose settings open in PictureBox (see ./picture.ts). Typing / on an
	// empty line lists what can be put in, as the toolbar's Insert menu does (see ./slash.ts).
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
		bookId,
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
		/** The book this story text belongs to: turns on @ mentions and links its bible's names. */
		bookId?: number;
		/** After every change of text or selection (focus mode's typewriter). */
		ontransaction?: (editor: Editor, transaction: Transaction) => void;
		class?: string;
		onescape?: () => void;
		onblur?: () => void;
	} = $props();

	let host = $state<HTMLDivElement>();
	let editor = $state.raw<Editor | null>(null);
	let version = $state(0);
	let mentionMenu = $state<MentionMenu>();
	let mentionCard = $state<MentionCard>();
	let footnoteBox = $state<FootnoteBox>();
	let pictureBox = $state<PictureBox>();
	let slashMenu = $state<SlashMenu>();
	/** The shelf is open to choose a picture: to put in, or in place of the one at `replacing`. */
	let choosing = $state<{ replacing: number | null } | null>(null);
	/** A sentence about pictures for the writer: one couldn't come in, or one is uploading. */
	let notice = $state('');
	let noticePanel = $state<HTMLElement>();
	let noticeTimer: ReturnType<typeof setTimeout> | undefined;
	let pending = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	// The value this editor last produced or was given: a different `value` is an outside change.
	// svelte-ignore state_referenced_locally
	let known = value;

	/** Hand over the latest text now (before saving, leaving, submitting). */
	export function flush() {
		// A note or a caption being written is part of the story: it goes in first.
		footnoteBox?.flush();
		pictureBox?.flush();
		clearTimeout(timer);
		if (!pending || !editor) return;
		pending = false;
		known = serialize(editor.getJSON(), kind);
		onchange(known);
	}

	export function focus() {
		editor?.commands.focus('end');
	}

	/**
	 * What the editor holds for a value. Nothing at all is one empty paragraph: somewhere for the
	 * caret and the placeholder, even before the field is focused.
	 */
	function contentOf(next: string) {
		const doc = parse(next, kind);
		return doc.content?.length ? doc : { ...doc, content: [{ type: 'paragraph' }] };
	}

	// A new value from outside (loaded, reset after cancel) replaces the content.
	$effect(() => {
		const next = value;
		if (editor && next !== known && !pending) {
			known = next;
			editor.commands.setContent(contentOf(next), { emitUpdate: false });
		}
	});

	const story = $derived(kind === 'story');

	/** Say something about pictures for a few seconds, over focus mode too. */
	function tell(message: string, lasting = 7000) {
		notice = message;
		clearTimeout(noticeTimer);
		if (noticePanel && !noticePanel.matches(':popover-open')) noticePanel.showPopover();
		if (lasting) noticeTimer = setTimeout(() => tell(''), lasting);
		if (!message && noticePanel?.matches(':popover-open')) noticePanel.hidePopover();
	}

	/** What a shelf picture is as it's first set in the text: wide, described as on the shelf. */
	const asPicture = (picture: ArtPicture) => ({
		art: picture.id,
		width: picture.width,
		height: picture.height,
		size: 'wide' as const,
		alt: picture.description,
		decorative: false,
		caption: ''
	});

	function chosen(picture: ArtPicture) {
		const replacing = choosing?.replacing ?? null;
		choosing = null;
		if (!editor || editor.isDestroyed) return;
		if (replacing === null) {
			editor.chain().focus().insertPicture(asPicture(picture)).run();
			return;
		}
		const node = editor.state.doc.nodeAt(replacing);
		if (node?.type.name !== 'picture') return;
		// The new picture keeps how it's set and its caption; a description goes with the picture.
		editor
			.chain()
			.focus()
			.command(({ tr }) => {
				tr.setNodeMarkup(replacing, undefined, {
					...node.attrs,
					art: picture.id,
					width: picture.width,
					height: picture.height,
					alt: picture.description || String(node.attrs.alt ?? '')
				});
				return true;
			})
			.setNodeSelection(replacing)
			.run();
	}

	/** Picture files dropped or pasted in: each up to the shelf, then into the text in order. */
	async function uploadInto(files: File[], at: number) {
		if (!get(artUploadsOpen)) {
			tell('Uploading pictures isn’t available on this site yet.');
			return;
		}
		let place = at;
		for (const [index, file] of files.entries()) {
			tell(files.length > 1 ? `Uploading ${index + 1} of ${files.length}…` : 'Uploading…', 0);
			try {
				const picture = await uploadFile(file);
				if (!editor || editor.isDestroyed) return;
				editor.chain().focus().insertPicture(asPicture(picture), place).run();
				// The next goes after this one: the selection is on the picture just put in.
				place = editor.state.selection.from + 1;
			} catch (problem) {
				tell(problem instanceof Error ? problem.message : 'Couldn’t upload the picture.');
				return;
			}
		}
		tell('');
	}

	onMount(() => {
		let instance: Editor | null = null;
		let cancelled = false;

		// Loaded here, in the browser only: pages without an editor never download it.
		Promise.all([import('@tiptap/core'), import('./extensions')]).then(
			([{ Editor }, { extensionsFor, cleanPastedHTML }]) => {
				if (cancelled || !host) return;
				instance = new Editor({
					element: host,
					extensions: extensionsFor(kind, placeholder, {
						onescape,
						mentions:
							bookId === undefined
								? undefined
								: {
										bookId,
										open: (props) => mentionMenu?.open(props),
										keydown: (event) => mentionMenu?.keydown(event) ?? false,
										close: () => mentionMenu?.close()
									},
						...(story && {
							footnotes: {
								open: (at, edit) => footnoteBox?.open(at, edit),
								leave: () => footnoteBox?.leave()
							},
							pictures: {
								open: (at, edit) => pictureBox?.open(at, edit),
								leave: () => pictureBox?.leave(),
								choose: () => (choosing = { replacing: null }),
								upload: (files, at) => void uploadInto(files, at),
								refuse: (message) => tell(message)
							},
							slash: {
								open: (props) => slashMenu?.open(props),
								keydown: (event) => slashMenu?.keydown(event) ?? false,
								close: () => slashMenu?.close()
							}
						})
					}),
					content: contentOf(value),
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
						// Can arrive in the middle of an update: taking away the focused editor blurs it.
						untrack(() => version++);
						footnoteBox?.track(transaction);
						pictureBox?.track(transaction);
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

		// The writer's card for a mention: on hover, or on a tap where there's no hover.
		const area = host;
		// A mention made with @, or a name from the story bible linked where it's written.
		const mentionAt = (event: Event) =>
			(event.target as HTMLElement | null)?.closest?.<HTMLElement>(
				'[data-type="mention"], [data-auto-mention]'
			);
		const over = (event: MouseEvent) => {
			const mention = mentionAt(event);
			if (mention && !event.buttons) mentionCard?.show(mention);
		};
		const out = (event: MouseEvent) => {
			if (mentionAt(event)) mentionCard?.leave();
		};
		const click = (event: MouseEvent) => {
			const mention = mentionAt(event);
			if (mention) mentionCard?.show(mention, true);
		};
		const typing = () => mentionCard?.hide();
		area?.addEventListener('mouseover', over);
		area?.addEventListener('mouseout', out);
		area?.addEventListener('click', click);
		area?.addEventListener('keydown', typing);

		return () => {
			area?.removeEventListener('mouseover', over);
			area?.removeEventListener('mouseout', out);
			area?.removeEventListener('click', click);
			area?.removeEventListener('keydown', typing);
			cancelled = true;
			flush();
			instance?.destroy();
		};
	});
</script>

<div class={['rich-editor', kind, { boxed }, className]}>
	{#if editor && toolbar}
		<div class="bar">
			<Toolbar {editor} {version} {kind} mentions={bookId !== undefined} />
		</div>
	{/if}
	<div class="area" bind:this={host}></div>
	{#if bookId !== undefined}
		<MentionMenu bind:this={mentionMenu} {bookId} />
	{/if}
	{#if story}
		<MentionCard bind:this={mentionCard} />
		<FootnoteBox bind:this={footnoteBox} {editor} />
		<PictureBox
			bind:this={pictureBox}
			{editor}
			onreplace={(at) => (choosing = { replacing: at })}
		/>
		<SlashMenu bind:this={slashMenu} />
		<div bind:this={noticePanel} class="notice" popover="manual" role="status">{notice}</div>
		{#if choosing}
			<ShelfPicker
				title={choosing.replacing === null ? 'Put a picture in the text' : 'Choose another picture'}
				note="From your art shelf. It stays on the shelf too, so a picture can go in more than one place."
				upload
				onchoose={chosen}
				onclose={() => {
					choosing = null;
					editor?.commands.focus();
				}}
			/>
		{/if}
	{/if}
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

	/* The caret between two blocks that can't hold one (after a picture, before a scene break),
	   where typing starts a paragraph. ProseMirror draws it black, which night would hide. */
	.area :global(.ProseMirror-gapcursor::after) {
		top: 0;
		width: 24px;
		border-top: 2px solid var(--surface-caret, var(--focus-caret, currentColor));
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

	/* A picture as the writer sees it (./picture.ts): as on the page, and a click away from its
	   settings. One taken off the shelf is a box saying so, until the writer takes it out. */
	.area :global(.bb-picture-node) {
		position: relative;
		cursor: pointer;
	}

	.area :global(.bb-picture-node img) {
		transition: outline-color 0.12s;
		outline: 3px solid transparent;
		outline-offset: 4px;
	}

	.area :global(.bb-picture-node:hover img) {
		outline-color: var(--bb-line-control);
	}

	.area :global(.bb-picture-node.ProseMirror-selectednode img),
	.area :global(.bb-picture-node.ProseMirror-selectednode .bb-picture-gone) {
		outline: 3px solid var(--bb-sky);
		outline-offset: 4px;
	}

	.area :global(.bb-picture-node.is-gone img),
	.area :global(.bb-picture-node:not(.is-gone) .bb-picture-gone) {
		display: none;
	}

	.area :global(.bb-picture-gone) {
		display: grid;
		place-items: center;
		align-content: center;
		gap: 10px;
		width: min(100%, 420px);
		min-height: 130px;
		margin: 0 auto;
		padding: 18px;
		border: 1.5px dashed var(--bb-line-control);
		border-radius: 12px;
		font-family: var(--font-ui);
		font-size: 14px;
		font-style: normal;
		line-height: 1.45;
		text-align: center;
		color: var(--bb-text-2);
	}

	.area :global(.bb-picture-gone button) {
		min-height: 36px;
		padding: 0 14px;
		border: 1px solid var(--bb-line-control);
		border-radius: 9px;
		background: transparent;
		color: var(--bb-text-strong);
		font: 600 13px var(--font-ui);
	}

	.area :global(.bb-picture-gone button:hover) {
		border-color: var(--bb-coral-soft);
		color: var(--bb-coral-soft);
	}

	.area :global(.bb-picture-tags) {
		display: flex;
		justify-content: center;
		gap: 6px;
		margin: -0.8em 0 1.2em;
		text-indent: 0;
	}

	.area :global(.bb-picture-tags span) {
		padding: 2px 9px;
		border-radius: var(--r-pill);
		background: var(--bb-raised);
		color: var(--bb-text-3);
		font: 600 11.5px / 1.5 var(--font-ui);
		font-style: normal;
	}

	.area :global(.bb-picture-tags span.warn) {
		background: var(--bb-amber-wash);
		color: var(--bb-text);
	}

	/* The / that opened the Insert list. */
	.area :global(.bb-slash-typing) {
		color: var(--bb-sky);
	}

	/* What couldn't come in, or what's uploading: at the foot of the screen, over focus mode too. */
	.notice {
		position: fixed;
		inset: auto auto 24px 50%;
		max-width: min(520px, calc(100vw - 32px));
		margin: 0;
		padding: 12px 18px;
		border: 1px solid var(--bb-line-control);
		border-radius: 14px;
		background: var(--bb-ink);
		color: var(--bb-text);
		box-shadow: 0 24px 48px -20px var(--bb-drop);
		font: 14.5px / 1.45 var(--font-ui);
		transform: translateX(-50%);
	}

	.notice:empty {
		display: none;
	}
</style>
