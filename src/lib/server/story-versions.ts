import { json, type RequestEvent } from '@sveltejs/kit';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth-guard';
import { db } from '$lib/server/db';
import { storyText, storyVersion } from '$lib/server/db/schema';
import { findOwnedChapter, findOwnedPart } from '$lib/server/ownership';
import { wordsIn } from '$lib/server/goals';
import {
	cleanLabel,
	isBigCut,
	keepDecision,
	versionsToDrop,
	type VersionInfo,
	type VersionText
} from '$lib/story-versions';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The saved story text a version is kept from. */
type SavedText = { id: number; content: string; updatedAt: Date };

/**
 * Before a save replaces `text`, keep a copy of it if one is due (see $lib/story-versions), and
 * thin out the older ones. `always` keeps it whatever the timing, as a restore does. Returns the
 * id of the version that holds `text`, or null when none does.
 *
 * Costs one indexed read per save; the copy and the thinning only happen when one is kept, at
 * most every ten minutes of saving or on a big cut.
 */
export async function keepVersion(
	tx: Tx,
	text: SavedText,
	{ nextWords, now, always = false }: { nextWords: number; now: Date; always?: boolean }
) {
	const [newest] = await tx
		.select({
			id: storyVersion.id,
			savedAt: storyVersion.savedAt,
			createdAt: storyVersion.createdAt
		})
		.from(storyVersion)
		.where(eq(storyVersion.storyTextId, text.id))
		.orderBy(desc(storyVersion.savedAt))
		.limit(1);
	const words = wordsIn(text.content);
	const decision = keepDecision(newest, text.updatedAt, now, always || isBigCut(words, nextWords));
	if (decision === 'same') return newest.id;
	if (decision === 'skip') return null;

	const [row] = await tx
		.insert(storyVersion)
		.values({
			storyTextId: text.id,
			content: text.content,
			words,
			savedAt: text.updatedAt,
			createdAt: now
		})
		.returning({ id: storyVersion.id });
	await thin(tx, text.id, now);
	return row.id;
}

async function thin(tx: Tx, storyTextId: number, now: Date) {
	const versions = await tx
		.select({ id: storyVersion.id, savedAt: storyVersion.savedAt, label: storyVersion.label })
		.from(storyVersion)
		.where(eq(storyVersion.storyTextId, storyTextId));
	const drop = versionsToDrop(versions, now);
	if (drop.length) await tx.delete(storyVersion).where(inArray(storyVersion.id, drop));
}

const infoColumns = {
	id: storyVersion.id,
	savedAt: storyVersion.savedAt,
	createdAt: storyVersion.createdAt,
	words: storyVersion.words,
	label: storyVersion.label
};

const toInfo = (row: {
	id: number;
	savedAt: Date;
	createdAt: Date;
	words: number;
	label: string | null;
}): VersionInfo => ({
	id: row.id,
	savedAt: row.savedAt.toISOString(),
	createdAt: row.createdAt.toISOString(),
	words: row.words,
	label: row.label
});

/** One version of the story text `storyTextId`, if it's one of its versions. */
export async function findVersion(storyTextId: number, versionId: number) {
	const [row] = await db
		.select()
		.from(storyVersion)
		.where(and(eq(storyVersion.id, versionId), eq(storyVersion.storyTextId, storyTextId)))
		.limit(1);
	return row;
}

/**
 * Handlers for the versions of a part's or chapter's story text, at
 * /api/story-text/{part|chapter}/[id]/versions:
 *
 * - `list` (GET): every version, newest first, without their text.
 * - `keep` (POST `{ label }`): keep the text as it's saved now, named; the history's "Keep".
 * - `one` (GET `/[versionId]`): one version with its text.
 * - `rename` (PUT `/[versionId]` `{ label }`): name it, or `label: null` to let it thin out.
 *
 * Restoring is a save, so it lives with the others in $lib/server/story-text. Each handler checks
 * that the signed-in user owns *this* part or chapter, and that the version belongs to its text.
 */
export function storyVersionHandlers(target: 'part' | 'chapter') {
	const column = target === 'part' ? storyText.partId : storyText.chapterId;
	const findOwned = target === 'part' ? findOwnedPart : findOwnedChapter;
	const label = target === 'part' ? 'Part' : 'Chapter';

	/** The story text of the part or chapter in the URL (null when none is saved yet). */
	async function ownedText(event: RequestEvent) {
		const user = requireUser(event);
		const id = Number(event.params.id);
		if (!Number.isInteger(id)) {
			return { error: json({ error: `Invalid ${target} id` }, { status: 400 }) };
		}
		if (!(await findOwned(user.id, id))) {
			return { error: json({ error: `${label} not found` }, { status: 404 }) };
		}
		const [text] = await db
			.select()
			.from(storyText)
			.where(eq(column, id))
			.orderBy(storyText.createdAt)
			.limit(1);
		return { text: text ?? null };
	}

	async function ownedVersion(
		event: RequestEvent
	): Promise<{ error: Response } | { text: SavedText; version: typeof storyVersion.$inferSelect }> {
		const owned = await ownedText(event);
		if (owned.error) return { error: owned.error };
		const versionId = Number(event.params.versionId);
		const version =
			owned.text && Number.isInteger(versionId)
				? await findVersion(owned.text.id, versionId)
				: undefined;
		if (!version) return { error: json({ error: 'Version not found' }, { status: 404 }) };
		return { text: owned.text!, version };
	}

	const list = async (event: RequestEvent) => {
		const owned = await ownedText(event);
		if ('error' in owned) return owned.error;
		if (!owned.text) return json([]);
		const rows = await db
			.select(infoColumns)
			.from(storyVersion)
			.where(eq(storyVersion.storyTextId, owned.text.id))
			.orderBy(desc(storyVersion.savedAt));
		return json(rows.map(toInfo));
	};

	const keep = async (event: RequestEvent) => {
		const owned = await ownedText(event);
		if ('error' in owned) return owned.error;
		const body = await event.request.json().catch(() => null);
		const name = cleanLabel(body?.label ?? '');
		if (typeof name !== 'string') {
			return json({ error: 'A version name must be text.' }, { status: 400 });
		}
		const text = owned.text;
		if (!text) {
			return json({ error: 'There’s no saved story text to keep yet.' }, { status: 400 });
		}
		const row = await db.transaction(async (tx) => {
			const now = new Date();
			const id = await keepVersion(tx, text, {
				nextWords: wordsIn(text.content),
				now,
				always: true
			});
			const [row] = await tx
				.update(storyVersion)
				.set({ label: name })
				.where(eq(storyVersion.id, id!))
				.returning(infoColumns);
			return row;
		});
		return json(toInfo(row));
	};

	const one = async (event: RequestEvent) => {
		const owned = await ownedVersion(event);
		if ('error' in owned) return owned.error;
		const { version } = owned;
		const body: VersionText = { ...toInfo(version), content: version.content };
		return json(body);
	};

	const rename = async (event: RequestEvent) => {
		const owned = await ownedVersion(event);
		if ('error' in owned) return owned.error;
		const body = await event.request.json().catch(() => null);
		const name = cleanLabel(body?.label);
		if (name === undefined) {
			return json({ error: 'A version name must be text, or null.' }, { status: 400 });
		}
		const [row] = await db
			.update(storyVersion)
			.set({ label: name })
			.where(eq(storyVersion.id, owned.version.id))
			.returning(infoColumns);
		return json(toInfo(row));
	};

	return { list, keep, one, rename };
}
