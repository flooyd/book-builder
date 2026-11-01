// @ mentions in the editor (Tiptap): the node that sits in the text, and the suggestion that fills
// the menu as the writer types. Browser only, like ./extensions. What a mention means and how it's
// stored and cleaned is in $lib/rich; the menu itself is MentionMenu.svelte.
import { mergeAttributes } from '@tiptap/core';
import Mention from '@tiptap/extension-mention';
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import { get } from 'svelte/store';
import { charactersStore, placesStore, systemsStore } from '$lib/stores';
import {
	ENTRY_TYPES,
	namesEntry,
	searchEntries,
	type EntryType,
	type MentionChoice
} from '$lib/bible';

/** A row of the menu: an entry to mention, or an offer to add a new one by that name. */
export type MentionRow = ({ add?: undefined } & MentionChoice) | { add: EntryType; label: string };

export type MentionMenuProps = SuggestionProps<MentionRow, MentionChoice>;

/** How the editor talks to its menu. */
export type MentionBridge = {
	bookId: number;
	open: (props: MentionMenuProps) => void;
	keydown: (event: KeyboardEvent) => boolean;
	close: () => void;
};

/** A query this long has stopped being a name: the writer has moved on, so the menu closes. */
const LONGEST_QUERY = 40;
const MOST_WORDS = 4;

/** The menu for what's been typed after @. */
export function mentionRows(query: string, bookId: number): MentionRow[] {
	const entries = [
		...get(charactersStore).map((entry) => ({ ...entry, type: 'character' as const })),
		...get(placesStore).map((entry) => ({ ...entry, type: 'place' as const })),
		...get(systemsStore).map((entry) => ({ ...entry, type: 'system' as const }))
	];
	const choices = searchEntries(entries, query, bookId);
	const name = query.trim();
	if (!name || namesEntry(choices, name)) return choices;
	return [...choices, ...ENTRY_TYPES.map((type) => ({ add: type, label: name }))];
}

/** The mention node, and when the editor has a `bridge`, typing @ to add one. */
export function mentionExtension(bridge?: MentionBridge) {
	return Mention.extend({
		addAttributes() {
			return {
				...this.parent?.(),
				entry: {
					default: 'character',
					parseHTML: (element: HTMLElement) => element.getAttribute('data-entry'),
					renderHTML: (attributes: Record<string, unknown>) => ({
						'data-entry': attributes.entry
					})
				}
			};
		}
	}).configure({
		// Backspace takes the whole name, as it would take a character: the name is one piece.
		deleteTriggerWithBackspace: true,
		renderText: ({ node }) => String(node.attrs.label ?? ''),
		renderHTML: ({ options, node }) => [
			'span',
			mergeAttributes({ class: 'bb-mention' }, options.HTMLAttributes),
			String(node.attrs.label ?? '')
		],
		suggestion: {
			char: '@',
			decorationClass: 'bb-mention-typing',
			// Names have spaces. An @ only starts a mention after a space, an opening quote or
			// bracket, or a dash, so an email address in the text doesn't.
			allowSpaces: true,
			allowedPrefixes: [' ', '“', '‘', '"', "'", '(', '—', '–'],
			allow: ({ state, range }) => {
				if (!bridge) return false;
				const query = state.doc.textBetween(range.from, range.to).slice(1).trim();
				return query.length <= LONGEST_QUERY && query.split(/\s+/).length <= MOST_WORDS;
			},
			items: ({ query }) => (bridge ? mentionRows(query, bridge.bookId) : []),
			// No space after it: the next character is as likely to be a comma or an apostrophe.
			command: ({ editor, range, props }) => {
				const { type, id, label } = props as unknown as MentionChoice;
				editor
					.chain()
					.focus()
					.insertContentAt(range, [{ type: 'mention', attrs: { entry: type, id, label } }])
					.run();
			},
			render: () => ({
				onStart: (props) => bridge?.open(props as unknown as MentionMenuProps),
				onUpdate: (props) => bridge?.open(props as unknown as MentionMenuProps),
				onKeyDown: ({ event }: SuggestionKeyDownProps) => bridge?.keydown(event) ?? false,
				onExit: () => bridge?.close()
			})
		}
	});
}
