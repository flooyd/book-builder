import { redirect } from '@sveltejs/kit';
import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { book } from '$lib/server/db/schema';
import { profileOf } from '$lib/server/profile';
import type { PageServerLoad } from './$types';

// Your profile and account settings.
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	const shared = await db
		.select({ id: book.id })
		.from(book)
		.where(and(eq(book.userId, locals.user.id), isNotNull(book.shareId)));
	return {
		profile: await profileOf(locals.user.id),
		email: locals.user.email,
		sharedBooks: shared.length
	};
};
