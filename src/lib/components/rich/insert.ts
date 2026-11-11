// What can be put into story text from the toolbar's Insert menu, or by typing / at the start of
// an empty line (./slash.ts): the same list, in the same order, doing the same thing. Types only
// from Tiptap: the toolbar is part of the page, and Tiptap loads later (see RichEditor).
import type { Editor } from '@tiptap/core';
import type { IconName } from '$lib/components/ui/Icon.svelte';

export type InsertId = 'picture' | 'footnote' | 'break' | 'mention';

export type InsertItem = { id: InsertId; label: string; note: string; icon: IconName };

/** The list, with Mention only where the text can mention the story bible. */
export function insertItems(mentions: boolean): InsertItem[] {
	const items: InsertItem[] = [
		{ id: 'picture', label: 'Picture', note: 'From your art shelf, or upload one', icon: 'image' },
		{
			id: 'footnote',
			label: 'Footnote',
			note: 'A note for the foot of the page',
			icon: 'footnote'
		},
		{ id: 'break', label: 'Scene break', note: 'A pause between scenes', icon: 'scene-break' }
	];
	if (mentions) {
		items.push({
			id: 'mention',
			label: 'Mention',
			note: 'A character, place or system',
			icon: 'at-sign'
		});
	}
	return items;
}

/** The keys that do the same, where there are some. */
export const INSERT_KEYS: Partial<Record<InsertId, string>> = {
	footnote: 'Ctrl+Alt+F',
	mention: '@'
};

/** Type the @ for the writer, on a word of its own, which opens the mention menu. */
export function startMention(editor: Editor) {
	const { from } = editor.state.selection;
	const before = editor.state.doc.textBetween(Math.max(0, from - 1), from, '\n', '￼');
	editor
		.chain()
		.focus()
		.insertContent(before && !/\s/.test(before) ? ' @' : '@')
		.run();
}

export function runInsert(editor: Editor, id: InsertId) {
	if (id === 'picture') editor.commands.choosePicture();
	else if (id === 'footnote') editor.commands.insertFootnote();
	else if (id === 'break') editor.chain().focus().setHorizontalRule().run();
	else startMention(editor);
}
