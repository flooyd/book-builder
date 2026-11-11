// Typing / at the start of an empty line opens the Insert list (./insert.ts) there, as the
// toolbar's Insert button does. Only on an empty line and only a / on its own: a letter after it,
// or Esc, closes the list and leaves the / as typed. Browser only, like ./extensions; the list
// itself is SlashMenu.svelte, which sits in the top layer, so it shows over focus mode.
import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { Suggestion, type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion';
import { insertItems, runInsert, type InsertItem } from './insert';

export type SlashMenuProps = SuggestionProps<InsertItem, InsertItem>;

/** How the editor talks to its list. */
export type SlashBridge = {
	open: (props: SlashMenuProps) => void;
	keydown: (event: KeyboardEvent) => boolean;
	close: () => void;
};

export function slashExtension(bridge: SlashBridge, mentions: boolean) {
	return Extension.create({
		name: 'slashMenu',
		addProseMirrorPlugins() {
			return [
				Suggestion<InsertItem, InsertItem>({
					pluginKey: new PluginKey('slashMenu'),
					editor: this.editor,
					char: '/',
					startOfLine: true,
					decorationClass: 'bb-slash-typing',
					// A paragraph holding nothing but the /.
					allow: ({ state, range }) => {
						const parent = state.doc.resolve(range.from).parent;
						return (
							range.to - range.from === 1 &&
							parent.type.name === 'paragraph' &&
							parent.childCount === 1 &&
							parent.textContent === '/'
						);
					},
					items: () => insertItems(mentions),
					command: ({ editor, range, props }) => {
						editor.chain().focus().deleteRange(range).run();
						runInsert(editor, props.id);
					},
					render: () => ({
						onStart: (props) => bridge.open(props),
						onUpdate: (props) => bridge.open(props),
						onKeyDown: ({ event }: SuggestionKeyDownProps) => bridge.keydown(event),
						onExit: () => bridge.close()
					})
				})
			];
		}
	});
}
