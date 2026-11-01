import { json, type RequestEvent } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth-guard';
import { db } from '$lib/server/db';
import { series } from '$lib/server/db/schema';
import { descriptionField, textField } from '$lib/server/ownership';

/** The series' title and, if sent, its description. */
export const PUT = async (event: RequestEvent) => {
	const user = requireUser(event);
	const id = Number(event.params.id);
	if (!Number.isInteger(id)) return json({ error: 'Invalid series id' }, { status: 400 });

	const body = await event.request.json().catch(() => null);
	const title = textField(body?.title);
	if (!title) return json({ error: 'Title is required' }, { status: 400 });

	const changes: { title: string; description?: string } = { title };
	if (typeof body?.description === 'string') {
		changes.description = descriptionField(body.description);
	}

	const [updated] = await db
		.update(series)
		.set(changes)
		.where(and(eq(series.id, id), eq(series.userId, user.id)))
		.returning();
	if (!updated) return json({ error: 'Series not found' }, { status: 404 });
	return json(updated);
};

/** The series goes; its books stay, on their own, with everything in them. */
export const DELETE = async (event: RequestEvent) => {
	const user = requireUser(event);
	const id = Number(event.params.id);
	if (!Number.isInteger(id)) return json({ error: 'Invalid series id' }, { status: 400 });

	const [deleted] = await db
		.delete(series)
		.where(and(eq(series.id, id), eq(series.userId, user.id)))
		.returning({ id: series.id });
	if (!deleted) return json({ error: 'Series not found' }, { status: 404 });
	return json(deleted);
};
