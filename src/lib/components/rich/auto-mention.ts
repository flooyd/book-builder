// Names from the book's story bible, linked wherever they're written: on load, and the moment a
// name is typed, with no @ needed. Browser only, like ./extensions.
//
// These links are decorations, not mentions. The editor draws them and nothing saves them, so:
// the text stays the writer's own words to change letter by letter; reading mode, exports and
// the server never see them; and opening a chapter costs the server nothing. Mentions made with @
// are real nodes and stay as they are (./mention.ts), and @ is still how a new entry is added.
import { Extension, getChangedRanges } from '@tiptap/core';
import type { Node as ProseNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { get } from 'svelte/store';
import { entryStores } from '$lib/stores';
import { ENTRY_TYPES, NOT_TEXT, nameFinder, type NameSpot } from '$lib/bible';

type Finder = (text: string) => NameSpot[];

type AutoMentionState = {
	/** The names the finder was built from, to tell when the story bible has really changed. */
	names: string;
	find: Finder;
	decorations: DecorationSet;
};

const key = new PluginKey<AutoMentionState>('autoMention');

/** The entries in this book's story bible, as the finder needs them, and a key for that list. */
function bookNames(bookId: number) {
	const entries = ENTRY_TYPES.flatMap((type) =>
		get(entryStores[type])
			.filter((entry) => entry.bookIds.includes(bookId))
			.map(({ id, name, aliases }) => ({ type, id, name, aliases }))
	);
	return { names: JSON.stringify(entries), find: nameFinder(entries) };
}

/** The links in one paragraph or heading, which starts at `start` in the document. */
function blockLinks(block: ProseNode, start: number, find: Finder) {
	let text = '';
	block.forEach((child) => {
		// A mention or a line break: a name never runs across one.
		text += child.isText ? (child.text ?? '') : NOT_TEXT.repeat(child.nodeSize);
	});
	return find(text).map((spot) =>
		Decoration.inline(start + 1 + spot.from, start + 1 + spot.to, {
			class: 'bb-mention bb-mention-auto',
			// Not data-type="mention": that would read as a real mention if the browser handed the
			// editor this span back (a spelling fix, a phone keyboard), and a real one needs a label.
			'data-auto-mention': '',
			'data-entry': spot.type,
			'data-id': String(spot.id)
		})
	);
}

function allLinks(doc: ProseNode, find: Finder) {
	const links: Decoration[] = [];
	doc.descendants((node, position) => {
		if (!node.isTextblock) return true;
		links.push(...blockLinks(node, position, find));
		return false;
	});
	return DecorationSet.create(doc, links);
}

/** Links the names in this book's story bible, and keeps them right as the text and bible change. */
export function autoMentionExtension(bookId: number) {
	return Extension.create({
		name: 'autoMention',
		addProseMirrorPlugins() {
			return [
				new Plugin<AutoMentionState>({
					key,
					state: {
						init: (_, { doc }) => {
							const { names, find } = bookNames(bookId);
							return { names, find, decorations: allLinks(doc, find) };
						},
						apply: (transaction, state) => {
							const fresh = transaction.getMeta(key) as Omit<AutoMentionState, 'decorations'>;
							if (fresh) return { ...fresh, decorations: allLinks(transaction.doc, fresh.find) };
							if (!transaction.docChanged) return state;

							// Only the paragraphs this change touched are read again: a keystroke in a long
							// chapter shouldn't search the whole of it.
							const doc = transaction.doc;
							let decorations = state.decorations.map(transaction.mapping, doc);
							const read: number[] = [];
							for (const { newRange } of getChangedRanges(transaction)) {
								const from = Math.max(0, newRange.from - 1);
								const to = Math.min(doc.content.size, newRange.to + 1);
								doc.nodesBetween(from, to, (node, position) => {
									if (!node.isTextblock) return true;
									if (!read.includes(position)) {
										read.push(position);
										const end = position + node.nodeSize;
										decorations = decorations
											.remove(decorations.find(position, end))
											.add(doc, blockLinks(node, position, state.find));
									}
									return false;
								});
							}
							return { ...state, decorations };
						}
					},
					props: {
						decorations: (state) => key.getState(state)?.decorations
					},
					// A character added with @, renamed or given an alias, or brought into this book:
					// the links follow at once, with no reload.
					view: (view) => {
						let open = true;
						const refresh = () =>
							// After the change that set it off has finished: that may be a transaction too.
							queueMicrotask(() => {
								if (!open) return;
								const fresh = bookNames(bookId);
								if (fresh.names === key.getState(view.state)?.names) return;
								view.dispatch(view.state.tr.setMeta(key, fresh));
							});
						const stops = ENTRY_TYPES.map((type) => entryStores[type].subscribe(refresh));
						return {
							destroy: () => {
								open = false;
								stops.forEach((stop) => stop());
							}
						};
					}
				})
			];
		}
	});
}
