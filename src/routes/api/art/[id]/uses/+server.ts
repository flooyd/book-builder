import { json, type RequestEvent } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth-guard';
import { findOwnedArt, pictureUses } from '$lib/server/art';

// The chapters and parts a picture is set in, for the dialog before it's deleted: { uses }.
export const GET = async (event: RequestEvent) => {
	const user = requireUser(event);
	const id = Number(event.params.id);
	if (!(await findOwnedArt(user.id, id))) {
		return json({ error: 'Picture not found' }, { status: 404 });
	}
	return json({ uses: await pictureUses(user.id, id) });
};
