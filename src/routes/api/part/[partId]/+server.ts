import { requireUser } from '$lib/server/auth-guard';
import { db } from '$lib/server/db';
import { chapter, part, storyText } from '$lib/server/db/schema';
import { findOwnedPart } from '$lib/server/ownership';
import { readDetails } from '$lib/server/outline';
import { and, eq, ne, sql } from 'drizzle-orm';
import { json, type RequestEvent } from '@sveltejs/kit';

function partId(event: RequestEvent) {
	const id = Number(event.params.partId);
	return Number.isInteger(id) ? id : null;
}

export const GET = async (event: RequestEvent) => {
	const user = requireUser(event);
	const id = partId(event);
	if (id === null) return json({ error: 'Invalid part id' }, { status: 400 });

	const partData = await findOwnedPart(user.id, id);
	if (!partData) {
		return json({ error: 'Part not found' }, { status: 404 });
	}
	return json(partData);
};

/**
 * Update any of a part's title, description, showDescription and status, and hasChapters: a part
 * can switch between holding chapters and holding story text only while it holds neither.
 * Returns the updated row.
 */
export const PUT = async (event: RequestEvent) => {
	const user = requireUser(event);
	const id = partId(event);
	if (id === null) return json({ error: 'Invalid part id' }, { status: 400 });

	const body = await event.request.json().catch(() => null);
	const details = readDetails(body);
	if ('error' in details) return details.error;
	const changes: typeof details.changes & { hasChapters?: number } = details.changes;

	const found = await findOwnedPart(user.id, id);
	if (!found) return json({ error: 'Part not found' }, { status: 404 });

	if (body?.hasChapters !== undefined) {
		const hasChapters = Number(body.hasChapters) ? 1 : 0;
		if (hasChapters !== found.hasChapters) {
			const [{ count }] = hasChapters
				? await db
						.select({ count: sql<number>`count(*)::int` })
						.from(storyText)
						.where(and(eq(storyText.partId, id), ne(sql`btrim(${storyText.content})`, '')))
				: await db
						.select({ count: sql<number>`count(*)::int` })
						.from(chapter)
						.where(eq(chapter.partId, id));
			if (count > 0) {
				return json(
					{
						error: hasChapters
							? 'This part already has story text'
							: 'This part already has chapters'
					},
					{ status: 400 }
				);
			}
			changes.hasChapters = hasChapters;
		}
	}

	if (Object.keys(changes).length === 0) {
		return json({ error: 'Nothing to change' }, { status: 400 });
	}

	const [updated] = await db.update(part).set(changes).where(eq(part.id, id)).returning();
	return json(updated);
};

// delete a part with its chapters, story text and cast
export const DELETE = async (event: RequestEvent) => {
	const user = requireUser(event);
	const id = partId(event);
	if (id === null) return json({ error: 'Invalid part id' }, { status: 400 });

	if (!(await findOwnedPart(user.id, id))) {
		return json({ error: 'Part not found' }, { status: 404 });
	}

	await db.delete(part).where(eq(part.id, id));
	return json({ id });
};
