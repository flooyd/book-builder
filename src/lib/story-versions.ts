/**
 * Version history: the rules for which earlier states of a piece of story text are kept, shared by
 * the server and the history panel. No imports, so it can be tested on its own.
 *
 * Saving keeps a copy of the text it replaces when the newest copy is ten minutes old or more,
 * and always before a cut of a hundred words or more, so a slip costs ten minutes at worst. Old
 * copies thin out: every one from the last two days stays, then the last of each day for a
 * month, then the last of each week. One the writer has kept by hand (`label` set, even to '')
 * never goes.
 */

/** A run of saves this close together shares one version. */
export const VERSION_GAP_MINUTES = 10;
/** A save that leaves this many words fewer keeps the text from before it, however soon. */
export const BIG_CUT_WORDS = 100;
/** Every version saved in this many days stays. */
export const KEEP_ALL_DAYS = 2;
/** After that, the last version of each day stays for this many days, then one a week. */
export const KEEP_DAILY_DAYS = 30;
/** The longest name a writer can give a version. */
export const VERSION_LABEL_MAX = 80;

const DAY_MS = 86_400_000;

/** One kept version, as the history panel lists it. */
export type VersionInfo = {
	id: number;
	/** When this text was saved (ISO). */
	savedAt: string;
	/** When the copy was kept (ISO): the moment the text was replaced, or named. */
	createdAt: string;
	words: number;
	/** The writer's name for it. null: kept by the app and thinned out in time; '' kept, unnamed. */
	label: string | null;
};

/** A version with its text. */
export type VersionText = VersionInfo & { content: string };

/** Whether a save from `words` to `nextWords` is a big enough cut to keep the text before it. */
export const isBigCut = (words: number, nextWords: number) => words - nextWords >= BIG_CUT_WORDS;

/**
 * Whether the text saved at `savedAt` should be kept before a save at `now`, given the newest
 * version so far. Returns 'same' when that version already holds this text.
 */
export function keepDecision(
	newest: { savedAt: Date; createdAt: Date } | undefined,
	savedAt: Date,
	now: Date,
	bigCut: boolean
): 'same' | 'keep' | 'skip' {
	if (newest && newest.savedAt.getTime() === savedAt.getTime()) return 'same';
	if (!newest || bigCut) return 'keep';
	return now.getTime() - newest.createdAt.getTime() >= VERSION_GAP_MINUTES * 60_000
		? 'keep'
		: 'skip';
}

/**
 * The ids of versions that thinning removes, from all of one text's versions. Days and weeks are
 * counted in UTC: the server doesn't know the writer's time zone when it thins.
 */
export function versionsToDrop(
	versions: { id: number; savedAt: Date; label: string | null }[],
	now: Date
): number[] {
	const newestFirst = [...versions].sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime());
	const taken: Record<string, true> = {};
	const drop: number[] = [];
	for (const version of newestFirst) {
		if (version.label !== null) continue;
		const time = version.savedAt.getTime();
		const age = now.getTime() - time;
		if (age < KEEP_ALL_DAYS * DAY_MS) continue;
		const bucket =
			age < KEEP_DAILY_DAYS * DAY_MS
				? `day-${Math.floor(time / DAY_MS)}`
				: `week-${Math.floor(time / (7 * DAY_MS))}`;
		if (taken[bucket]) drop.push(version.id);
		else taken[bucket] = true;
	}
	return drop;
}

/** The day a version was saved, as the history lists it: Today, Yesterday, or "Tue 3 Nov". */
export function versionDay(iso: string, now = new Date()) {
	const date = new Date(iso);
	const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
	if (date.toDateString() === now.toDateString()) return 'Today';
	if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
	return date.toLocaleDateString('en-GB', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' })
	});
}

/** The time a version was saved, in the writer's own clock. */
export const versionTime = (iso: string) =>
	new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** When a version was saved, inside a sentence: "yesterday at 4:10 PM", "Tue 3 Nov at 9:05 AM". */
export function versionWhen(iso: string, now = new Date()) {
	const day = versionDay(iso, now);
	return `${day === 'Today' || day === 'Yesterday' ? day.toLowerCase() : day} at ${versionTime(iso)}`;
}

/**
 * A version's name from a request body: a string up to VERSION_LABEL_MAX, trimmed, or null to
 * stop keeping it. undefined when the value is neither.
 */
export function cleanLabel(value: unknown): string | null | undefined {
	if (value === null) return null;
	if (typeof value !== 'string') return undefined;
	return value.replace(/\s+/g, ' ').trim().slice(0, VERSION_LABEL_MAX);
}
