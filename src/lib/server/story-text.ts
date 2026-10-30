import { json, type RequestEvent } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth-guard';
import { db } from '$lib/server/db';
import { storyText } from '$lib/server/db/schema';
import { findOwnedChapter, findOwnedPart } from '$lib/server/ownership';

/**
 * GET / POST / PUT handlers for the story text of a part (with no chapters) or of a chapter,
 * at /api/story-text/{part|chapter}/[id]. Every handler checks that the signed-in user owns
 * *this* part or chapter.
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
		return { id };
	}

	async function readContent(event: RequestEvent) {
		const body = await event.request.json().catch(() => null);
		return typeof body?.content === 'string' ? body.content : null;
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
		const [created] = await db
			.insert(storyText)
			.values({ ...link, content })
			.returning();
		return json(created);
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

		const [updated] = await db
			.update(storyText)
			.set({ content })
			.where(eq(column, owned.id))
			.returning();
		return json(updated);
	};

	return { GET, POST, PUT };
}
