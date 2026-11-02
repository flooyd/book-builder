// Manuscript insights: what can be counted from a book's story text, with no AI involved. Every
// figure here is a plain tally of the saved text, so a writer can check any of them by hand.
//
// No imports, so it runs anywhere and stays easy to test. The server hands analyseManuscript a
// book's chapters and story-text parts in reading order (see $lib/server/insights), and pages only
// use the types. "Section" is the word here for either of those: the things a book is read in.

export type EntryKind = 'character' | 'place' | 'system';

/** A chapter, or a part that holds its own story text. */
export type SectionInput = {
	/** "chapter-12" or "part-3", as elsewhere. */
	key: string;
	target: 'chapter' | 'part';
	id: number;
	/** "Chapter 3", its own label, or a story-text part's title. */
	label: string;
	title: string;
	/** Its chapter number, if it has one. */
	number: number | null;
	/** Which of the book's parts it sits in, as an index into `groups`. */
	group: number;
	/** Its plain text, one line per paragraph. */
	lines: string[];
	/** Counted by countWords, so totals here match the rest of the app. */
	words: number;
	/** Mention nodes in its text, by entry ("character-1"). */
	mentions: Record<string, number>;
	/** Entries in its cast ("place-4"). */
	cast: string[];
};

export type GroupInput = {
	id: number;
	/** "Part One"; null for a part that holds story text. */
	label: string | null;
	title: string;
};

export type EntryInput = {
	type: EntryKind;
	id: number;
	name: string;
	/** Everything the story might call it: its name, short names and aliases. */
	names: string[];
};

export type ManuscriptInput = {
	sections: SectionInput[];
	groups: GroupInput[];
	entries: EntryInput[];
};

export type SectionInsight = Pick<
	SectionInput,
	'key' | 'target' | 'id' | 'label' | 'title' | 'number' | 'group' | 'words'
> & {
	/** Average words in a sentence; 0 with no text. */
	sentenceLength: number;
	/** How much of it is spoken aloud, from 0 to 1. */
	dialogue: number;
	/** Length against the typical chapter: 1.5 is half as long again. Null with no text. */
	ratio: number | null;
	flag: 'long' | 'short' | null;
};

/** A line of the story with the counted words picked out. */
export type Example = { section: number; before: string; match: string; after: string };

/** A word or phrase and everywhere it falls. */
export type RepeatInsight = {
	text: string;
	/** Other spellings counted with it: "turned" also counts "turning" and "turns". */
	forms: string[];
	count: number;
	/** Used once in every this many words. */
	every: number;
	/** Uses per section, as [section index, count], in reading order. */
	spread: [section: number, count: number][];
	/** The section holding at least half of its uses, when it appears in more than one. */
	peak: number | null;
	examples: Example[];
};

/** A stretch of written chapters an entry sits out. */
export type Gap = {
	/** The section it was last in. */
	from: number;
	/** The section it comes back in; null if it never does. */
	to: number | null;
	sections: number;
	words: number;
};

export type EntryInsight = {
	type: EntryKind;
	id: number;
	name: string;
	/** The sections it's in. `uses` counts its name in the text; `cast` is the chosen cast. */
	cells: { section: number; uses: number; cast: boolean }[];
	/** How many written sections it's in. */
	appearances: number;
	first: number | null;
	gap: Gap | null;
	/** Its longest gap is long enough to be worth a look. */
	quiet: boolean;
};

/** Something in the numbers worth a writer's attention, and which part of the page says more. */
export type Finding = { area: 'pacing' | 'words' | 'cast'; title: string; body: string };

export type ManuscriptInsights = {
	totals: {
		words: number;
		/** Sections with story text. */
		written: number;
		/** Every section, written or not. */
		planned: number;
		/** The middle chapter's length: half run longer, half shorter. */
		typical: number;
		sentenceLength: number;
		dialogue: number;
	};
	groups: GroupInput[];
	sections: SectionInsight[];
	repeats: { common: RepeatInsight[]; habits: RepeatInsight[]; phrases: RepeatInsight[] };
	entries: EntryInsight[];
	findings: Finding[];
};

// ---- Word lists ------------------------------------------------------------------------------

const list = (words: string) => new Set(words.split(/\s+/));

