import { json, type RequestEvent } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import { requireUser } from '$lib/server/auth-guard';

const MESSAGES: Record<string, string> = {
	INVALID_PASSWORD: "Your current password isn't right.",
	PASSWORD_TOO_SHORT: 'Use at least 8 characters for your new password.',
	PASSWORD_TOO_LONG: 'That password is too long.'
};

// Change the signed-in author's password; optionally sign out every other device.
export const PUT = async (event: RequestEvent) => {
	requireUser(event);
	const body = await event.request.json().catch(() => null);
	const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
	const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';
	if (!currentPassword || !newPassword) {
		return json({ error: 'Fill in both passwords.' }, { status: 400 });
	}

	try {
		await auth.api.changePassword({
			body: { currentPassword, newPassword, revokeOtherSessions: body?.signOutOthers === true },
			headers: event.request.headers
		});
	} catch (error) {
		if (error instanceof APIError) {
			const code = (error.body as { code?: string } | undefined)?.code;
			return json(
				{ error: (code && MESSAGES[code]) || error.message || "Couldn't change your password." },
				{ status: 400 }
			);
		}
		throw error;
	}
	return json({ ok: true });
};
