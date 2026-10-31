// The editor's building blocks (Tiptap). Browser only: imported by RichEditor.
import { Extension } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import StarterKit from '@tiptap/starter-kit';
import { Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Typography from '@tiptap/extension-typography';
import { Placeholder } from '@tiptap/extensions';
import { FONTS, HIGHLIGHTS, INKS, SIZES, highlightVar, inkVar, type RichKind } from '$lib/rich';

/** The document keeps the story's first-letter settings (see $lib/rich DropCap). */
const StoryDocument = Document.extend({
	addAttributes() {
		return { dropCap: { default: null } };
	}
});

// Palette colours only: a page's own colours (black text, white backgrounds) would vanish at
// night or on paper. Colours picked with "Any colour" don't survive a paste either.
const allowed = {
	color: (v: string) => INKS.some((ink) => inkVar(ink.id) === v),
	'font-size': (v: string) => SIZES.some((size) => size.value && size.value === v),
	'font-family': (v: string) => FONTS.some((font) => font.value && font.value === v),
	'background-color': (v: string) => HIGHLIGHTS.some((mark) => highlightVar(mark.id) === v)
};

/**
 * Pasted HTML keeps its structure and emphasis but only styles from the editor's own palette,
 * sizes and typefaces: text pasted from elsewhere shouldn't arrive black-on-night or in Arial.
 */
export function cleanPastedHTML(html: string) {
	const doc = new DOMParser().parseFromString(html, 'text/html');
	for (const element of doc.body.querySelectorAll<HTMLElement>('*')) {
		const kept: string[] = [];
		for (const [property, test] of Object.entries(allowed)) {
			const value = element.style.getPropertyValue(property).trim();
			if (value && test(value)) kept.push(`${property}: ${value}`);
		}
		element.removeAttribute('class');
		if (kept.length) element.setAttribute('style', kept.join('; '));
		else element.removeAttribute('style');
	}
	return doc.body.innerHTML;
}

/** Escape leaves the editor (and lets a form cancel its edit). */
const EscapeKey = (onescape?: () => void) =>
	Extension.create({
		name: 'escapeKey',
		addKeyboardShortcuts() {
			return {
				Escape: ({ editor }) => {
					editor.commands.blur();
					onescape?.();
					return true;
				}
			};
		}
	});

export function extensionsFor(kind: RichKind, placeholder: string, onescape?: () => void) {
	const story = kind === 'story';
	return [
		StarterKit.configure({
			document: false,
			code: false,
			codeBlock: false,
			link: false,
			heading: story ? { levels: [1, 2, 3] } : false,
			blockquote: story ? {} : false,
			bulletList: story ? {} : false,
			orderedList: story ? {} : false,
			listItem: story ? {} : false,
			listKeymap: story ? {} : false,
			horizontalRule: story ? {} : false
		}),
		story ? StoryDocument : Document,
		TextStyle,
		Color,
		...(story ? [FontSize, FontFamily] : []),
		Highlight.configure({ multicolor: true }),
		...(story ? [TextAlign.configure({ types: ['heading', 'paragraph'] })] : []),
		Typography,
		Placeholder.configure({ placeholder }),
		EscapeKey(onescape)
	];
}
