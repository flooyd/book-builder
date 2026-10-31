import { json, type RequestEvent } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth-guard';
import { db } from '$lib/server/db';
import { book, chapter, part, storyText } from '$lib/server/db/schema';
import { findOwnedChapter, findOwnedPart } from '$lib/server/ownership';
import { cleanValue } from '$lib/rich';
import { recordWords, todayFor, wordsIn } from '$lib/server/goals';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * GET / POST / PUT handlers for the story text of a part (with no chapters) or of a chapter,
 * at /api/story-text/{part|chapter}/[id]. Every handler checks that the signed-in user owns
 * *this* part or chapter. Saving text counts as editing: the chapter or part, the part above
 * and the book become "updated" too, and the response says when (`touchedAt`). It also counts
 * toward the writer's daily goal, and the response says how many words that added and the
 * day's total (`writing`).
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
			const [row] = await tx
				.insert(storyText)
				.values({ ...link, content, createdAt: at, updatedAt: at })
				.returning();
			await touch(tx, owned.id, at);
			const delta = wordsIn(content);
			return {
				row,
				writing: { day, delta, today: await recordWords(tx, owned.userId, day, delta) }
			};
		});
		return json({ ...created.row, touchedAt: at.toISOString(), writing: created.writing });
	};

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

		const at = new Date();
		const day = todayFor(event);
		const before = wordsIn(existing[0].content);
		const updated = await db.transaction(async (tx) => {
			const [row] = await tx
				.update(storyText)
				.set({ content, updatedAt: at })
				.where(eq(column, owned.id))
				.returning();
			await touch(tx, owned.id, at);
			const delta = wordsIn(content) - before;
			return {
				row,
				writing: { day, delta, today: await recordWords(tx, owned.userId, day, delta) }
			};
		});
		return json({ ...updated.row, touchedAt: at.toISOString(), writing: updated.writing });
	};

	return { GET, POST, PUT };
}
