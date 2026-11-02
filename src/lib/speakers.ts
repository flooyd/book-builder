// Who says what, with no AI involved. A writer's story bible already holds the names, so there's no
// list of speech verbs here: in “How are you doing?” Will inquired, a known name beside the words
// says who they belong to, whatever the verb is. The rules, most trusted first:
//
//   1. A name right beside the words: “Stay,” said Juno. Juno said, “Stay.” A paragraph that leads
//      into the next one counts too: Juno turned and said:
//   2. The person the narration around the words is about: Juno crossed the deck. “Stay.”
//   3. Taking turns, when exactly two people are talking. It's anchored by the lines we're sure of,
//      and by two things a line gives away: “Ah, Ade,” can't be Ade, and “she said” can't be him.
//
// Anything still uncertain stays unplaced. A character's map with a stranger's words in it is worse
// than a smaller map, so when these rules disagree or don't apply, a line is left for the writer.

import {
	CAPITAL,
	WORD,
	endsSentence,
	nameAt,
	nameIndex,
	quoteAfter,
	type EntryInput,
	type NameIndex,
	type Quote
} from '$lib/insights';

/** The book's first-person voice, who has no entry to point at. */
export const NARRATOR = 'narrator';

/** Which rule placed a line. */
export type How = 'named' | 'nearby' | 'turns';

/** A stretch of quoted words, and who says them if that's known. */
export type Speech = {
	line: number;
	start: number;
	end: number;
	/** An entry's key ("character-1"), or NARRATOR. */
	speaker: string | null;
	how: How | null;
};

/** Everything in a section that's spoken aloud. */
export type SpokenText = {
	speeches: Speech[];
	/** Names beside lines that aren't in the story bible, with how many lines each one has. */
	strangers: Record<string, number>;
};

/** Each character's pronoun, where the text makes it plain. */
export type Pronouns = Record<string, 'he' | 'she'>;

type Word = { text: string; start: number; end: number };
type Run = { quoted: boolean; start: number; end: number };

/** What the words next to a line say about who's speaking. */
type Reading =
	| { kind: 'known'; speaker: string }
	/** Somebody, but not one the bible can name: a stranger, a crowd, a name two people share. */
	| { kind: 'stranger'; name: string | null }
	/** A "she said", which tells us a person is meant and not who. */
	| { kind: 'pronoun'; word: string };

const list = (words: string) => new Set(words.split(/\s+/));

/** Small words that can follow a quotation without being how it's tagged: “Stay,” and Juno did. */
const NOT_A_TAG = list(
	`about above across after against along among and around as at because before behind below
	beneath beside between beyond but by down during for from if in inside into like near of off on
	onto or outside over past since so than that then though through till to toward towards under
	until up upon when where which while who whom with within without`
);

const PRONOUNS = list('he she they it we you');
const ARTICLES = list('the a an');

