import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { book } from '$lib/server/db/schema';
import { readableBook } from '$lib/server/reading';
import { READER_COOKIE, parseReaderPrefs } from '$lib/reading';
import type { PageServerLoad } from './$types';

// A shared book: anyone with the link can read it, signed in or not.
export const load: PageServerLoad = async ({ params, cookies }) => {
	const shareId = params.shareId;
	const [found] = /^[\w-]{16}$/.test(shareId)
		? await db.select().from(book).where(eq(book.shareId, shareId)).limit(1)
		: [];
	if (!found) error(404, "This book isn't shared, or the link has changed.");

	return {
		...(await readableBook(found)),
		owner: false,
		prefs: parseReaderPrefs(cookies.get(READER_COOKIE))
	};
};
