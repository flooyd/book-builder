// Footnotes in the editor (Tiptap): the node that sits in the text as a raised number, and how the
// writer reaches its note. Browser only, like ./extensions. What a footnote is, and how it's stored
// and cleaned, is in $lib/rich; the box the note is read and written in is FootnoteBox.svelte.
//
// The number is drawn by a CSS counter (.bb-footnote in prose.css), so it follows the notes' order
// as the text changes and nothing has to renumber them.
import { mergeAttributes, Node } from '@tiptap/core';
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state';

/** How the editor talks to its note box. Positions are where the footnote node starts. */
export type FootnoteBridge = {
	/** Show the note of the footnote at `at`, with the caret in it when `edit` is true. */
	open: (at: number, edit: boolean) => void;
	/** The selection has left the footnote that's showing. */
	leave: () => void;
};

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		footnote: {
			/** A new footnote where the caret is, with its note open to be written. */
			insertFootnote: () => ReturnType;
		};
	}
}

export function footnoteExtension(bridge?: FootnoteBridge) {
	return Node.create({
		name: 'footnote',
		// Ahead of the usual keys, so Enter on a selected number opens its note rather than
		// splitting the paragraph.
		priority: 200,
		group: 'inline',
		inline: true,
		atom: true,
		selectable: true,
		draggable: false,
		// The number has its own look: bold or a colour around it doesn't reach it.
		marks: '',

		addAttributes() {
			return {
				note: {
					default: '',
					parseHTML: (element: HTMLElement) => element.getAttribute('data-note') ?? '',
					renderHTML: (attributes: Record<string, unknown>) => ({
						'data-note': String(attributes.note ?? '')
					})
				}
			};
		},

		parseHTML() {
			return [{ tag: 'sup[data-type="footnote"]' }];
		},

		renderHTML({ HTMLAttributes }) {
			return [
				'sup',
				mergeAttributes(HTMLAttributes, { 'data-type': 'footnote', class: 'bb-footnote' })
			];
		},

		// Copied out as text, a footnote is nothing: its number means nothing elsewhere.
		renderText: () => '',

		addCommands() {
			return {
				insertFootnote:
					() =>
					({ state, chain }) => {
						const at = state.selection.to;
						const done = chain()
							.focus()
							.insertContentAt(at, { type: 'footnote', attrs: { note: '' } })
							.run();
						// Once the editor has drawn it, so the box has a number to sit by.
						if (done) requestAnimationFrame(() => bridge?.open(at, true));
						return done;
					}
			};
		},

		addKeyboardShortcuts() {
			return {
				// Word's own key for a footnote.
				'Mod-Alt-f': () => this.editor.commands.insertFootnote(),
				// With the number selected, Enter goes into its note.
				Enter: ({ editor }) => {
					const { selection } = editor.state;
					if (!(selection instanceof NodeSelection) || selection.node.type.name !== 'footnote') {
						return false;
					}
					bridge?.open(selection.from, true);
					return true;
				}
			};
		},

		addProseMirrorPlugins() {
			let showing: number | null = null;
			return [
				new Plugin({
					key: new PluginKey('footnote'),
					props: {
						// A click on the number opens its note to write in.
						handleClickOn: (_view, _pos, node, nodePos, _event, direct) => {
							if (!direct || node.type.name !== 'footnote') return false;
							requestAnimationFrame(() => bridge?.open(nodePos, true));
							return false;
						},
						// Typing with the number selected would replace it, note and all. The letters go
						// after it instead; Backspace and Delete still take it out.
						handleTextInput: (view, _from, _to, text) => {
							const { selection } = view.state;
							if (
								!(selection instanceof NodeSelection) ||
								selection.node.type.name !== 'footnote'
							) {
								return false;
							}
							view.dispatch(view.state.tr.insertText(text, selection.to));
							return true;
						}
					},
					// Arrowing onto a number shows its note; moving off puts it away.
					view: () => ({
						update: (view) => {
							const { selection } = view.state;
							const on =
								selection instanceof NodeSelection && selection.node.type.name === 'footnote'
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
