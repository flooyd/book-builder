import { db } from '$lib/server/db';
import { system } from '$lib/server/db/schema';
import { requireUser } from '$lib/server/auth-guard';
import { findOwnedBook, textField } from '$lib/server/ownership';
import { asc, eq } from 'drizzle-orm';
import { json, type RequestEvent } from '@sveltejs/kit';

export const GET = async (event: RequestEvent) => {
	const user = requireUser(event);
	const systems = await db
		.select()
		.from(system)
		.where(eq(system.userId, user.id))
		.orderBy(asc(system.createdAt));
	return json(systems);
};

export const POST = async (event: RequestEvent) => {
	const user = requireUser(event);
	const body = await event.request.json().catch(() => null);
	const name = textField(body?.name);
	const description = textField(body?.description);
	const kind = textField(body?.kind);
	const bookId = Number(body?.bookId);

	if (!name) {
		return json({ error: 'Name is required' }, { status: 400 });
	}
	if (!Number.isInteger(bookId)) {
		return json({ error: 'Invalid book id' }, { status: 400 });
	}
	if (!(await findOwnedBook(user.id, bookId))) {
		return json({ error: 'Book does not belong to the user' }, { status: 403 });
	}

	const [created] = await db
		.insert(system)
		.values({ name, description, kind, bookId, userId: user.id })
		.returning();
	return json(created);
};
