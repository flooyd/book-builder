// Pictures in the editor (Tiptap): the node that sits between the story's blocks, how it's drawn,
// and how the writer reaches its settings. Browser only, like ./extensions. What a picture is, and
// how it's stored and cleaned, is in $lib/rich; its settings are in PictureBox.svelte, and the
// shelf it's chosen from is ShelfPicker.
//
// The node holds the picture's id on the art shelf, never an address: the editor finds the file
// on the writer's own shelf (artStore), as pages find it on the author's.
import { mergeAttributes, Node } from '@tiptap/core';
import type { Node as DocNode } from '@tiptap/pm/model';
import { GapCursor } from '@tiptap/pm/gapcursor';
import {
	NodeSelection,
	Plugin,
	PluginKey,
	Selection,
	TextSelection,
	type EditorState
} from '@tiptap/pm/state';
import { get } from 'svelte/store';
import { PICTURE_SIZES, pictureSizes, toHTML, type Picture } from '$lib/rich';
import { artStore, libraryStatus } from '$lib/stores';

/** How the editor talks to the picture's box and the shelf. Positions are where the node starts. */
export type PictureBridge = {
	/** Show the settings of the picture at `at`, with the caret in its caption when `edit` is true. */
	open: (at: number, edit: boolean) => void;
	/** The selection has left the picture that's showing. */
	leave: () => void;
	/** Choose a picture from the shelf to put in where the caret is. */
	choose: () => void;
	/** Picture files dropped or pasted into the text: upload them and put them in at `at`. */
	upload: (files: File[], at: number) => void;
	/** Something couldn't come in (a picture pasted from another site): say why. */
	refuse: (message: string) => void;
};

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		picture: {
			/**
			 * A picture from the shelf between the blocks around `at` (the caret when left out),
			 * selected, with its settings open to describe it.
			 */
			insertPicture: (picture: Picture, at?: number) => ReturnType;
			/** Open the shelf to choose a picture to put in. */
			choosePicture: () => ReturnType;
			/**
			 * The caret just after the picture at `at`: at the start of the paragraph that follows,
			 * or, with no paragraph there, between the blocks, where typing starts one.
			 */
			caretAfterPicture: (at: number) => ReturnType;
		};
	}
}

/** The files among what was dropped or pasted that might be pictures. */
export function pictureFilesIn(data: DataTransfer | null | undefined) {
	return [...(data?.files ?? [])].filter((file) => file.type.startsWith('image/'));
}

/**
 * Where a picture goes for a caret at `at`: in place of the empty paragraph it's in, before the
 * block it's at the very start of, or after the block it's in. Never inside a quote or a list.
 */
function placeFor(state: EditorState, at: number) {
	const $at = state.doc.resolve(Math.min(at, state.doc.content.size));
	if ($at.depth === 0) return { from: $at.pos, to: $at.pos };
	const block = $at.node(1);
	const start = $at.before(1);
	if (block.type.name === 'paragraph' && block.content.size === 0) {
		return { from: start, to: start + block.nodeSize };
	}
	const before = state.doc.textBetween(start, $at.pos, '', '￼');
	return before ? { from: $at.after(1), to: $at.after(1) } : { from: start, to: start };
}

/** Attributes copied with a picture, as data- attributes, so a copy inside the editor keeps them. */
function attribute(name: keyof Picture, fallback: string | number | boolean) {
	return {
		default: fallback,
		parseHTML: (element: HTMLElement) => {
			const value = element.getAttribute(`data-${name}`);
			if (value === null) return fallback;
			if (typeof fallback === 'number') return Number(value) || fallback;
			if (typeof fallback === 'boolean') return value === 'true';
			return value;
		},
		renderHTML: (attributes: Record<string, unknown>) => ({
			[`data-${name}`]: String(attributes[name] ?? fallback)
		})
	};
}

const DELETED = 'Taken off your art shelf, so readers see nothing here.';

