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
export type ReaderPrefs = { size: number; face: Typeface };

/** Kept in a cookie so the server renders the book at the reader's size (no reflow on load). */
export const READER_COOKIE = 'bb-reader';

export const DEFAULT_PREFS: ReaderPrefs = { size: 2, face: 'serif' };

/** Cookie value "<size index>-<typeface>", e.g. "3-sans". */
export function parseReaderPrefs(value: string | undefined): ReaderPrefs {
	const [size, face] = (value ?? '').split('-');
	const index = Number(size);
	return {
		size:
			size && Number.isInteger(index) && index >= 0 && index < TEXT_SIZES.length
				? index
				: DEFAULT_PREFS.size,
		face: face === 'sans' ? 'sans' : 'serif'
	};
}

export function saveReaderPrefs(prefs: ReaderPrefs) {
	document.cookie = `${READER_COOKIE}=${prefs.size}-${prefs.face}; path=/; max-age=31536000; samesite=lax`;
}

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
	/** The signed-in owner (edit links) rather than a reader with the public link. */
	owner: boolean;
	prefs: ReaderPrefs;
};
