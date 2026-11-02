// Word maps: the words a whole book is made of, and the words each character says, counted from the
// saved story text with no AI involved. $lib/speakers works out who says what; this tallies the
// result the same way the insights page does, so a word's count means the same thing on both.

import {
	WORD,
	countWord,
	isProperNoun,
	nameWords,
	plainForm,
	repeatInsight,
	type ManuscriptInput,
	type RepeatInsight,
	type SectionInput,
	type SectionSummary,
	type Tally
} from '$lib/insights';
import { NARRATOR, findSpeech, pronounsOf, speakerNames, type How } from '$lib/speakers';

/** A word on a map, with everything the page shows when it's opened. */
export type MapWord = RepeatInsight & {
	/** One of the story's names, which a writer can take off the map. */
	name: boolean;
	/** How much more it's theirs than anyone else's, on a character's map. Above 0 sets them apart. */
	own: number;
	/** Who says it, as [speaker key, times], on the whole book's map. */
	saidBy: [string, number][];
};

export type Speaker = {
	/** An entry's key ("character-1"), or NARRATOR. */
	key: string;
	/** Its entry's id; null for the narrator. */
	id: number | null;
	name: string;
	/** Lines and spoken words placed with them. */
	lines: number;
	words: number;
	/** How many chapters they speak in. */
	sections: number;
	map: MapWord[];
};

/** A line nobody could be placed with. */
export type UnplacedLine = { section: number; text: string };

export type WordMaps = {
	sections: SectionSummary[];
	/** Words in the book. */
	words: number;
	/** Characters in its story bible, who could be found speaking. */
	cast: number;
	book: MapWord[];
	speakers: Speaker[];
	spoken: {
		words: number;
		lines: number;
		/** Spoken words placed by each rule. */
		placed: Record<How, number>;
	};
	unplaced: { words: number; lines: number; examples: UnplacedLine[] };
	/** Names beside lines that aren't in the story bible. */
	strangers: { name: string; lines: number }[];
};

/** Words kept for a map. A cloud shows fewer on a phone, and the list shows them all. */
const BOOK_WORDS = 160;
const SPEAKER_WORDS = 80;
/** Words set apart from the rest, on top of the most used. */
const OWN_WORDS = 60;
/** Names kept on a map as well, so taking them off leaves it just as full. */
const MAP_NAMES = 30;
/** A word needs saying this often to be called anyone's own. */
const OWN_MINIMUM = 2;
/** Speakers to show, most talkative first. A book of hundreds has walk-ons to spare. */
const SPEAKERS = 40;
/** How many of them get a full map. The rest get half, which keeps a big cast's page light. */
const FULL_SPEAKERS = 12;
/** Lines to quote for a word on a speaker's map. There are a lot of maps to send. */
const SPEAKER_EXAMPLES = 3;
/** People to name under a word on the whole book's map. */
const SAID_BY = 5;
/** Unplaced lines to show, spread through the book. */
const UNPLACED_EXAMPLES = 40;
/** The longest stretch of an unplaced line to show. */
const UNPLACED_LENGTH = 220;
/** Times a name has to turn up beside a line before suggesting it for the bible. */
const STRANGER_MINIMUM = 2;
/** Only ever part of someone's name: "Miss" says nothing on a map, though "miss" might. */
const TITLE = /^(?:mr|mrs|ms|mx|miss|sir|dr|prof|rev)$/;

const wordCount = (text: string) => text.match(WORD)?.length ?? 0;

