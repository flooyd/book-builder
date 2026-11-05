// The story bible: the characters, places and systems of a writer's world, and how story text
// mentions them. Shared by the browser and the server, so nothing here needs either.

export const ENTRY_TYPES = ['character', 'place', 'system'] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export const isEntryType = (value: unknown): value is EntryType =>
	ENTRY_TYPES.includes(value as EntryType);

/** A labelled fact on an entry's page: "Role: captain of the Meridian". */
export type EntryDetail = { label: string; value: string };

/** What every entry has; places and systems also have a free-form `kind`. */
export type EntryFields = {
	id: number;
	name: string;
	description: string;
	/** Short names to mention it by: "Juno", "the captain". */
	aliases: string[];
	details: EntryDetail[];
	/** Formatted like a description (see $lib/rich). */
	notes: string;
	/** Books it belongs to, from its link table. */
	bookIds: number[];
	userId: string;
	createdAt: string;
	updatedAt: string;
};

/** Where in a book entries appear: a chapter, or a part that holds its own story text. */
export type CastTarget = 'part' | 'chapter';

/** Who and what a chapter or story-text part holds, by type of entry. */
export type Cast = Record<EntryType, number[]>;

export const NO_CAST: Cast = { character: [], place: [], system: [] };

/** A place in the story an entry appears: its chapter, or a part that holds story text. */
export type Appearance = {
	target: CastTarget;
	id: number;
	/** Times the story text names it there: @ mentions, and its names written out. */
	uses: number;
	/** It's in that chapter's or part's cast. */
	cast: boolean;
};

/** A connection between two entries, reading from → to: Juno is "Captain of" the Meridian. */
export type Connection = {
	id: number;
	fromType: string;
	fromId: number;
	toType: string;
	toId: number;
	label: string;
};

/** How each type of entry is named, in the words of the app. */
export const ENTRY_COPY: Record<
	EntryType,
	{ one: string; many: string; api: string; icon: 'users' | 'map-pin' | 'share-2' }
> = {
	character: { one: 'character', many: 'Characters', api: '/api/characters', icon: 'users' },
	place: { one: 'place', many: 'Places', api: '/api/places', icon: 'map-pin' },
	system: { one: 'system', many: 'Systems', api: '/api/systems', icon: 'share-2' }
};

/** Suggestions for the free-form kind of a place or a system. */
export const KIND_SUGGESTIONS: Record<'place' | 'system', string[]> = {
	place: ['City', 'Moon', 'Planet', 'Station', 'Ship', 'Region', 'Building'],
	system: ['Magic', 'Law', 'Trade', 'Politics', 'Religion', 'Technology', 'Nature']
};

/** Details a writer often wants, offered as one-tap labels on an entry's page. */
export const DETAIL_SUGGESTIONS: Record<EntryType, string[]> = {
	character: ['Role', 'Age', 'Appearance', 'Wants', 'Fears', 'Voice', 'Secret'],
	place: ['Climate', 'Population', 'Ruled by', 'Known for', 'Dangers', 'History'],
	system: ['Source', 'Rules', 'Costs', 'Limits', 'Who uses it', 'History']
};

export const ALIAS_LIMIT = 20;
export const ALIAS_LENGTH = 80;
export const DETAIL_LIMIT = 40;
export const DETAIL_LABEL_LENGTH = 60;
export const DETAIL_VALUE_LENGTH = 4000;

/** Short names as a writer types them: trimmed, without repeats, and within the limits. */
export function cleanAliases(value: unknown, name = ''): string[] {
	if (!Array.isArray(value)) return [];
	const seen = [name.toLowerCase()];
	const aliases: string[] = [];
	for (const item of value) {
		if (typeof item !== 'string') continue;
		const alias = item.trim().slice(0, ALIAS_LENGTH);
		if (!alias || seen.includes(alias.toLowerCase())) continue;
		seen.push(alias.toLowerCase());
		aliases.push(alias);
	}
	return aliases.slice(0, ALIAS_LIMIT);
}

/** Details as stored: a blank row is dropped, and each one is kept within the limits. */
export function cleanDetails(value: unknown): EntryDetail[] {
	if (!Array.isArray(value)) return [];
	const details: EntryDetail[] = [];
	for (const item of value) {
		const label = typeof item?.label === 'string' ? item.label.trim() : '';
		const text = typeof item?.value === 'string' ? item.value.trim() : '';
		if (!label && !text) continue;
		details.push({
			label: label.slice(0, DETAIL_LABEL_LENGTH),
			value: text.slice(0, DETAIL_VALUE_LENGTH)
		});
	}
	return details.slice(0, DETAIL_LIMIT);
}

// ---- Choosing an entry to mention ---------------------------------------------------------------