/** Words every book needs, which say nothing about this one. Dialogue tags are among them. */
const STOP_WORDS = list(`
	a about above across after afterwards again against ago ahead all alone along already also
	although always am among an and another any anybody anyone anything anywhere are around as ask
	asked asking asks at away back be became because become becomes been before began begin behind
	being below beneath beside besides between beyond both bring brought but by came can cannot come
	comes coming could did do does doing done down during each either else enough even ever every
	everybody everyone everything everywhere except few find finding finds first five for found four
	from gave get gets getting give given gives giving go goes going gone got had has have having he
	her here hers herself him himself his how however i if in indeed inside instead into is it its
	itself keep keeping keeps kept knew know knowing known knows last later least less let lets like
	made make makes making many may me might mine more most much must my myself near need needed
	needs neither never next nine no nobody none nor not nothing now of off often oh ok okay on once
	one only onto or other others ought our ours ourselves out outside over own per put puts putting
	said same saw say saying says second see seeing seen sees set seven several shall she should
	since six so some somebody someone something sometimes somewhere soon still such take taken takes
	taking tell telling tells ten than that the their theirs them themselves then there these they
	third this those though thought three through thus till to told too took toward towards tried
	tries try trying two under until unto up upon us use used uses using want wanted wanting wants
	was way ways we well went were what whatever when whenever where whether which while who whoever
	whole whom whose why will with within without would yes yet you your yours yourself yourselves
`);

/**
 * The fillers, hedges and stage directions that creep into a draft. They're counted whether or not
 * they're stop words, and never in the plain list of common words, which would only repeat them.
 */
const HABIT_WORDS = `
	just really very quite rather somehow somewhat actually basically literally simply suddenly
	almost nearly perhaps maybe probably certainly definitely obviously clearly totally completely
	absolutely seem felt thing stuff look glance nod shrug sigh smile grin frown turn
`
	.trim()
	.split(/\s+/);

const HABIT_PHRASES = [
	'a bit',
	'a little',
	'kind of',
	'sort of',
	'began to',
	'started to',
	'managed to',
	'tried to',
	'in order to',
	'for a moment',
	'at that moment',
	'the fact that',
	'all of a sudden',
	'of course'
];

// ---- Reading the text ------------------------------------------------------------------------

/** A word: letters and digits, kept whole across an apostrophe or a hyphen. */
const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

const ABBREVIATION = /^(?:mr|mrs|ms|dr|st|prof|capt|sgt|lt|col|gen|rev)$/i;
const INITIAL = /^[A-HJ-Z]$/;
const CAPITAL = /^\p{Lu}/u;
const OPENS_SENTENCE = /^[\p{Lu}\p{N}]/u;

