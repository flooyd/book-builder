// Reading mode: word counts, reading time, and the reader's text settings.

export function countWords(text: string) {
	const trimmed = text.trim();
	return trimmed ? trimmed.split(/\s+/).length : 0;
}

const WORDS_PER_MINUTE = 230;

/** "4 min", "1 hr", "2 hr 15 min". */
export function readingTime(words: number) {
	const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE));
	if (minutes < 60) return `${minutes} min`;
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

// ---- Reader settings ---------------------------------------------------------------------

/** Text sizes in px; the settings step through them. */
export const TEXT_SIZES = [16, 18, 20, 22, 24, 27];

export type Typeface = 'serif' | 'sans';
/** One long page you scroll, or a book you turn the pages of. */
export type ReaderView = 'scroll' | 'book';
export type ReaderPrefs = { size: number; face: Typeface; view: ReaderView };

/** Kept in a cookie so the server renders the book at the reader's size (no reflow on load). */
export const READER_COOKIE = 'bb-reader';

export const DEFAULT_PREFS: ReaderPrefs = { size: 2, face: 'serif', view: 'scroll' };

/** Cookie value "<size index>-<typeface>-<view>", e.g. "3-sans-book"; the view is optional. */
export function parseReaderPrefs(value: string | undefined): ReaderPrefs {
	const [size, face, view] = (value ?? '').split('-');
	const index = Number(size);
	return {
		size:
			size && Number.isInteger(index) && index >= 0 && index < TEXT_SIZES.length
				? index
				: DEFAULT_PREFS.size,
		face: face === 'sans' ? 'sans' : 'serif',
		view: view === 'book' ? 'book' : 'scroll'
	};
}

export function saveReaderPrefs(prefs: ReaderPrefs) {
	document.cookie = `${READER_COOKIE}=${prefs.size}-${prefs.face}-${prefs.view}; path=/; max-age=31536000; samesite=lax`;
}

// ---- Where the reader is -------------------------------------------------------------------

/** A part or chapter in reading order; key is its anchor ("part-3", "chapter-12"). */
export type ReadingSection = { key: string; overline: string | null; title: string };

/** A place in the book: a section, and how far through it (0 to 1). Both views read and write it. */
export type ReadingPosition = { key: string; fraction: number };

// ---- Page data ---------------------------------------------------------------------------

/** What both reading routes load ($lib/server/reading); hidden descriptions arrive blank. */
export type ReaderData = {
	book: { id: number; title: string; description: string };
	parts: {
		id: number;
		bookId: number;
		title: string;
		description: string;
		hasChapters: number;
		position: number;
		createdAt: string;
	}[];
	chapters: {
		id: number;
		partId: number;
		title: string;
		description: string;
		position: number;
		createdAt: string;
	}[];
	/** Story text by section anchor: "part-3", "chapter-12". */
	texts: Record<string, string>;
	author: string;
	/** The author's public page address (/author/<handle>), when it is on. */
	authorHandle: string | null;
	/** The signed-in owner (edit links) rather than a reader with the public link. */
	owner: boolean;
	prefs: ReaderPrefs;
};
