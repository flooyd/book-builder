import { json, type RequestEvent } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { requireUser } from '$lib/server/auth-guard';
import { authMessage } from '$lib/server/account';
import { ACCOUNT_PHRASE, typedTitle } from '$lib/confirm';

// Delete the signed-in writer's account and everything in it, for good: their books, series and
// story bible all cascade from the user row (see the schema). It takes the typed phrase and the
// password, checked here as well as in the dialog.
export const DELETE = async (event: RequestEvent) => {
	requireUser(event);
	const body = await event.request.json().catch(() => null);
	const typed = typeof body?.typed === 'string' ? body.typed : '';
	const password = typeof body?.password === 'string' ? body.password : '';
	if (!typedTitle(typed, ACCOUNT_PHRASE)) {
		return json({ error: `Type “${ACCOUNT_PHRASE}” to confirm.` }, { status: 400 });
	}
	if (!password) return json({ error: 'Enter your password to confirm.' }, { status: 400 });

	try {
		await auth.api.deleteUser({ body: { password }, headers: event.request.headers });
	} catch (error) {
		const message = authMessage(error, "Couldn't delete your account.");
		if (message) return json({ error: message }, { status: 400 });
		throw error;
	}
	return json({ ok: true });
};
