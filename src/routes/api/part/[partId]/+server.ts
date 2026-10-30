import { requireUser } from '$lib/server/auth-guard';
import { db } from '$lib/server/db';
import { part } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { json, type RequestEvent } from '@sveltejs/kit';

export const GET = async (event: RequestEvent) => {
	const partId = String(event.params.partId);
	const partData = await db
		.select()
		.from(part)
		.where(eq(part.id, parseInt(partId)))
		.limit(1);
	return json(partData[0]);
};

// update a part's title and/or description; returns the updated row
export const PUT = async (event: RequestEvent) => {
	const user = requireUser(event);
	const id = Number(event.params.partId);

	if (!Number.isInteger(id)) {
		return json({ error: 'Invalid part id' }, { status: 400 });
	}

	const body = await event.request.json().catch(() => null);
	const title = typeof body?.title === 'string' ? body.title.trim() : '';
	if (!title) {
		return json({ error: 'Title is required' }, { status: 400 });
	}

	const changes: { title: string; description?: string } = { title };
	if (typeof body?.description === 'string') changes.description = body.description.trim();

	const [updated] = await db
		.update(part)
		.set(changes)
		.where(and(eq(part.id, id), eq(part.userId, user.id)))
		.returning();

	if (!updated) {
		return json({ error: 'Part not found' }, { status: 404 });
	}

	return json(updated);
};