/** The picture as the writer sees it, kept up to date with the node and the shelf. */
function pictureView(
	node: DocNode,
	getPos: () => number | undefined,
	remove: (at: number) => void
) {
	let current = node;
	const dom = document.createElement('div');
	dom.className = 'bb-picture-node';
	dom.dataset.type = 'picture';
	const figure = document.createElement('figure');
	const image = document.createElement('img');
	image.decoding = 'async';
	image.draggable = false;
	const gone = document.createElement('div');
	gone.className = 'bb-picture-gone';
	const goneText = document.createElement('p');
	const goneButton = document.createElement('button');
	goneButton.type = 'button';
	goneButton.textContent = 'Take it out';
	goneButton.addEventListener('click', () => {
		const at = getPos();
		if (at !== undefined) remove(at);
	});
	gone.append(goneText, goneButton);
	const caption = document.createElement('figcaption');
	const tags = document.createElement('p');
	tags.className = 'bb-picture-tags';
	figure.append(image, gone, caption);
	dom.append(figure, tags);

	function draw() {
		const picture = current.attrs as Picture;
		const found = get(artStore).find((item) => item.id === picture.art);
		const width = found?.width ?? picture.width;
		const height = found?.height ?? picture.height;
		figure.className = `bb-picture bb-picture-${picture.size}`;
		figure.style.setProperty('--ratio', (width / Math.max(1, height)).toFixed(4));
		dom.classList.toggle('is-gone', !found);
		if (found) {
			if (image.getAttribute('src') !== found.url) {
				const { srcset, sizes } = pictureSizes(found, picture.size);
				image.width = width;
				image.height = height;
				if (srcset) {
					image.srcset = srcset;
					image.sizes = sizes;
				} else image.removeAttribute('srcset');
				image.src = found.url;
			}
			image.alt = picture.decorative ? '' : picture.alt;
		} else {
			image.removeAttribute('src');
			image.removeAttribute('srcset');
			const loading = get(libraryStatus) !== 'ready';
			goneText.textContent = loading ? 'Finding the picture…' : DELETED;
			goneButton.hidden = loading;
		}
		const words = picture.caption ? toHTML(picture.caption, 'description') : '';
		if (caption.innerHTML !== words) caption.innerHTML = words;
		caption.hidden = !words;
		const notes = [
			picture.size === 'page' ? 'A page to itself' : '',
			found && !picture.decorative && !picture.alt ? 'No description yet' : ''
		].filter(Boolean);
		tags.replaceChildren(
			...notes.map((note) => {
				const tag = document.createElement('span');
				tag.textContent = note;
				if (note.startsWith('No')) tag.className = 'warn';
				return tag;
			})
		);
		tags.hidden = !notes.length;
		const size = PICTURE_SIZES.find((choice) => choice.id === picture.size);
		dom.title = found ? `Picture · ${size?.hint ?? ''}. Click to change it.` : '';
	}

	const stop = [artStore.subscribe(draw), libraryStatus.subscribe(draw)];
	return {
		dom,
		update(next: DocNode) {
			if (next.type !== current.type) return false;
			current = next;
			draw();
			return true;
		},
		// The button in a deleted picture's box is a button, not a place in the text.
		stopEvent: (event: Event) =>
			event.target instanceof Element && !!event.target.closest('.bb-picture-gone button'),
		ignoreMutation: () => true,
		destroy: () => stop.forEach((unsubscribe) => unsubscribe())
	};
}

