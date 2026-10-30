import { db } from '$lib/server/db';
import { system, systemBook } from '$lib/server/db/schema';
import { requireUser } from '$lib/server/auth-guard';
import { ownedBookIds, textField } from '$lib/server/ownership';
import { and, eq } from 'drizzle-orm';
import { json, type RequestEvent } from '@sveltejs/kit';

// Update a system's details and the books it applies to; returns it with its bookIds.
export const PUT = async (event: RequestEvent) => {
	const user = requireUser(event);
	const id = Number(event.params.id);

	if (!Number.isInteger(id)) {
		return json({ error: 'Invalid system id' }, { status: 400 });
	}

	const [existing] = await db
		.select()
		.from(system)
		.where(and(eq(system.id, id), eq(system.userId, user.id)))
		.limit(1);
	if (!existing) {
		return json({ error: 'System not found' }, { status: 404 });
	}

	const body = await event.request.json().catch(() => null);
	const name = textField(body?.name);
	if (!name) {
		return json({ error: 'Name is required' }, { status: 400 });
	}

	const books = await ownedBookIds(user.id, body?.bookIds);
	if ('error' in books) return books.error;
	const { bookIds } = books;

	const updated = await db.transaction(async (tx) => {
		const [row] = await tx
			.update(system)
			.set({ name, description: textField(body?.description), kind: textField(body?.kind) })
			.where(eq(system.id, id))
			.returning();
		await tx.delete(systemBook).where(eq(systemBook.systemId, id));
		await tx.insert(systemBook).values(bookIds.map((bookId) => ({ systemId: id, bookId })));
		return row;
	});

	return json({ ...updated, bookIds });
};