/** The first person, with what can be joined to it: "I'd", "I’ll". */
const FIRST_PERSON = /^I(?:['’](?:d|m|ll|ve))?$/;

/** Names that can also open a question. */
const MODALS = list('will may might can shall');

/** What follows one when it's asking, so the capital in "Will she come?" doesn't make it a name. */
const FOLLOWS_A_MODAL = list(
	`i you he she it we they the a an this that there my your his her our their these those all any
	anyone anything everyone someone`
);

/** Whether a word that could be a name is opening a question instead: "May I?" */
export const isAsking = (word: string, next: string) =>
	MODALS.has(word.toLowerCase()) && FOLLOWS_A_MODAL.has(next.toLowerCase());

/** Scare quotes hold this many words at most: they called it “the long dark”. */
const MENTIONED_WORDS = 4;

/** Words before a comma that can lead into a subject: “Turning to the window, Juno said…” */
const LEAD_IN_WORDS = 6;

/** Turns to count on from a known speaker. Further than this, one slip would flip every line. */
const TURN_REACH = 6;

/**
 * Paragraphs either side of a conversation to look through for anyone else. A third person nearby
 * is what breaks taking turns: measured on novels by hiding tags and recovering them, this takes
 * it from 86% right to 96%, and looking any further loses far more lines than it saves.
 */
const CROWD_WINDOW = 4;

/** Sentences to see, and how far one pronoun must lead the other, before trusting it. */
const ENOUGH_PRONOUNS = 2;
const PRONOUN_LEAD = 3;

/** Only the subject's own: "his" in a sentence about Juno is as likely to be someone else's. */
const HE_WORDS = list('he himself');
const SHE_WORDS = list('she herself');

/** A title says it outright. */
const HE_TITLES = list('mr sir lord king prince father brother uncle');
const SHE_TITLES = list('mrs ms miss lady madam queen princess mother sister aunt');

const LETTER = /[\p{L}\p{N}]/u;
const QUOTE_MARK = /["“”‘’]/;
/** How a paragraph leads into a line in the next: "she said to him:" or "he went on,—" */
const LEADS_ON = /[,:;—–-]\s*$/;

function wordsIn(text: string, start: number, end: number): Word[] {
	return [...text.slice(start, end).matchAll(WORD)].map((match) => ({
		text: match[0],
		start: start + match.index,
		end: start + match.index + match[0].length
	}));
}

/**
 * A paragraph split into narration and quoted words. An opening mark with no closing one runs to
 * the end of the paragraph, which is how a long speech carries over to the next.
 */
function runsOf(text: string) {
	const found: Run[] = [];
	let quote: Quote = '';
	let from = 0;

	for (let index = 0; index < text.length; index++) {
		const character = text[index];
		if (!QUOTE_MARK.test(character)) continue;
		// An apostrophe, which is no business of quotation marks.
		if (LETTER.test(text[index - 1] ?? '') && LETTER.test(text[index + 1] ?? '')) continue;
		const next = quoteAfter(character, quote);
		if (next === quote) continue;
		if (index > from) found.push({ quoted: Boolean(quote), start: from, end: index });
		from = index + 1;
		quote = next;
	}
	if (text.length > from) found.push({ quoted: Boolean(quote), start: from, end: text.length });

	const runs: Run[] = [];
	for (const run of found) {
		const before = text.slice(0, Math.max(0, run.start - 1)).trimEnd();
		// A title or a scare quote sits inside a sentence, with no comma or colon to lead into it.
		const mentioned =
			run.quoted &&
			LETTER.test(before.at(-1) ?? '') &&
			wordsIn(text, run.start, run.end).length <= MENTIONED_WORDS;
		const quoted = run.quoted && !mentioned;
		const last = runs.at(-1);
		if (!quoted && last && !last.quoted) last.end = run.end;
		else runs.push({ ...run, quoted });
	}
	return { runs, open: Boolean(quote) };
}

function sentencesIn(text: string, start: number, end: number) {
	const sentences: Word[][] = [];
	let sentence: Word[] = [];
	for (const word of wordsIn(text, start, end)) {
		const previous = sentence.at(-1);
		if (previous && endsSentence(text.slice(previous.end, word.start), previous.text, word.text)) {
			sentences.push(sentence);
			sentence = [];
		}
		sentence.push(word);
	}
	if (sentence.length > 0) sentences.push(sentence);
	return sentences;
}

/** Who this word stands for, if it stands for anybody. */
function whoAt(words: Word[], index: number, names: NameIndex): Reading | null {
	const word = words[index];
	if (!word) return null;
	if (FIRST_PERSON.test(word.text)) return { kind: 'known', speaker: NARRATOR };

	const texts = words.map((item) => item.text);
	const found = nameAt(texts, index, names);
	// "the Hatter" for an entry called The Hatter, which the writer has no need to spell both ways.
	if (!found && ARTICLES.has(word.text.toLowerCase()) && nameAt(texts, index + 1, names)) {
		return whoAt(words, index + 1, names);
	}
	if (found && !isAsking(word.text, words[index + 1]?.text ?? '')) {
		// Two names at once are two people, which is no help in telling them apart.
		const after = index + 1 + found.rest.length;
		const pair = words[after]?.text === 'and' && nameAt(texts, after + 1, names);
		if (pair) return { kind: 'stranger', name: null };
		return found.entries.length === 1
			? { kind: 'known', speaker: found.entries[0] }
			: { kind: 'stranger', name: null };
	}
	const plain = word.text.split(/['’]/)[0].toLowerCase();
	return PRONOUNS.has(plain) ? { kind: 'pronoun', word: plain } : null;
}

const leadsIn = (word: Word) => !NOT_A_TAG.has(word.text.toLowerCase());

/** Who a sentence is about, from its first words: Juno, Then Juno, Captain Halley. */
function firstNamed(words: Word[], index: number, names: NameIndex) {
	const direct = whoAt(words, index, names);
	if (direct) return direct;
	const word = words[index];
	if (!word || !CAPITAL.test(word.text) || !leadsIn(word)) return null;
	const titled = whoAt(words, index + 1, names);
	return titled?.kind === 'known' ? titled : null;
}

/** The subject of a sentence, looking past a short opening: “At last, Juno turned.” */
function subjectOf(sentence: Word[], text: string, names: NameIndex) {
	const direct = firstNamed(sentence, 0, names);
	if (direct) return direct;
	for (let index = 0; index < Math.min(LEAD_IN_WORDS, sentence.length - 1); index++) {
		if (text.slice(sentence[index].end, sentence[index + 1].start).includes(',')) {
			return firstNamed(sentence, index + 1, names);
		}
	}
	return null;
}

/** What the narration straight after a quotation says: “…” Will inquired, or “…,” said Juno. */
function tagAfter(
	text: string,
	speech: Run,
	narration: Run | undefined,
	names: NameIndex
): Reading | null {
	if (!narration) return null;
	const words = wordsIn(text, narration.start, narration.end);
	const [first, second] = words;
	if (!first) return null;

	const direct = whoAt(words, 0, names);
	if (direct) return direct;

	// A comma inside the marks means the sentence goes on, so what follows must be a tag.
	const tagged = text.slice(speech.start, speech.end).trimEnd().endsWith(',');

	if (!CAPITAL.test(first.text)) {
		if (ARTICLES.has(first.text)) return { kind: 'stranger', name: null };
		if (NOT_A_TAG.has(first.text)) return null;
		const inverted = whoAt(words, 1, names);
		if (inverted) return inverted;
		if (second && CAPITAL.test(second.text)) return { kind: 'stranger', name: second.text };
		return { kind: 'stranger', name: null };
	}

	const titled = firstNamed(words, 0, names);
	if (titled) return titled;
	return tagged ? { kind: 'stranger', name: first.text } : null;
}

/** What the narration leading up to a quotation says: Juno said, “…” or Juno turned. “…” */
function tagBefore(text: string, narration: Run | undefined, first: boolean, names: NameIndex) {
	if (!narration) return null;
	const sentence = sentencesIn(text, narration.start, narration.end).at(-1);
	if (!sentence) return null;
	const lead = LEADS_ON.test(text.slice(narration.start, narration.end));
	const subject = subjectOf(sentence, text, names);
	if (subject) return { reading: subject, how: lead ? ('named' as const) : ('nearby' as const) };
	// “The old man said,” leading into a line: somebody speaks, and it isn't anyone in the bible.
	// Between two lines it's only the tag of the first: “Stay,” said Juno, “and don’t move.”
	const stranger: Reading = { kind: 'stranger', name: null };
	return lead && first ? { reading: stranger, how: 'named' as const } : null;
}

/** Everyone a paragraph's narration opens a sentence with. */
function subjectsIn(text: string, runs: Run[], names: NameIndex) {
	return runs.flatMap((run) =>
		run.quoted
			? []
			: sentencesIn(text, run.start, run.end).flatMap((sentence) => {
					const subject = subjectOf(sentence, text, names);
					return subject?.kind === 'known' ? [subject.speaker] : [];
				})
	);
}

/** Everyone a paragraph's narration mentions at all, in whatever part of a sentence. */
function mentionedIn(text: string, runs: Run[], names: NameIndex) {
	return runs.flatMap((run) => {
		if (run.quoted) return [];
		const words = wordsIn(text, run.start, run.end).map((word) => word.text);
		return words.flatMap((_, index) => nameAt(words, index, names)?.entries ?? []);
	});
}

/**
 * The one person narration can settle a line for: the only one it mentions, and a subject at that.
 * Mention anyone else, and a “she added” could as easily be them.
 */
function onlyPerson(text: string, runs: Run[], names: NameIndex) {
	const mentioned = [...new Set(mentionedIn(text, runs, names))];
	const [person] = mentioned;
	if (mentioned.length !== 1) return null;
	return subjectsIn(text, runs, names).includes(person) ? person : null;
}

/** Could someone be called this? A first person is never "she", and an unknown could be anyone. */
function fits(speaker: string, pronoun: string | null, pronouns: Pronouns) {
	if (!pronoun || !(pronoun === 'he' || pronoun === 'she')) return true;
	if (speaker === NARRATOR) return false;
	return (pronouns[speaker] ?? pronoun) === pronoun;
}

/** Names in a line that are said to someone: “Ah, Jane,” “Stay here, Ade.” “Jane!” */
function addressedIn(text: string, speech: Run, names: NameIndex) {
	const words = wordsIn(text, speech.start, speech.end);
	const texts = words.map((word) => word.text);
	const found: string[] = [];
	for (let index = 0; index < words.length; index++) {
		const name = nameAt(texts, index, names);
		if (!name) continue;
		const end = words[index + name.rest.length].end;
		const before = text.slice(words[index - 1]?.end ?? speech.start, words[index].start);
		const after = text.slice(end, words[index + name.rest.length + 1]?.start ?? speech.end);
		// Set apart by punctuation on both sides. "dear" is how people addressed each other once.
		const opens = index === 0 || /[,;:—–!?.]/.test(before) || /^dear$/i.test(texts[index - 1]);
		const closes = /^[,;:—–!?.]/.test(after.trimStart());
		// “Julius.” alone is an answer as often as it's a call. “Julius!” is a call.
		const alone = words.length === name.rest.length + 1 && !after.includes('!');
		if (opens && closes && !alone && name.entries.length === 1) found.push(name.entries[0]);
		index += name.rest.length;
	}
	return found;
}

/** A paragraph with something spoken in it. */
type Turn = {
	line: number;
	speeches: Speech[];
	/** Everyone the words beside its lines name: two means it can't count as one turn. */
	speakers: string[];
	stranger: boolean;
	/** The "he" or "she" of its tag, if that's all it has. */
	pronoun: string | null;
	/** Who its lines are said to. */
	addressed: string[];
	/** Who its narration mentions. */
	mentioned: string[];
	/** Its last line runs on into the next paragraph, and its first carries on from the last. */
	open: boolean;
	opensQuoted: boolean;
};

function place(turn: Turn, speaker: string, how: How) {
	for (const speech of turn.speeches) {
		if (speech.speaker) continue;
		speech.speaker = speaker;
		speech.how = how;
	}
	if (!turn.speakers.includes(speaker)) turn.speakers.push(speaker);
}

function readParagraph(
	text: string,
	line: number,
	names: NameIndex,
	pronouns: Pronouns,
	strangers: Record<string, number>
): Turn | null {
	const { runs, open } = runsOf(text);
	const spoken = runs.flatMap((run, index) =>
		run.quoted && wordsIn(text, run.start, run.end).length > 0 ? [{ run, index }] : []
	);
	if (spoken.length === 0) return null;

	const narration = (index: number) => (runs[index]?.quoted === false ? runs[index] : undefined);

	const speeches: Speech[] = [];
	const readings: (Reading | null)[] = [];
	for (const { run, index } of spoken) {
		const after = tagAfter(text, run, narration(index + 1), names);
		const before = tagBefore(text, narration(index - 1), index === spoken[0].index, names);
		const sure = (reading: Reading | null | undefined) => reading && reading.kind !== 'pronoun';
		// Juno crossed the deck. “Stay,” he said. The tag beside the words wins, and that isn't Juno.
		const clashes =
			before?.reading.kind === 'known' &&
			after?.kind === 'pronoun' &&
			!fits(before.reading.speaker, after.word, pronouns);

		const reading = sure(after)
			? after
			: sure(before?.reading) && !clashes
				? (before?.reading ?? null)
				: (after ?? before?.reading ?? null);
		readings.push(reading);
		speeches.push({
			line,
			start: run.start,
			end: run.end,
			speaker: reading?.kind === 'known' ? reading.speaker : null,
			how: reading?.kind !== 'known' ? null : reading === before?.reading ? before.how : 'named'
		});
		if (reading?.kind === 'stranger' && reading.name) {
			strangers[reading.name] = (strangers[reading.name] ?? 0) + 1;
		}
	}

	// Nobody calls themselves by name, so a beat that says otherwise is about someone else.
	const addressed = [...new Set(spoken.flatMap(({ run }) => addressedIn(text, run, names)))];
	for (const speech of speeches) {
		if (speech.how !== 'nearby' || !addressed.includes(speech.speaker ?? '')) continue;
		speech.speaker = null;
		speech.how = null;
	}

	const stranger = readings.some((reading) => reading?.kind === 'stranger');
	const speakers = [...new Set(speeches.flatMap((speech) => speech.speaker ?? []))];
	const tag = readings.find((reading) => reading?.kind === 'pronoun');
	const pronoun = tag?.kind === 'pronoun' ? tag.word : null;
	const mentioned = [...new Set(mentionedIn(text, runs, names))];

	const turn: Turn = {
		line,
		speeches,
		speakers: [],
		stranger,
		pronoun,
		addressed,
		mentioned,
		open,
		opensQuoted: runs[0]?.quoted === true
	};

	if (speakers.length === 1) {
		// One voice to a paragraph: “Stay,” Juno said. “The ice won’t hold.”
		const how = speeches.find((speech) => speech.speaker)?.how ?? 'named';
		const leftOut = speeches.filter((_, index) => readings[index]?.kind === 'stranger');
		if (leftOut.length === 0) place(turn, speakers[0], how);
	} else if (speakers.length === 0 && !stranger) {
		// Nobody beside the words, but one person the paragraph is about.
		const person = onlyPerson(text, runs, names);
		if (person && !addressed.includes(person) && fits(person, pronoun, pronouns)) {
			place(turn, person, 'nearby');
		}
	} else {
		turn.speakers = speakers;
	}
	return turn;
}

/**
 * What the paragraph before a turn can tell us, if it's all narration: one that leads into the
 * line says who's speaking, and one about a single person settles who a "she said" means.
 */
function readLeadIn(turn: Turn, before: string, names: NameIndex, pronouns: Pronouns) {
	// A paragraph that names people of its own has no need to look back, and looking back past
	// them would be a guess.
	if (turn.speakers.length > 0 || turn.stranger || turn.mentioned.length > 0) return;
	const last = sentencesIn(before, 0, before.length).at(-1);
	const subject = last ? subjectOf(last, before, names) : null;

	let pronoun = turn.pronoun;
	if (LEADS_ON.test(before)) {
		if (subject?.kind === 'known') {
			place(turn, subject.speaker, 'named');
			return;
		}
		// “…and thus began:” is whoever that sentence means, not whoever opened the paragraph.
		if (subject?.kind !== 'pronoun') return;
		pronoun ??= subject.word;
		turn.pronoun = pronoun;
	}
	if (!pronoun) return;

	// Across a paragraph break, a pronoun has to match, not just not clash. "Elizabeth's
	// congratulations…" isn't about her in the way a line after it would need, either.
	const person = onlyPerson(before, runsOf(before).runs, names);
	const owned = /['’]s$/.test(last?.[0].text ?? '');
	if (person && !owned && !turn.addressed.includes(person) && pronouns[person] === pronoun) {
		place(turn, person, 'nearby');
	}
}

/** A speech that runs over several paragraphs is one person, however it's tagged. */
function joinLongSpeeches(turns: Turn[]) {
	const joined: Turn[] = [];
	for (const turn of turns) {
		const last = joined.at(-1);
		if (last?.open && last.speeches.at(-1)?.line === turn.line - 1 && turn.opensQuoted) {
			last.speeches.push(...turn.speeches);
			last.speakers = [...new Set([...last.speakers, ...turn.speakers])];
			last.addressed = [...new Set([...last.addressed, ...turn.addressed])];
			last.stranger ||= turn.stranger;
			last.pronoun ??= turn.pronoun;
			last.open = turn.open;
			if (last.speakers.length === 1) {
				const how = last.speeches.find((speech) => speech.how)?.how ?? 'named';
				place(last, last.speakers[0], how);
			}
		} else {
			joined.push(turn);
		}
	}
	return joined;
}

/**
 * Lines in an unbroken run of dialogue with exactly two people in it. Those two are whoever's
 * named beside a line or spoken to in one, or the pair from just before, if the only thing in the
 * way is a line about one of them. Remembering any more loosely puts words in the mouth of someone
 * who has left the room, because a person the bible doesn't know can't be seen to walk in. A line
 * is only placed if the sure lines either side of it agree on whose turn it is. Returns the people
 * who were talking, for the next run to remember.
 */
function takeTurns(exchange: Turn[], remembered: string[], pronouns: Pronouns) {
	const seen = [...new Set(exchange.flatMap((turn) => [...turn.speakers, ...turn.addressed]))];
	if (exchange.some((turn) => turn.stranger || turn.speakers.length > 1)) return [];

	const everyone = [...new Set([...seen, ...remembered])];
	const people = seen.length >= 2 ? seen : everyone;
	if (people.length !== 2) return seen;

	const other = (speaker: string) => (speaker === people[0] ? people[1] : people[0]);

	/** Who a line must be, from itself alone. */
	const sure = (turn: Turn) => {
		if (turn.speakers[0]) return turn.speakers[0];
		const spokenTo = turn.addressed.find((person) => people.includes(person));
		if (spokenTo) return other(spokenTo);
		if (turn.pronoun === 'he' || turn.pronoun === 'she') {
			const fitting = people.filter((person) => fits(person, turn.pronoun, pronouns));
			const told = people.every((person) => person === NARRATOR || pronouns[person]);
			if (fitting.length === 1 && told) return fitting[0];
		}
		return null;
	};

	const known = exchange.map(sure);
	/** Whose turn this is, going by a sure line this many lines away. */
	const turnOf = (from: number, to: number) => {
		const speaker = known[from] as string;
		return Math.abs(to - from) % 2 === 0 ? speaker : other(speaker);
	};

	exchange.forEach((turn, index) => {
		if (turn.speakers[0]) return;
		const before = known.findLastIndex((speaker, at) => speaker && at < index);
		const after = known.findIndex((speaker, at) => speaker && at > index);
		const guesses = [
			...(known[index] ? [known[index]] : []),
			...[before, after]
				.filter((at) => at !== -1 && Math.abs(at - index) <= TURN_REACH)
				.map((at) => turnOf(at, index))
		];
		if (guesses.length === 0 || guesses.some((guess) => guess !== guesses[0])) return;
		place(turn, guesses[0], 'turns');
	});
	return people;
}

/** The story bible's characters, as the names a line can be tagged with. */
export const speakerNames = (entries: EntryInput[]) =>
	nameIndex(entries.filter((entry) => entry.type === 'character'));

/**
 * Who goes by "he" and who by "she", read from the book itself, since a story bible doesn't say:
 * in sentences about one person, which pronouns come with them. Narration only, because speech
 * talks about other people. Anyone it isn't plain about is left out, and fits either.
 */
export function pronounsOf(
	sections: { lines: string[] }[],
	names: NameIndex,
	entries: EntryInput[]
) {
	const tallies: Record<string, { he: number; she: number }> = {};
	for (const { lines } of sections) {
		for (const text of lines) {
			for (const run of runsOf(text).runs) {
				if (run.quoted) continue;
				const sentences = sentencesIn(text, run.start, run.end);
				sentences.forEach((sentence, index) => {
					const subject = subjectOf(sentence, text, names);
					if (subject?.kind !== 'known' || subject.speaker === NARRATOR) return;
					const tally = (tallies[subject.speaker] ??= { he: 0, she: 0 });
					const follows = sentences[index + 1]?.[0]?.text.toLowerCase() ?? '';
					for (const word of [follows, ...sentence.map((item) => item.text.toLowerCase())]) {
						if (HE_WORDS.has(word.split(/['’]/)[0])) tally.he += 1;
						if (SHE_WORDS.has(word.split(/['’]/)[0])) tally.she += 1;
					}
				});
			}
		}
	}

	const pronouns: Pronouns = {};
	for (const [speaker, { he, she }] of Object.entries(tallies)) {
		if (he + she < ENOUGH_PRONOUNS) continue;
		if (he >= she * PRONOUN_LEAD) pronouns[speaker] = 'he';
		else if (she >= he * PRONOUN_LEAD) pronouns[speaker] = 'she';
	}
	for (const entry of entries) {
		const title = entry.name.split(/\s+/)[0].replace(/\.$/, '').toLowerCase();
		if (HE_TITLES.has(title)) pronouns[`${entry.type}-${entry.id}`] = 'he';
		if (SHE_TITLES.has(title)) pronouns[`${entry.type}-${entry.id}`] = 'she';
	}
	return pronouns;
}

/** Everything spoken in a section's lines, and who says it where that can be told. */
export function findSpeech(lines: string[], names: NameIndex, pronouns: Pronouns = {}): SpokenText {
	const strangers: Record<string, number> = {};
	const paragraphs = lines.map((text, line) =>
		readParagraph(text, line, names, pronouns, strangers)
	);
	paragraphs.forEach((turn, line) => {
		if (turn && line > 0 && !paragraphs[line - 1]) {
			readLeadIn(turn, lines[line - 1], names, pronouns);
		}
	});
	const turns = joinLongSpeeches(paragraphs.flatMap((turn) => turn ?? []));

	// Who the narration is about and who has spoken, line by line, to tell a pair from a crowd.
	const present = lines.map((text, line) => {
		const turn = paragraphs[line];
		return turn
			? [...turn.speakers, ...turn.addressed]
			: subjectsIn(text, runsOf(text).runs, names);
	});

	let exchange: Turn[] = [];
	let remembered: string[] = [];
	const finish = () => {
		if (exchange.length > 0) {
			const first = exchange[0].speeches[0].line;
			const last = exchange.at(-1)?.speeches.at(-1)?.line ?? first;
			const nearby = present.slice(Math.max(0, first - CROWD_WINDOW), last + 1 + CROWD_WINDOW);
			const crowd = new Set(nearby.flat().filter((person) => person !== NARRATOR));
			remembered = crowd.size > 2 ? [] : takeTurns(exchange, remembered, pronouns);
		}
		exchange = [];
	};
	for (const turn of turns) {
		const last = exchange.at(-1)?.speeches.at(-1)?.line;
		if (last !== undefined && turn.line !== last + 1) {
			finish();
			const pause = turn.line === last + 2 ? lines[last + 1] : '';
			const about = pause ? subjectsIn(pause, runsOf(pause).runs, names) : [];
			if (!about.some((person) => remembered.includes(person))) remembered = [];
		}
		exchange.push(turn);
	}
	finish();

	return { speeches: turns.flatMap((turn) => turn.speeches), strangers };
}