/** Tallies the words between two points in a line. */
function tallyRange(
	tallies: Map<string, Tally>,
	text: string,
	start: number,
	end: number,
	section: number,
	line: number
) {
	// Whether the next word opens a sentence or a quotation, so a capital proves nothing.
	let opening = true;
	let last = start;
	for (const match of text.slice(start, end).matchAll(WORD)) {
		const word = match[0];
		const from = start + match.index;
		const to = from + word.length;
		if (/[.!?…:“”"‘]/.test(text.slice(last, from))) opening = true;
		countWord(tallies, word, plainForm(word), opening, { section, line, start: from, end: to });
		opening = false;
		last = to;
	}
}

/** How much more someone leans on a word than everyone else, as a share of what each one says. */
function ownness(count: number, total: number, everyone: number, everyoneTotal: number) {
	const rest = everyone - count;
	const restTotal = everyoneTotal - total;
	if (restTotal <= 0) return 0;
	const here = (count + 0.5) / (total + 1);
	const there = (rest + 0.5) / (restTotal + 1);
	return count * Math.log(here / there);
}

const totalOf = (tallies: Map<string, Tally>) =>
	[...tallies.values()].reduce((sum, tally) => sum + tally.count, 0);

const titled = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

type Voice = {
	tallies: Map<string, Tally>;
	lines: number;
	words: number;
	sections: Set<number>;
};

const withoutTitles = (tallies: Map<string, Tally>) =>
	[...tallies].filter(
		([, tally]) =>
			!isProperNoun(tally) || !Object.keys(tally.forms).some((form) => TITLE.test(form))
	);

/** The most used of a tally, with enough names kept apart that a map can do without them. */
function topWords(
	tallies: Map<string, Tally>,
	limit: number,
	isName: (key: string, tally: Tally) => boolean
) {
	const sorted = withoutTitles(tallies).sort((a, b) => b[1].count - a[1].count);
	const words = sorted.filter(([key, tally]) => !isName(key, tally));
	const names = sorted.filter(([key, tally]) => isName(key, tally));
	return [...words.slice(0, limit), ...names.slice(0, MAP_NAMES)];
}

/** Every map of a book. */
export function buildWordMaps({ sections, entries }: ManuscriptInput): WordMaps {
	const names = speakerNames(entries);
	const pronouns = pronounsOf(sections, names, entries);
	const nameKeys = nameWords(entries);
	const isName = (key: string, tally: Tally) => nameKeys.has(key) || isProperNoun(tally);

	const book = new Map<string, Tally>();
	const everyone = new Map<string, Tally>();
	const voices = new Map<string, Voice>();
	const lost: { section: number; line: number; start: number; end: number }[] = [];
	const strangers: Record<string, number> = {};
	const placed: Record<How, number> = { named: 0, nearby: 0, turns: 0 };
	let spokenWords = 0;
	let spokenLines = 0;
	let unplacedWords = 0;

	const voiceOf = (speaker: string) => {
		let voice = voices.get(speaker);
		if (!voice) {
			voice = { tallies: new Map(), lines: 0, words: 0, sections: new Set() };
			voices.set(speaker, voice);
		}
		return voice;
	};

	sections.forEach((section: SectionInput, index) => {
		section.lines.forEach((text, line) => tallyRange(book, text, 0, text.length, index, line));

		const found = findSpeech(section.lines, names, pronouns);
		for (const [name, lines] of Object.entries(found.strangers)) {
			strangers[name] = (strangers[name] ?? 0) + lines;
		}
		for (const { line, start, end, speaker, how } of found.speeches) {
			const text = section.lines[line];
			const count = wordCount(text.slice(start, end));
			spokenWords += count;
			spokenLines += 1;
			tallyRange(everyone, text, start, end, index, line);

			if (speaker && how) {
				const voice = voiceOf(speaker);
				voice.lines += 1;
				voice.words += count;
				voice.sections.add(index);
				tallyRange(voice.tallies, text, start, end, index, line);
				placed[how] += count;
			} else {
				unplacedWords += count;
				lost.push({ section: index, line, start, end });
			}
		}
	});

	const words = sections.reduce((sum, section) => sum + section.words, 0);
	const everyoneTotal = totalOf(everyone);

	const speakers: Speaker[] = [...voices]
		.sort((a, b) => b[1].words - a[1].words)
		.slice(0, SPEAKERS)
		.map(([key, voice], rank) => {
			const share = rank < FULL_SPEAKERS ? 1 : 0.5;
			const total = totalOf(voice.tallies);
			const ownOf = (id: string, tally: Tally) =>
				ownness(tally.count, total, everyone.get(id)?.count ?? tally.count, everyoneTotal);

			const most = topWords(voice.tallies, SPEAKER_WORDS * share, isName);
			const kept = new Set(most.map(([id]) => id));
			const own = withoutTitles(voice.tallies)
				.filter(([id, tally]) => tally.count >= OWN_MINIMUM && !kept.has(id))
				.map(([id, tally]) => ({ id, tally, score: ownOf(id, tally) }))
				.filter((item) => item.score > 0)
				.sort((a, b) => b.score - a.score)
				.slice(0, OWN_WORDS * share);

			const map = [...most, ...own.map((item) => [item.id, item.tally] as const)].map(
				([id, tally]): MapWord => {
					const insight = repeatInsight(tally, sections, voice.words, SPEAKER_EXAMPLES);
					const name = isName(id, tally);
					return {
						...insight,
						text: name ? titled(insight.text) : insight.text,
						name,
						own: tally.count >= OWN_MINIMUM ? ownOf(id, tally) : 0,
						saidBy: []
					};
				}
			);

			const entry = entries.find((item) => `${item.type}-${item.id}` === key);
			return {
				key,
				id: entry?.id ?? null,
				name: key === NARRATOR ? 'The narrator' : (entry?.name ?? key),
				lines: voice.lines,
				words: voice.words,
				sections: voice.sections.size,
				map
			};
		});

	const bookMap = topWords(book, BOOK_WORDS, isName).map(([key, tally]): MapWord => {
		const insight = repeatInsight(tally, sections, words);
		const name = isName(key, tally);
		const saidBy = speakers
			.flatMap((speaker): [string, number][] => {
				const count = voices.get(speaker.key)?.tallies.get(key)?.count ?? 0;
				return count > 0 ? [[speaker.key, count]] : [];
			})
			.sort((a, b) => b[1] - a[1])
			.slice(0, SAID_BY);
		return { ...insight, text: name ? titled(insight.text) : insight.text, name, own: 0, saidBy };
	});

	// Spread through the book, so the list isn't one chapter's worth of the same conversation.
	const step = Math.max(1, Math.floor(lost.length / UNPLACED_EXAMPLES));
	const examples = lost
		.filter((_, index) => index % step === 0)
		.slice(0, UNPLACED_EXAMPLES)
		.map(({ section, line, start, end }) => {
			const text = sections[section].lines[line].slice(start, end).trim();
			return {
				section,
				text: text.length > UNPLACED_LENGTH ? `${text.slice(0, UNPLACED_LENGTH).trim()}…` : text
			};
		});

	return {
		sections: sections.map(({ key, target, id, label, title, number, group, words: length }) => ({
			key,
			target,
			id,
			label,
			title,
			number,
			group,
			words: length
		})),
		words,
		cast: entries.filter((entry) => entry.type === 'character').length,
		book: bookMap,
		speakers,
		spoken: { words: spokenWords, lines: spokenLines, placed },
		unplaced: { words: unplacedWords, lines: lost.length, examples },
		strangers: Object.entries(strangers)
			.filter(([name, lines]) => lines >= STRANGER_MINIMUM && !TITLE.test(name.toLowerCase()))
			.sort((a, b) => b[1] - a[1])
			.map(([name, lines]) => ({ name, lines }))
	};
}
