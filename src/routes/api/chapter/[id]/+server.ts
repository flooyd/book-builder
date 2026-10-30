import { requireUser } from '$lib/server/auth-guard';
import { db } from '$lib/server/db';
import { chapter } from '$lib/server/db/schema';
import { findOwnedChapter } from '$lib/server/ownership';
import { readDetails } from '$lib/server/outline';
import { eq } from 'drizzle-orm';
import { json, type RequestEvent } from '@sveltejs/kit';

function chapterId(event: RequestEvent) {
	const id = Number(event.params.id);
	return Number.isInteger(id) ? id : null;
}

// update any of a chapter's title, description, showDescription and status; returns the row
export const PUT = async (event: RequestEvent) => {
	const user = requireUser(event);
	const id = chapterId(event);
	if (id === null) return json({ error: 'Invalid chapter id' }, { status: 400 });

	const details = readDetails(await event.request.json().catch(() => null));
	if ('error' in details) return details.error;
	if (Object.keys(details.changes).length === 0) {
		return json({ error: 'Nothing to change' }, { status: 400 });
	}

	if (!(await findOwnedChapter(user.id, id))) {
		return json({ error: 'Chapter not found' }, { status: 404 });
	}

	const [updated] = await db
		.update(chapter)
		.set(details.changes)
		.where(eq(chapter.id, id))
		.returning();
	return json(updated);
};

// delete a chapter with its story text and cast
export const DELETE = async (event: RequestEvent) => {
	const user = requireUser(event);
	const id = chapterId(event);
	if (id === null) return json({ error: 'Invalid chapter id' }, { status: 400 });

	if (!(await findOwnedChapter(user.id, id))) {
		return json({ error: 'Chapter not found' }, { status: 404 });
	}

	await db.delete(chapter).where(eq(chapter.id, id));
	return json({ id });
};
