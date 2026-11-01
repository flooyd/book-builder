import { json, type RequestEvent } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth-guard';
import { db } from '$lib/server/db';
import { entryLink } from '$lib/server/db/schema';

/** Remove a connection between two story bible entries. */
export const DELETE = async (event: RequestEvent) => {
	const user = requireUser(event);
	const id = Number(event.params.id);
	if (!Number.isInteger(id)) return json({ error: 'Invalid connection id' }, { status: 400 });

	const removed = await db
		.delete(entryLink)
		.where(and(eq(entryLink.id, id), eq(entryLink.userId, user.id)))
		.returning({ id: entryLink.id });
	if (removed.length === 0) return json({ error: 'Connection not found' }, { status: 404 });
	return json({ id });
};