/** Words a full name can open with that no one goes by alone: not "Mr", and not "the". */
const NOT_A_NAME =
	/^(?:the|a|an|of|mr|mrs|ms|mx|miss|dr|sir|lady|lord|madam|prof|professor|capt|captain|col|colonel|gen|general|lt|lieutenant|sgt|sergeant|rev|reverend|father|sister|brother|uncle|aunt|king|queen|prince|princess)\.?$/i;

/** The first word of a name, when that's a name by itself: "Juno" of "Juno Halley". */
export function firstName(name: string) {
	const [first, ...rest] = name.trim().split(/\s+/);
	return rest.length > 0 && !NOT_A_NAME.test(first) ? first : null;
}

/** What a story shortens a full name to from the other end: "Holmes", "Darcy" for Mr. Darcy. */
export function lastName(name: string) {
	const words = name.trim().split(/\s+/);
	const [last, before] = [words.at(-1) ?? '', words.at(-2) ?? ''];
	// "Juno of Kesh" isn't a Kesh, and "The Hatter" is the Hatter, not a surname.
	return before && /^\p{Lu}/u.test(last) && /^\p{Lu}/u.test(before) && !/^the$/i.test(before)
		? last
		: null;
}

/**
 * The name to put in the story when a mention's entry is renamed. Mentions keep the words the
 * writer chose, so only the full name and the first name follow; an alias is the writer's own.
 */
export function renamedLabel(label: string, before: string, after: string) {
	if (label === before) return after;
	const first = firstName(before);
	return first && label === first ? (firstName(after) ?? after) : label;
}

export type MentionChoice = {
	type: EntryType;
	id: number;
	/** The entry's full name. */
	name: string;
	/** The words to put in the story, which may be a short name. */
	label: string;
	/** It isn't in this book yet: mentioning it brings it in. */
	elsewhere: boolean;
	/** Elsewhere, but in another book of this one's series. */
	series: boolean;
};

/** How well `text` answers `query`: 0 is no match, higher is better. */
function matchScore(text: string, query: string) {
	const lower = text.toLowerCase();
	if (lower === query) return 4;
	if (lower.startsWith(query)) return 3;
	if (lower.split(/\s+/).some((word) => word.startsWith(query))) return 2;
	return lower.includes(query) ? 1 : 0;
}

export type SearchableEntry = Pick<EntryFields, 'id' | 'name' | 'aliases' | 'bookIds'> & {
	type: EntryType;
};

/** How far an entry is from the book: its own, its series', or somewhere else altogether. */
const distance = (choice: MentionChoice) => (!choice.elsewhere ? 0 : choice.series ? 1 : 2);

/**
 * What a query after @ could mean, best first: this book's entries, then those in `family` (the
 * other books in its series), then the rest. Short names only appear once the query reaches them,
 * so a bare @ lists each entry once, and only the entries from this book and its series.
 */
export function searchEntries(
	entries: SearchableEntry[],
	query: string,
	bookId: number,
	family: number[] = [],
	limit = 8
): MentionChoice[] {
	const needle = query.trim().toLowerCase();
	const ranked: { choice: MentionChoice; score: number; order: number }[] = [];

	entries.forEach((entry, order) => {
		const elsewhere = !entry.bookIds.includes(bookId);
		const series = elsewhere && entry.bookIds.some((id) => family.includes(id));
		const choice = (label: string): MentionChoice => ({
			type: entry.type,
			id: entry.id,
			name: entry.name,
			label,
			elsewhere,
			series
		});
		if (!needle) {
			if (!elsewhere || series) ranked.push({ choice: choice(entry.name), score: 0, order });
			return;
		}
		const score = matchScore(entry.name, needle);
		if (score) ranked.push({ choice: choice(entry.name), score, order });
		const short = firstName(entry.name);
		const labels = cleanAliases([...(short ? [short] : []), ...entry.aliases], entry.name);
		for (const alias of labels) {
			const aliasScore = matchScore(alias, needle);
			// A shade below the same match on the full name, so the full name stays on top.
			if (aliasScore) ranked.push({ choice: choice(alias), score: aliasScore - 0.5, order });
		}
	});

	return ranked
		.sort(
			(a, b) => distance(a.choice) - distance(b.choice) || b.score - a.score || a.order - b.order
		)
		.slice(0, limit)
		.map((item) => item.choice);
}

/** Whether a query already names an entry exactly, so offering to add it makes no sense. */
export const namesEntry = (choices: MentionChoice[], query: string) => {
	const needle = query.trim().toLowerCase();
	return choices.some((choice) => choice.label.toLowerCase() === needle);
};

// ---- Names in plain text ------------------------------------------------------------------------

type NamedEntry = Pick<EntryFields, 'id' | 'name' | 'aliases'> & { type: EntryType };

