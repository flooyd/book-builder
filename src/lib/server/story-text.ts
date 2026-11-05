import { json, type RequestEvent } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth-guard';
import { db } from '$lib/server/db';
import { book, chapter, part, storyText } from '$lib/server/db/schema';
import { findOwnedChapter, findOwnedPart } from '$lib/server/ownership';
import { cleanValue } from '$lib/rich';
import { dayFor, recordWords, todayFor, wordsIn } from '$lib/server/goals';
import { castNamed, indexMentions, ownedMentions } from '$lib/server/bible';
import { findVersion, keepVersion } from '$lib/server/story-versions';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * GET / POST / PUT handlers for the story text of a part (with no chapters) or of a chapter,
 * at /api/story-text/{part|chapter}/[id]. Every handler checks that the signed-in user owns
 * *this* part or chapter. Saving text counts as editing: the chapter or part, the part above
 * and the book become "updated" too, and the response says when (`touchedAt`). It also counts
 * toward the writer's daily goal, and the response says how many words that added and the
 * day's total (`writing`). Mentions in the text are indexed in the same transaction, and the
 * response lists any entries that joined the book by being mentioned (`linked`). Anyone in the
 * book's story bible named in the text for the first time joins its cast (`castNamed`). A save
 * that replaces text keeps a version of what it replaced when one is due (`keepVersion`), and
 * `RESTORE` puts a version back.
 */
