// The editor's building blocks (Tiptap). Browser only: imported by RichEditor.
import { Extension } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import StarterKit from '@tiptap/starter-kit';
import { Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Typography from '@tiptap/extension-typography';
import { Focus, Placeholder } from '@tiptap/extensions';
import { FONTS, HIGHLIGHTS, INKS, SIZES, highlightVar, inkVar, type RichKind } from '$lib/rich';
import { mentionExtension, type MentionBridge } from './mention';
import { autoMentionExtension } from './auto-mention';
import { footnoteExtension, type FootnoteBridge } from './footnote';
import { pictureExtension, type PictureBridge } from './picture';
import { slashExtension, type SlashBridge } from './slash';

/**
 * The document keeps the story's first-letter settings (see $lib/rich DropCap), and holds
 * pictures between its blocks: only here, never inside a quote or a list, as the cleaner keeps
 * them.
 */
const StoryDocument = Document.extend({
	content: '(block | figure)+',
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

/**
 * Escape leaves the editor (and lets a form cancel its edit). Below the default priority, so a
 * menu that's open (the @ list, the / list) takes Esc first and closes, and the caret stays.
 * A toolbar menu (Insert, the colours) keeps the caret in the text while it's open, so Esc
 * reaches the editor: it closes the menu and nothing else, or focus mode would close with it.
 */
const EscapeKey = (onescape?: () => void) =>
	Extension.create({
		name: 'escapeKey',
		priority: 50,
		addKeyboardShortcuts() {
			return {
				Escape: ({ editor }) => {
					const menu = editor.view.dom.ownerDocument.querySelector<HTMLElement>(
						'[data-menu]:popover-open'
					);
					if (menu) {
						menu.hidePopover();
						return true;
					}
					editor.commands.blur();
					onescape?.();
					return true;
				}
			};
		}
	});

/** What an editor is joined to: its boxes and menus, which it opens. */
export type Bridges = {
	onescape?: () => void;
	/** Typing @ to mention the story bible, and its names linking themselves. */
	mentions?: MentionBridge;
	/** The box a footnote's note is written in. */
	footnotes?: FootnoteBridge;
	/** A picture's settings, and the shelf to choose one from. */
	pictures?: PictureBridge;
	/** The list that typing / on an empty line opens. */
	slash?: SlashBridge;
};

export function extensionsFor(
	kind: RichKind,
	placeholder: string,
	{ onescape, mentions, footnotes, pictures, slash }: Bridges = {}
) {
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
		// Marks the paragraph being written (.has-focus): focus mode can dim the rest.
		...(story ? [Focus.configure({ className: 'has-focus', mode: 'shallowest' })] : []),
		// Story text can always hold mentions; `mentions` is what lets the writer add them, and
		// links the story bible's names wherever they're written.
		...(story ? [mentionExtension(mentions)] : []),
		...(story && mentions ? [autoMentionExtension(mentions.bookId)] : []),
		// Story text can always hold footnotes; `footnotes` is the box their notes open in.
		...(story ? [footnoteExtension(footnotes)] : []),
		// And pictures; `pictures` is their box and the shelf they're chosen from.
		...(story ? [pictureExtension(pictures)] : []),
		...(story && slash ? [slashExtension(slash, !!mentions)] : []),
		EscapeKey(onescape)
	];
}