/** A name with a leading "the" or "a" taken off: "The Meridian" is plain "Meridian" as often. */
const withoutArticle = (name: string) => name.replace(/^(?:the|a|an)\s+/i, '');

/**
 * Everything the story might call an entry without an @: its name, that name without "the", its
 * aliases, and for people the first or last name alone. Only people go by a single word of their
 * name: the "Lantern" of the Lantern Gate could be any lantern at the start of a sentence.
 */
export function storyNames(entry: Omit<NamedEntry, 'id'>): string[] {
	const short = entry.type === 'character' ? [firstName(entry.name), lastName(entry.name)] : [];
	const names = [entry.name, withoutArticle(entry.name), ...short, ...entry.aliases];
	return [...new Set(names.filter((name): name is string => !!name?.trim()))];
}

/** Where a name sits in a run of text, and whose it is. */
export type NameSpot = { from: number; to: number; type: EntryType; id: number };

/** What an @ mention or a line break reads as when looking for names: no name runs across one. */
export const NOT_TEXT = '\uFFFC';

/** One spelling for space and apostrophe: the editor turns ' into ’ as the writer types. */
const spellingKey = (text: string) => text.replace(/\s+/g, ' ').replace(/’/g, "'");

/** A spelling as a pattern: any run of spaces between words, either apostrophe. */
const spellingPattern = (spelling: string) =>
	spelling
		.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
		.replace(/ /g, '\\s+')
		.replace(/'/g, "['’]");

/**
 * A finder for these entries' names in plain text, for linking them where the writer never typed
 * an @. Names match as written, so the verb "will" isn't Will, but a lower-case alias ("the
 * captain") also matches with a capital, for the start of a sentence. The longest name wins, so
 * "Juno Halley" is one name and not Juno and a word left over. A spelling that two entries share
 * goes to the one it's a name or alias of rather than a first or last name, and is left alone when
 * that doesn't settle it: a wrong link is worse than none.
 */
export function nameFinder(entries: NamedEntry[]): (text: string) => NameSpot[] {
	const claims: Record<string, { key: string; type: EntryType; id: number; rank: number }[]> = {};
	for (const entry of entries) {
		const own = [entry.name, withoutArticle(entry.name), ...entry.aliases].map(spellingKey);
		for (const name of storyNames(entry)) {
			const spelling = spellingKey(name.trim());
			// One letter is a word, not a name: an alias of "A" would link every "A" in the book.
			if ((spelling.match(/[\p{L}\p{N}]/gu) ?? []).length < 2) continue;
			const capital = spelling.charAt(0).toUpperCase() + spelling.slice(1);
			const rank = own.includes(spelling) ? 0 : 1;
			for (const form of new Set([spelling, capital])) {
				const list = (claims[form] ??= []);
				const key = `${entry.type}-${entry.id}`;
				const known = list.find((claim) => claim.key === key);
				if (known) known.rank = Math.min(known.rank, rank);
				else list.push({ key, type: entry.type, id: entry.id, rank });
			}
		}
	}

	const owners: Record<string, { type: EntryType; id: number }> = {};
	for (const [spelling, list] of Object.entries(claims)) {
		const best = Math.min(...list.map((claim) => claim.rank));
		const top = list.filter((claim) => claim.rank === best);
		if (top.length === 1) owners[spelling] = { type: top[0].type, id: top[0].id };
	}

	const spellings = Object.keys(owners).sort((a, b) => b.length - a.length);
	if (spellings.length === 0) return () => [];
	// Not inside a longer word, and not straight after an @, which is a mention being typed.
	const pattern = new RegExp(
		`(?<![\\p{L}\\p{N}\\p{M}_@])(?:${spellings.map(spellingPattern).join('|')})(?![\\p{L}\\p{N}\\p{M}_])`,
		'gu'
	);

	return (text) => {
		const spots: NameSpot[] = [];
		for (const match of text.matchAll(pattern)) {
			const owner = owners[spellingKey(match[0])];
			if (owner) spots.push({ from: match.index, to: match.index + match[0].length, ...owner });
		}
		return spots;
	};
}

/**
 * How many times each entry's name is written in some plain text, keyed "character-12", found as
 * the editor finds them: line by line, since a name never runs from one paragraph into the next.
 * Read @ mentions as NOT_TEXT first (see plainText in $lib/rich), or they count twice.
 */
export function countNames(text: string, find: (text: string) => NameSpot[]) {
	const counts: Record<string, number> = {};
	for (const line of text.split('\n')) {
		for (const spot of find(line)) {
			const key = `${spot.type}-${spot.id}`;
			counts[key] = (counts[key] ?? 0) + 1;
		}
	}
	return counts;
}
