import { requireUser } from '$lib/server/auth-guard';
import { db } from '$lib/server/db';
import { chapter } from '$lib/server/db/schema';
import { findOwnedPart } from '$lib/server/ownership';
import { eq, asc } from 'drizzle-orm';
import { json, type RequestEvent } from '@sveltejs/kit';

export const GET = async (event: RequestEvent) => {
	const user = requireUser(event);
	const partId = Number(event.params.partId);

	if (!Number.isInteger(partId)) {
		return json({ error: 'Invalid part id' }, { status: 400 });
	}

	if (!(await findOwnedPart(user.id, partId))) {
		return json({ error: 'Part not found' }, { status: 404 });
	}

	const chapters = await db
		.select()
		.from(chapter)
		.where(eq(chapter.partId, partId))
		.orderBy(asc(chapter.createdAt));
	return json(chapters);
};
