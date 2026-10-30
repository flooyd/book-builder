import { db } from '$lib/server/db';
import { book } from '$lib/server/db/schema';
import { requireUser } from '$lib/server/auth-guard';
import { eq, asc } from 'drizzle-orm';
import { json, type RequestEvent } from '@sveltejs/kit';

export const GET = async (event: RequestEvent) => {
	const user = requireUser(event);
	const books = await db
		.select()
		.from(book)
		.where(eq(book.userId, user.id))
		.orderBy(asc(book.createdAt));
	return json(books);
};

export const POST = async (event: RequestEvent) => {
	const user = requireUser(event);
	const { title, description } = await event.request.json();
	const newBook = await db.insert(book).values({ title, description, userId: user.id }).returning();
	return json(newBook);
};
