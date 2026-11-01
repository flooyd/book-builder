import { read } from '$app/server';
import { create, type Font } from 'fontkit';
import type { Family } from './manuscript';

/**
 * The typefaces a PDF is set in, the same ones the app uses, kept beside this file. Their licences
 * (all SIL Open Font License) are there too. Each comes in pieces by alphabet, as Google serves
 * them, so a character is looked for in each piece in turn; Noto Serif covers Vietnamese, Greek
 * and Cyrillic, which the others don't draw. Typewriter is Courier Prime: the app leaves that to the device.
 */

const FILES = import.meta.glob<string>('./fonts/*.woff', {
	eager: true,
	query: '?url',
	import: 'default'
});

const FILE_NAMES: Record<Family, string> = {
	read: 'newsreader',
	display: 'gloock',
	ui: 'schibsted-grotesk',
	mono: 'courier-prime'
};

const FALLBACKS = ['vietnamese', 'greek', 'greek-ext', 'cyrillic', 'cyrillic-ext'];

export type Style = { family: Family; bold: boolean; italic: boolean };

export type Face = { id: string; bytes: Buffer; font: Font };

/** The files a style looks in, best first. */
function chainOf({ family, bold, italic }: Style) {
	// Gloock has one weight and no italic.
	const cut =
		family === 'display' ? '400-normal' : `${bold ? 700 : 400}-${italic ? 'italic' : 'normal'}`;
	const name = FILE_NAMES[family];
	const noto = `${bold ? 700 : 400}-${italic ? 'italic' : 'normal'}`;
	return [
		`${name}-latin-${cut}`,
		`${name}-latin-ext-${cut}`,
		...FALLBACKS.map((subset) => `noto-serif-${subset}-${noto}`)
	];
}

async function loadFaces() {
	const faces: Record<string, Face> = {};
	await Promise.all(
		Object.entries(FILES).map(async ([path, url]) => {
			const id = path.replace(/^.*\/|\.woff$/g, '');
			const bytes = Buffer.from(await read(url).arrayBuffer());
			faces[id] = { id, bytes, font: create(bytes) as Font };
		})
	);
	return faces;
}

/** Read once and kept: they don't change, and a function may serve many exports. */
let loading: Promise<Record<string, Face>> | undefined;

export function faces() {
	loading ??= loadFaces().catch((error) => {
		loading = undefined;
		throw error;
	});
	return loading;
}

/** Finds the face that draws each character in a style, remembering what it's found. */
export class FacePicker {
	#faces: Record<string, Face>;
	#found: Record<string, string | null> = {};

	constructor(loaded: Record<string, Face>) {
		this.#faces = loaded;
	}

	/** The style's own face, whatever it can draw. */
	main(style: Style) {
		return chainOf(style)[0];
	}

	/** The face that draws this character, or null if none of them can. */
	pick(char: string, style: Style) {
		const key = `${style.family}${+style.bold}${+style.italic}${char}`;
		if (key in this.#found) return this.#found[key];
		const code = char.codePointAt(0) ?? 0;
		const face = chainOf(style).find((id) => this.#faces[id].font.hasGlyphForCodePoint(code));
		return (this.#found[key] = face ?? null);
	}

	/** Height of a capital letter, as a share of the type size. */
	capHeight(face: string) {
		const { font } = this.#faces[face];
		return font.capHeight / font.unitsPerEm;
	}
}