const withoutPossessive = (word: string) => word.replace(/['’]s$/i, '');

/** The form a word is compared in: lower case, straight apostrophes, no possessive. */
const plainForm = (word: string) => withoutPossessive(word).toLowerCase().replaceAll('’', "'");

const hasVowel = (word: string) => /[aeiouy]/.test(word);

/**
 * A key that "turn", "turns", "turned" and "turning" all share, so a habit counts once however it's
 * spelled. It's only ever compared, never shown, so it needn't be a real word. Irregular forms
 * ("sang") stay apart, which errs towards counting too little rather than inventing a pattern.
 */
export function stem(word: string) {
	let result = word;
	if (result.length > 4 && /ie[sd]$/.test(result)) result = `${result.slice(0, -3)}y`;
	else if (result.length > 4 && /(?:ch|sh|ss|x|z)es$/.test(result)) result = result.slice(0, -2);
	else if (result.length > 3 && result.endsWith('s') && !/(?:ss|us|is)$/.test(result)) {
		result = result.slice(0, -1);
	}

	const suffix = /ing$/.test(result) ? 3 : /[^e]ed$/.test(result) ? 2 : 0;
	const base = suffix ? result.slice(0, -suffix) : result;
	if (suffix && base.length >= 3 && hasVowel(base)) {
		// "stopped" to "stop", but "falling" to "fall".
		result = /([^aeiouylsz])\1$/.test(base) ? base.slice(0, -1) : base;
	}
	return result.length > 3 && result.endsWith('e') ? result.slice(0, -1) : result;
}

const HABIT_KEYS = new Set(HABIT_WORDS.map(stem));
const HABIT_PHRASE_SET = new Set(HABIT_PHRASES);
const HABIT_PHRASE_LENGTHS = [...new Set(HABIT_PHRASES.map((phrase) => phrase.split(' ').length))];

type Spot = { section: number; line: number; start: number; end: number };

type Tally = {
	count: number;
	/** How often each spelling appears. */
	forms: Record<string, number>;
	spread: Map<number, number>;
	spots: Spot[];
	/** Uses in lower case, and with a capital away from the start of a sentence. */
	lower: number;
	capital: number;
};

const SPOTS_PER_SECTION = 2;
const SPOTS_KEPT = 24;

/** Where a tally goes in `tallies`; made on first use. */
function tallyOf(tallies: Map<string, Tally>, key: string) {
	let tally = tallies.get(key);
	if (!tally) {
		tally = { count: 0, forms: {}, spread: new Map(), spots: [], lower: 0, capital: 0 };
		tallies.set(key, tally);
	}
	return tally;
}

function count(tally: Tally, form: string, spot: Spot) {
	const here = tally.spread.get(spot.section) ?? 0;
	tally.count += 1;
	tally.forms[form] = (tally.forms[form] ?? 0) + 1;
	tally.spread.set(spot.section, here + 1);
	if (here < SPOTS_PER_SECTION && tally.spots.length < SPOTS_KEPT) tally.spots.push(spot);
}

type Quote = '' | 'double' | 'single';

/** The quotation in force after this run of punctuation. The first to open holds until it closes. */
function quoteAfter(punctuation: string, quote: Quote): Quote {
	let current = quote;
	for (const character of punctuation) {
		if (character === '“' && !current) current = 'double';
		else if (character === '”' && current === 'double') current = '';
		else if (character === '"' && current !== 'single') current = current ? '' : 'double';
		else if (character === '‘' && !current) current = 'single';
		else if (character === '’' && current === 'single') current = '';
	}
	return current;
}

/**
 * Whether a sentence ends in the punctuation between two words. A full stop after "Dr" doesn't
 * count, and nor does one before a small letter: “Stop!” she said, is one sentence.
 */
const endsSentence = (punctuation: string, previous: string, next: string) =>
	/[.!?…]/.test(punctuation) &&
	OPENS_SENTENCE.test(next) &&
	!ABBREVIATION.test(previous) &&
	!INITIAL.test(previous);

type NameMatch = { rest: string[]; entries: string[] };
type NameIndex = Map<string, NameMatch[]>;

/**
 * Every name the story might use, by its first word, so a line is checked once however many
 * entries there are. Names match as written: "Ade" isn't "made", and a lower-case alias ("the
 * captain") also matches with a capital, for the start of a sentence.
 */
function nameIndex(entries: EntryInput[]) {
	const index: NameIndex = new Map();
	for (const entry of entries) {
		const key = `${entry.type}-${entry.id}`;
		const spellings = entry.names.flatMap((name) => {
			const capitalised = name.charAt(0).toUpperCase() + name.slice(1);
			return capitalised === name ? [name] : [name, capitalised];
		});
		for (const spelling of new Set(spellings)) {
			const [first, ...rest] = (spelling.match(WORD) ?? []).map(withoutPossessive);
			if (!first) continue;
			const options = index.get(first) ?? [];
			const same = options.find((option) => option.rest.join(' ') === rest.join(' '));
			if (same) {
				if (!same.entries.includes(key)) same.entries.push(key);
			} else {
				options.push({ rest, entries: [key] });
				// Longest first, so "Juno Halley" isn't read as "Juno" with a word left over.
				options.sort((a, b) => b.rest.length - a.rest.length);
				index.set(first, options);
			}
		}
	}
	return index;
}

/** The words names are made of. They'd only crowd the list of common words. */
function nameWords(entries: EntryInput[]) {
	const words = new Set<string>();
	for (const entry of entries) {
		for (const name of entry.names) {
			for (const word of name.match(WORD) ?? []) words.add(stem(plainForm(word)));
		}
	}
	return words;
}

type SectionTally = {
	tokens: number;
	sentences: number;
	spoken: number;
	/** Times the text uses each entry's name. */
	named: Record<string, number>;
};

type Tallies = {
	words: Map<string, Tally>;
	phrases: Map<string, Tally>;
	habits: Map<string, Tally>;
};

const isContent = (form: string) => !STOP_WORDS.has(form) && !form.includes("'");

/** Phrases of three to five words, kept within a sentence, and any habit phrases among them. */
function countPhrases(
	sentence: { form: string; start: number; end: number }[],
	section: number,
	line: number,
	tallies: Tallies
) {
	const forms = sentence.map((word) => word.form);
	const at = (index: number, length: number): Spot => ({
		section,
		line,
		start: sentence[index].start,
		end: sentence[index + length - 1].end
	});

	for (let start = 0; start < forms.length; start++) {
		for (const length of HABIT_PHRASE_LENGTHS) {
			if (start + length > forms.length) continue;
			const phrase = forms.slice(start, start + length).join(' ');
			if (HABIT_PHRASE_SET.has(phrase)) {
				count(tallyOf(tallies.habits, phrase), phrase, at(start, length));
			}
		}
		for (const length of [3, 4, 5]) {
			if (start + length > forms.length) continue;
			const run = forms.slice(start, start + length);
			if (!run.some(isContent)) continue;
			const phrase = run.join(' ');
			count(tallyOf(tallies.phrases, phrase), phrase, at(start, length));
		}
	}
}

function readLine(
	text: string,
	section: number,
	line: number,
	names: NameIndex,
	tallies: Tallies,
	result: SectionTally
) {
	const tokens = [...text.matchAll(WORD)];
	let quote: Quote = '';
	let sentence: { form: string; start: number; end: number }[] = [];
	// Whether the next word opens a sentence or a quotation, so a capital proves nothing.
	let opening = true;
	let last = 0;

	const close = () => {
		if (sentence.length === 0) return;
		result.sentences += 1;
		countPhrases(sentence, section, line, tallies);
		sentence = [];
	};

	for (let index = 0; index < tokens.length; index++) {
		const word = tokens[index][0];
		const start = tokens[index].index;
		const end = start + word.length;
		const punctuation = text.slice(last, start);

		const previous = tokens[index - 1]?.[0] ?? '';
		if (sentence.length > 0 && endsSentence(punctuation, previous, word)) {
			close();
			opening = true;
		}
		const wasQuoted = quote;
		quote = quoteAfter(punctuation, quote);
		if (quote && !wasQuoted) opening = true;

		result.tokens += 1;
		if (quote) result.spoken += 1;

		const form = plainForm(word);
		sentence.push({ form, start, end });

		const key = stem(form);
		const habit = HABIT_KEYS.has(key);
		if (habit || (form.length > 2 && isContent(form) && !/\d/.test(form))) {
			const tally = tallyOf(tallies.words, key);
			count(tally, form, { section, line, start, end });
			if (CAPITAL.test(word)) {
				if (!opening) tally.capital += 1;
			} else {
				tally.lower += 1;
			}
		}

		opening = false;
		last = end;
	}
	close();

	for (let index = 0; index < tokens.length; index++) {
		const options = names.get(withoutPossessive(tokens[index][0]));
		const found = options?.find((option) =>
			option.rest.every(
				(word, offset) => withoutPossessive(tokens[index + 1 + offset]?.[0] ?? '') === word
			)
		);
		if (!found) continue;
		for (const entry of found.entries) result.named[entry] = (result.named[entry] ?? 0) + 1;
		index += found.rest.length;
	}
}

// ---- Turning tallies into insights -----------------------------------------------------------

const LIST_LENGTH = 24;
/** The longest list of phrases worth comparing with each other. */
const PHRASE_POOL = 400;
const EXAMPLES = 4;
/** Characters of the story to show on each side of a counted word. */
const REACH = 70;

/** Part of a line around a word, cut between words. */
function excerpt(text: string, start: number, end: number) {
	let from = Math.max(0, start - REACH);
	let to = Math.min(text.length, end + REACH);
	if (from > 0) {
		const space = text.indexOf(' ', from);
		if (space !== -1 && space < start) from = space + 1;
	}
	if (to < text.length) {
		const space = text.lastIndexOf(' ', to);
		if (space > end) to = space;
	}
	return {
		before: `${from > 0 ? '…' : ''}${text.slice(from, start)}`,
		match: text.slice(start, end),
		after: `${text.slice(end, to)}${to < text.length ? '…' : ''}`
	};
}

/** A few uses of a word, from as many chapters as possible, in reading order. */
function examplesOf(tally: Tally, sections: SectionInput[]): Example[] {
	const chosen = tally.spots.filter(
		(spot, index) => tally.spots.findIndex((other) => other.section === spot.section) === index
	);
	for (const spot of tally.spots) {
		if (chosen.length >= EXAMPLES) break;
		if (!chosen.includes(spot)) chosen.push(spot);
	}
	return chosen
		.slice(0, EXAMPLES)
		.sort((a, b) => a.section - b.section || a.line - b.line || a.start - b.start)
		.map((spot) => ({
			section: spot.section,
			...excerpt(sections[spot.section].lines[spot.line], spot.start, spot.end)
		}));
}

function repeatInsight(tally: Tally, sections: SectionInput[], words: number): RepeatInsight {
	const forms = Object.entries(tally.forms)
		.sort((a, b) => b[1] - a[1])
		.map(([form]) => form);
	const spread = [...tally.spread].sort((a, b) => a[0] - b[0]);
	const [busiest, uses] = spread.reduce((most, next) => (next[1] > most[1] ? next : most));
	return {
		text: forms[0],
		forms: forms.slice(1),
		count: tally.count,
		every: Math.max(1, Math.round(words / tally.count)),
		spread,
		peak: spread.length > 1 && uses * 2 >= tally.count ? busiest : null,
		examples: examplesOf(tally, sections)
	};
}

/** A word that's capitalised wherever it can be told apart: a name nobody has put in the bible. */
const isProperNoun = (tally: Tally) => tally.capital > 0 && tally.capital >= tally.lower;

/** Every run of three words in a phrase, for telling when two phrases overlap. */
function threes(phrase: string) {
	const words = phrase.split(' ');
	return words.slice(0, -2).map((word, index) => `${word} ${words[index + 1]} ${words[index + 2]}`);
}

/**
 * Phrases worth a look, without the fragments of longer ones: "the long way" says nothing new
 * when "the long way home" turns up about as often. A sentence repeated whole would otherwise fill
 * the list with its overlapping stretches, so any phrase sharing three words in a row with one
 * already kept goes too.
 */
function topPhrases(tallies: Map<string, Tally>, minimum: number) {
	const pool = [...tallies]
		.filter(([phrase, tally]) => tally.count >= minimum && !HABIT_PHRASE_SET.has(phrase))
		.sort((a, b) => b[1].count - a[1].count)
		.slice(0, PHRASE_POOL)
		.sort((a, b) => b[0].length - a[0].length);

	const kept: { tally: Tally; runs: Set<string> }[] = [];
	for (const [phrase, tally] of pool) {
		const own = threes(phrase);
		const covered = kept.some(
			(other) => other.tally.count >= tally.count * 0.75 && own.some((run) => other.runs.has(run))
		);
		if (!covered) kept.push({ tally, runs: new Set(own) });
	}
	return kept.map((item) => item.tally).sort((a, b) => b.count - a.count);
}

function median(values: number[]) {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

/** Chapters to compare before calling one long or short. */
const ENOUGH_CHAPTERS = 4;
const LONG_RATIO = 1.6;
const SHORT_RATIO = 0.5;
/** Words either side of typical that don't merit a flag, however the ratio falls. */
const LENGTH_MARGIN = 300;

/** Written sections to compare before saying someone has gone missing. */
const ENOUGH_FOR_GAPS = 6;
const QUIET_SECTIONS = 3;
const QUIET_SHARE = 0.12;

/** Below this share of dialogue a chapter is nearly silent. */
const SILENT = 0.05;
const TALKATIVE_BOOK = 0.15;
const SILENT_RUN = 3;

function lengthFlag(
	section: SectionInput,
	index: number,
	typical: number,
	chapters: number,
	lastWritten: number
): SectionInsight['flag'] {
	if (chapters < ENOUGH_CHAPTERS || section.words === 0 || section.target !== 'chapter')
		return null;
	if (section.words >= typical * LONG_RATIO && section.words >= typical + LENGTH_MARGIN) {
		return 'long';
	}
	// The newest chapter is short because it's still being written.
	if (
		index !== lastWritten &&
		section.words <= typical * SHORT_RATIO &&
		section.words <= typical - LENGTH_MARGIN
	) {
		return 'short';
	}
	return null;
}

function entryInsight(
	entry: EntryInput,
	sections: SectionInput[],
	read: SectionTally[],
	words: number
): EntryInsight {
	const key = `${entry.type}-${entry.id}`;
	const cells = sections.flatMap((section, index) => {
		// Mentions are names in the text too, so whichever finds more has found them all.
		const uses = Math.max(section.mentions[key] ?? 0, read[index].named[key] ?? 0);
		const cast = section.cast.includes(key);
		return uses > 0 || cast ? [{ section: index, uses, cast }] : [];
	});

	// Gaps are measured across written sections only: an empty chapter isn't an absence.
	const present = new Set(cells.map((cell) => cell.section));
	let gap: Gap | null = null;
	let from: number | null = null;
	let absent = 0;
	let absentWords = 0;
	const consider = (to: number | null) => {
		if (from !== null && absent > 0 && absentWords > (gap?.words ?? 0)) {
			gap = { from, to, sections: absent, words: absentWords };
		}
	};
	let appearances = 0;
	let written = 0;
	let first: number | null = null;
	sections.forEach((section, index) => {
		if (section.words === 0) return;
		written += 1;
		if (present.has(index)) {
			consider(index);
			appearances += 1;
			first ??= index;
			from = index;
			absent = 0;
			absentWords = 0;
		} else {
			absent += 1;
			absentWords += section.words;
		}
	});
	consider(null);

	const longest = gap as Gap | null;
	return {
		type: entry.type,
		id: entry.id,
		name: entry.name,
		cells,
		appearances,
		first,
		gap: longest,
		quiet:
			written >= ENOUGH_FOR_GAPS &&
			appearances >= 2 &&
			longest !== null &&
			longest.sections >= QUIET_SECTIONS &&
			longest.words >= words * QUIET_SHARE
	};
}

const number = (value: number) => value.toLocaleString('en');
const chapters = (count: number) => `${number(count)} ${count === 1 ? 'chapter' : 'chapters'}`;

/** The longest run of nearly silent sections, as indexes into `sections`. */
function silentRun(sections: SectionInsight[]) {
	const written = sections.flatMap((section, index) => (section.words > 0 ? [index] : []));
	let best: number[] = [];
	let run: number[] = [];
	for (const index of written) {
		run = sections[index].dialogue < SILENT ? [...run, index] : [];
		if (run.length > best.length) best = run;
	}
	return best;
}

function findingsOf(
	sections: SectionInsight[],
	entries: EntryInsight[],
	repeats: ManuscriptInsights['repeats'],
	totals: ManuscriptInsights['totals']
) {
	const pacing: Finding[] = [...sections]
		.filter((section) => section.flag)
		.sort((a, b) => Math.abs(Math.log(b.ratio ?? 1)) - Math.abs(Math.log(a.ratio ?? 1)))
		.slice(0, 2)
		.map((section) => ({
			area: 'pacing',
			title: `${section.label} runs ${section.flag}`,
			body:
				section.flag === 'long'
					? `“${section.title}” is ${number(section.words)} words, ${(section.ratio ?? 1).toFixed(1)} times your typical chapter.`
					: `“${section.title}” is ${number(section.words)} words, against a typical ${number(totals.typical)}.`
		}));

	const silent = silentRun(sections);
	if (silent.length >= SILENT_RUN && totals.dialogue >= TALKATIVE_BOOK) {
		const first = sections[silent[0]];
		const last = sections[silent[silent.length - 1]];
		pacing.push({
			area: 'pacing',
			title: `Nobody says much from ${first.label} to ${last.label}`,
			body: `Under ${Math.round(SILENT * 100)}% of those chapters is dialogue, and ${Math.round(totals.dialogue * 100)}% of the whole book is.`
		});
	}

	const cast: Finding[] = entries
		.filter((entry) => entry.quiet && entry.gap)
		.sort((a, b) => (b.gap?.words ?? 0) - (a.gap?.words ?? 0))
		.slice(0, 2)
		.map((entry) => {
			const gap = entry.gap as Gap;
			const since = sections[gap.from].label;
			return {
				area: 'cast',
				title: `${entry.name} goes quiet`,
				body:
					gap.to === null
						? `Not seen since ${since}, ${chapters(gap.sections)} and ${number(gap.words)} words ago.`
						: `Gone for ${chapters(gap.sections)} and ${number(gap.words)} words, from ${since} to ${sections[gap.to].label}.`
			};
		});

	const words: Finding[] = [];
	const habit = repeats.habits[0];
	if (habit && habit.count >= 5 && habit.every <= 500) {
		words.push({
			area: 'words',
			title: `You lean on “${habit.text}”`,
			body: `It turns up about once every ${number(habit.every)} words.`
		});
	}
	const common = repeats.common[0];
	if (common && common.count >= 8 && common.every <= 250) {
		words.push({
			area: 'words',
			title: `“${common.text}” is everywhere`,
			body: `${number(common.count)} uses, about once every ${number(common.every)} words.`
		});
	}
	const phrase = repeats.phrases[0];
	if (phrase && phrase.count >= 4) {
		words.push({
			area: 'words',
			title: `“${phrase.text}” keeps coming back`,
			body: `${number(phrase.count)} times, across ${chapters(phrase.spread.length)}.`
		});
	}

	return [...pacing, ...cast, ...words];
}

/** Everything the insights page shows. */
export function analyseManuscript({
	sections,
	groups,
	entries
}: ManuscriptInput): ManuscriptInsights {
	const names = nameIndex(entries);
	const namesWords = nameWords(entries);
	const tallies: Tallies = { words: new Map(), phrases: new Map(), habits: new Map() };

	const read = sections.map((section, index) => {
		const result: SectionTally = { tokens: 0, sentences: 0, spoken: 0, named: {} };
		section.lines.forEach((line, lineIndex) =>
			readLine(line, index, lineIndex, names, tallies, result)
		);
		return result;
	});

	const words = sections.reduce((sum, section) => sum + section.words, 0);
	const tokens = read.reduce((sum, section) => sum + section.tokens, 0);
	const sentences = read.reduce((sum, section) => sum + section.sentences, 0);
	const spoken = read.reduce((sum, section) => sum + section.spoken, 0);

	const written = sections.filter((section) => section.words > 0);
	const writtenChapters = written.filter((section) => section.target === 'chapter');
	// A short prologue shouldn't pull the typical chapter down, unless it's all the book has.
	const typical = median(
		(writtenChapters.length > 0 ? writtenChapters : written).map((section) => section.words)
	);
	const lastWritten = sections.findLastIndex((section) => section.words > 0);

	const sectionInsights = sections.map((section, index): SectionInsight => {
		const tally = read[index];
		return {
			key: section.key,
			target: section.target,
			id: section.id,
			label: section.label,
			title: section.title,
			number: section.number,
			group: section.group,
			words: section.words,
			sentenceLength: tally.sentences ? tally.tokens / tally.sentences : 0,
			dialogue: tally.tokens ? tally.spoken / tally.tokens : 0,
			ratio: section.words > 0 && typical > 0 ? section.words / typical : null,
			flag: lengthFlag(section, index, typical, writtenChapters.length, lastWritten)
		};
	});

	const insight = (tally: Tally) => repeatInsight(tally, sections, words);
	const wordTallies = [...tallies.words];
	const repeated = Math.max(3, Math.ceil(words / 25_000));

	const repeats = {
		common: wordTallies
			.filter(
				([key, tally]) =>
					tally.count >= repeated &&
					!HABIT_KEYS.has(key) &&
					!namesWords.has(key) &&
					!isProperNoun(tally)
			)
			.sort((a, b) => b[1].count - a[1].count)
			.slice(0, LIST_LENGTH)
			.map(([, tally]) => insight(tally)),
		habits: [
			...wordTallies.filter(([key]) => HABIT_KEYS.has(key)).map(([, tally]) => tally),
			...tallies.habits.values()
		]
			.filter((tally) => tally.count >= 2)
			.sort((a, b) => b.count - a.count)
			.slice(0, LIST_LENGTH)
			.map(insight),
		phrases: topPhrases(tallies.phrases, repeated).slice(0, LIST_LENGTH).map(insight)
	};

	const entryInsights = entries
		.map((entry) => entryInsight(entry, sections, read, words))
		.sort((a, b) => b.appearances - a.appearances || a.name.localeCompare(b.name));

	const totals = {
		words,
		written: written.length,
		planned: sections.length,
		typical,
		sentenceLength: sentences ? tokens / sentences : 0,
		dialogue: tokens ? spoken / tokens : 0
	};

	return {
		totals,
		groups,
		sections: sectionInsights,
		repeats,
		entries: entryInsights,
		findings: findingsOf(sectionInsights, entryInsights, repeats, totals)
	};
}