export function storyTextHandlers(target: 'part' | 'chapter') {
	const column = target === 'part' ? storyText.partId : storyText.chapterId;
	const findOwned = target === 'part' ? findOwnedPart : findOwnedChapter;
	const label = target === 'part' ? 'Part' : 'Chapter';

	async function ownedId(event: RequestEvent) {
		const user = requireUser(event);
		const id = Number(event.params.id);

		if (!Number.isInteger(id)) {
			return { error: json({ error: `Invalid ${target} id` }, { status: 400 }) };
		}
		if (!(await findOwned(user.id, id))) {
			return { error: json({ error: `${label} not found` }, { status: 404 }) };
		}
		return { id, userId: user.id };
	}

	async function touch(tx: Tx, id: number, at: Date) {
		let partId = id;
		if (target === 'chapter') {
			const [row] = await tx
				.update(chapter)
				.set({ updatedAt: at })
				.where(eq(chapter.id, id))
				.returning({ partId: chapter.partId });
			partId = row.partId;
		}
		const [row] = await tx
			.update(part)
			.set({ updatedAt: at })
			.where(eq(part.id, partId))
			.returning({ bookId: part.bookId });
		await tx.update(book).set({ updatedAt: at }).where(eq(book.id, row.bookId));
		return row.bookId;
	}

	// Plain text, or the editor's document cleaned against its allow-list (see $lib/rich).
	async function readContent(event: RequestEvent) {
		const body = await event.request.json().catch(() => null);
		return typeof body?.content === 'string' ? cleanValue(body.content, 'story') : null;
	}

	const GET = async (event: RequestEvent) => {
		const owned = await ownedId(event);
		if ('error' in owned) return owned.error;

		const rows = await db
			.select()
			.from(storyText)
			.where(eq(column, owned.id))
			.orderBy(asc(storyText.createdAt));
		return json(rows);
	};

	const POST = async (event: RequestEvent) => {
		const owned = await ownedId(event);
		if ('error' in owned) return owned.error;

		const existing = await db.select().from(storyText).where(eq(column, owned.id));
		if (existing.length > 0) {
			return json({ error: `Story text already exists for this ${target}` }, { status: 400 });
		}

		const content = await readContent(event);
		if (content === null) {
			return json({ error: 'Content must be a string' }, { status: 400 });
		}

		const link = target === 'part' ? { partId: owned.id } : { chapterId: owned.id };
		const at = new Date();
		const day = todayFor(event);
		const created = await db.transaction(async (tx) => {
			const kept = await ownedMentions(tx, owned.userId, content);
			const [row] = await tx
				.insert(storyText)
				.values({ ...link, content: kept, createdAt: at, updatedAt: at })
				.returning();
			const bookId = await touch(tx, owned.id, at);
			const linked = await indexMentions(tx, {
				storyTextId: row.id,
				content: kept,
				target,
				targetId: owned.id,
				bookId
			});
			await castNamed(tx, { target, targetId: owned.id, bookId, before: '', after: kept });
			const delta = wordsIn(kept);
			return {
				row,
				linked,
				writing: { day, delta, today: await recordWords(tx, owned.userId, day, delta) }
			};
		});
		return json({
			...created.row,
			touchedAt: at.toISOString(),
			writing: created.writing,
			linked: created.linked
		});
	};

	/**
	 * Replace the saved text with `content`, keeping a version of the text it replaces when one is
	 * due. A restore always keeps one, and its change in words counts toward today only when the
	 * version was kept today: then it undoes today's edits, and otherwise it would count old words
	 * as new.
	 */
	async function replace(
		event: RequestEvent,
		owned: { id: number; userId: string },
		existing: typeof storyText.$inferSelect,
		content: string,
		restoring?: { createdAt: Date }
	) {
		const at = new Date();
		const day = todayFor(event);
		const before = wordsIn(existing.content);
		const updated = await db.transaction(async (tx) => {
			const kept = await ownedMentions(tx, owned.userId, content);
			const after = wordsIn(kept);
			const version =
				kept === existing.content && !restoring
					? null
					: await keepVersion(tx, existing, { nextWords: after, now: at, always: !!restoring });
			const [row] = await tx
				.update(storyText)
				.set({ content: kept, updatedAt: at })
				.where(eq(column, owned.id))
				.returning();
			const bookId = await touch(tx, owned.id, at);
			const linked = await indexMentions(tx, {
				storyTextId: row.id,
				content: kept,
				target,
				targetId: owned.id,
				bookId
			});
			await castNamed(tx, {
				target,
				targetId: owned.id,
				bookId,
				before: existing.content,
				after: kept
			});
			const counts = !restoring || dayFor(event, restoring.createdAt) === day;
			const delta = counts ? after - before : 0;
			return {
				row,
				linked,
				version,
				writing: { day, delta, today: await recordWords(tx, owned.userId, day, delta) }
			};
		});
		return {
			...updated.row,
			touchedAt: at.toISOString(),
			writing: updated.writing,
			linked: updated.linked,
			/** The version that holds the text from before this save, if any (a restore's undo). */
			kept: updated.version
		};
	}

	const PUT = async (event: RequestEvent) => {
		const owned = await ownedId(event);
		if ('error' in owned) return owned.error;

		const existing = await db.select().from(storyText).where(eq(column, owned.id));
		if (existing.length === 0) {
			return json({ error: `Story text does not exist for this ${target}` }, { status: 404 });
		}

		const content = await readContent(event);
		if (content === null) {
			return json({ error: 'Content must be a string' }, { status: 400 });
		}

		return json(await replace(event, owned, existing[0], content));
	};

	/**
	 * POST /api/story-text/{part|chapter}/[id]/versions/[versionId]/restore: put a version back.
	 * The text it replaces is kept as a version first, so a restore can be undone the same way.
	 */
	const RESTORE = async (event: RequestEvent) => {
		const owned = await ownedId(event);
		if ('error' in owned) return owned.error;

		const existing = await db.select().from(storyText).where(eq(column, owned.id));
		const versionId = Number(event.params.versionId);
		const version =
			existing.length > 0 && Number.isInteger(versionId)
				? await findVersion(existing[0].id, versionId)
				: undefined;
		if (!version) return json({ error: 'Version not found' }, { status: 404 });

		// Cleaned again: the allow-list may have changed since the version was saved.
		const content = cleanValue(version.content, 'story');
		return json(await replace(event, owned, existing[0], content, version));
	};

	return { GET, POST, PUT, RESTORE };
}
