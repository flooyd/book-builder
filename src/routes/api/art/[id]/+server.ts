import { json, type RequestEvent } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth-guard';
import { deleteArt, describeArt } from '$lib/server/art';

// Rename a picture or change its description: { title?, description? }.
export const PUT = async (event: RequestEvent) => {
	const user = requireUser(event);
	const body = await event.request.json().catch(() => null);
	const picture = await describeArt(user.id, Number(event.params.id), body ?? {});
	if (!picture) return json({ error: 'Picture not found' }, { status: 404 });
	return json(picture);
};

// Take a picture off the shelf, files and all. Any cover it was on goes back to the drawn one.
export const DELETE = async (event: RequestEvent) => {
	const user = requireUser(event);
	if (!(await deleteArt(user.id, Number(event.params.id)))) {
		return json({ error: 'Picture not found' }, { status: 404 });
	}
	return json({ ok: true });
};
