import { requireUser } from '$lib/server/auth-guard';
import { db } from '$lib/server/db';
import { chapter } from '$lib/server/db/schema';
import { findOwnedChapter, textField } from '$lib/server/ownership';
import { eq } from 'drizzle-orm';
import { json, type RequestEvent } from '@sveltejs/kit';

// update a chapter's title and/or description; returns the updated row
export const PUT = async (event: RequestEvent) => {
	const user = requireUser(event);
	const id = Number(event.params.id);

	if (!Number.isInteger(id)) {
		return json({ error: 'Invalid chapter id' }, { status: 400 });
	}

	const body = await event.request.json().catch(() => null);
	const title = textField(body?.title);
	if (!title) {
		return json({ error: 'Title is required' }, { status: 400 });
	}

	if (!(await findOwnedChapter(user.id, id))) {
		return json({ error: 'Chapter not found' }, { status: 404 });
	}

	const changes: { title: string; description?: string } = { title };
	if (typeof body?.description === 'string') changes.description = body.description.trim();

	const [updated] = await db.update(chapter).set(changes).where(eq(chapter.id, id)).returning();
	return json(updated);
};