export function pictureExtension(bridge?: PictureBridge) {
	return Node.create({
		name: 'picture',
		// Ahead of the usual keys, so Enter on a selected picture opens its caption rather than
		// replacing it.
		priority: 200,
		// Its own group: the story document holds it between blocks, and quotes and lists don't
		// (see StoryDocument in ./extensions).
		group: 'figure',
		atom: true,
		selectable: true,
		draggable: true,
		marks: '',

		addAttributes() {
			return {
				art: attribute('art', 0),
				width: attribute('width', 1),
				height: attribute('height', 1),
				size: attribute('size', 'wide'),
				alt: attribute('alt', ''),
				decorative: attribute('decorative', false),
				caption: attribute('caption', '')
			};
		},

		parseHTML() {
			return [{ tag: 'figure[data-type="picture"]' }];
		},

		renderHTML({ HTMLAttributes }) {
			return ['figure', mergeAttributes(HTMLAttributes, { 'data-type': 'picture' })];
		},

		// Copied out as text, a picture is nothing.
		renderText: () => '',

		addNodeView() {
			return ({ node, getPos, editor }) =>
				pictureView(node, getPos, (at) => {
					editor
						.chain()
						.focus()
						.deleteRange({ from: at, to: at + 1 })
						.run();
				});
		},

		addCommands() {
			return {
				insertPicture:
					(picture, at) =>
					({ state, tr, dispatch }) => {
						const type = state.schema.nodes.picture;
						if (!type) return false;
						const place = placeFor(state, at ?? state.selection.from);
						if (!dispatch) return true;
						// No empty paragraph comes with it: readers would see a blank line. Where no text
						// follows, the caret goes on between the blocks (caretAfterPicture).
						tr.replaceWith(place.from, place.to, type.create(picture));
						tr.setSelection(NodeSelection.create(tr.doc, place.from)).scrollIntoView();
						dispatch(tr);
						// Once the editor has drawn it, so the box has a picture to sit by.
						requestAnimationFrame(() => bridge?.open(place.from, true));
						return true;
					},
				choosePicture: () => () => {
					if (!bridge) return false;
					bridge.choose();
					return true;
				},
				caretAfterPicture:
					(at) =>
					({ tr, dispatch }) => {
						if (tr.doc.nodeAt(at)?.type.name !== 'picture') return false;
						const $after = tr.doc.resolve(at + 1);
						const next = $after.nodeAfter;
						// A scene break, another picture or the end of the text: between them. Anything
						// else holds text (in a quote or a list, further in), and the caret goes there.
						const selection =
							!next || next.isAtom
								? new GapCursor($after)
								: (Selection.findFrom($after, 1, true) ?? NodeSelection.create(tr.doc, at));
						if (dispatch) tr.setSelection(selection).scrollIntoView();
						return true;
					}
			};
		},

		addKeyboardShortcuts() {
			return {
				// With the picture selected, Enter goes into its caption.
				Enter: ({ editor }) => {
					const { selection } = editor.state;
					if (!(selection instanceof NodeSelection) || selection.node.type.name !== 'picture') {
						return false;
					}
					bridge?.open(selection.from, true);
					return true;
				},
				// And Esc puts its settings away, the caret after it, as their Done does.
				Escape: ({ editor }) => {
					const { selection } = editor.state;
					if (!(selection instanceof NodeSelection) || selection.node.type.name !== 'picture') {
						return false;
					}
					bridge?.leave();
					return editor.commands.caretAfterPicture(selection.from);
				}
			};
		},

		addProseMirrorPlugins() {
			let showing: number | null = null;
			return [
				new Plugin({
					key: new PluginKey('picture'),
					props: {
						// Typing with the picture selected would replace it. The letters start a paragraph
						// after it instead; Backspace and Delete still take it out.
						handleTextInput: (view, _from, _to, text) => {
							const { selection, schema } = view.state;
							if (!(selection instanceof NodeSelection) || selection.node.type.name !== 'picture') {
								return false;
							}
							const tr = view.state.tr.insert(
								selection.to,
								schema.nodes.paragraph.create(null, schema.text(text))
							);
							tr.setSelection(TextSelection.create(tr.doc, selection.to + 1 + text.length));
							view.dispatch(tr.scrollIntoView());
							return true;
						},
						// A picture file pasted goes up to the shelf and in; a picture from a page
						// elsewhere can't come in as a link to that page, so the writer is told why.
						handlePaste: (view, event) => {
							if (!bridge) return false;
							const files = pictureFilesIn(event.clipboardData);
							if (files.length) {
								bridge.upload(files, view.state.selection.from);
								return true;
							}
							const html = event.clipboardData?.getData('text/html') ?? '';
							if (/<img\b/i.test(html) && !html.includes('data-type="picture"')) {
								bridge.refuse(
									'Pictures from other pages don’t come in with a paste: their words did. Save a picture to your device and drop it in, or choose one from your art shelf.'
								);
							}
							return false;
						},
						handleDrop: (view, event, _slice, moved) => {
							if (!bridge || moved) return false;
							const files = pictureFilesIn(event.dataTransfer);
							if (!files.length) return false;
							event.preventDefault();
							const at =
								view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ??
								view.state.selection.from;
							bridge.upload(files, at);
							return true;
						}
					},
					// Selecting a picture shows its settings; moving off puts them away.
					view: () => ({
						update: (view) => {
							const { selection } = view.state;
							const on =
								selection instanceof NodeSelection && selection.node.type.name === 'picture'
									? selection.from
									: null;
							if (on === showing) return;
							showing = on;
							// After the update: the box may change the document, which can't happen inside one.
							queueMicrotask(() => (on === null ? bridge?.leave() : bridge?.open(on, false)));
						}
					})
				})
			];
		}
	});
}
