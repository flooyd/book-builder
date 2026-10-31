import { json, type RequestEvent } from '@sveltejs/kit';
import { and, eq, ne } from 'drizzle-orm';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import { requireUser } from '$lib/server/auth-guard';
import { db } from '$lib/server/db';
import { profile } from '$lib/server/db/schema';
import { descriptionField, textField } from '$lib/server/ownership';
import { profileOf } from '$lib/server/profile';
import { cleanWebsite, handleProblem } from '$lib/profile';

/**
 * Save the signed-in author's settings: name (the "by" line on their books), bio, website, and
 * whether their page is public at /author/<handle>. Returns the saved settings and name.
 */
export const PUT = async (event: RequestEvent) => {
	const me = requireUser(event);
	const body = await event.request.json().catch(() => null);
	if (!body || typeof body !== 'object') {
		return json({ error: 'Expected a JSON object' }, { status: 400 });
	}

	const name = textField(body.name);
	if (!name) return json({ error: 'Add your name.' }, { status: 400 });
	if (name.length > 80)
		return json({ error: 'Keep your name under 80 characters.' }, { status: 400 });

	const website = cleanWebsite(textField(body.website));
	if (website === null) {
		return json({ error: "That website doesn't look like a web address." }, { status: 400 });
	}

	const isPublic = body.isPublic === true;
	const handle = textField(body.handle).toLowerCase() || null;
	if (handle) {
		const problem = handleProblem(handle);
		if (problem) return json({ error: problem }, { status: 400 });
		const [taken] = await db
			.select({ userId: profile.userId })
			.from(profile)
			.where(and(eq(profile.handle, handle), ne(profile.userId, me.id)))
			.limit(1);
		if (taken) return json({ error: 'That address is taken. Try another.' }, { status: 409 });
	} else if (isPublic) {
		return json({ error: 'Choose an address for your public page.' }, { status: 400 });
	}

	const values = { handle, bio: descriptionField(body.bio), website, isPublic };
	await db
		.insert(profile)
		.values({ userId: me.id, ...values })
		.onConflictDoUpdate({ target: profile.userId, set: values });

	if (name !== me.name) {
		try {
			await auth.api.updateUser({ body: { name }, headers: event.request.headers });
		} catch (error) {
			const message = error instanceof APIError ? error.message : "Couldn't save your name.";
			return json({ error: message }, { status: 400 });
		}
	}

	return json({ name, ...(await profileOf(me.id)) });
};
