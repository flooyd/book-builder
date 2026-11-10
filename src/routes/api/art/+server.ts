import { json, type RequestEvent } from '@sveltejs/kit';
import { ROOM_BYTES } from '$lib/art';
import { requireUser } from '$lib/server/auth-guard';
import { ArtError, finishUpload, listArt, roomUsed } from '$lib/server/art';
import { storeMode } from '$lib/server/art-store';

// The writer's art shelf: their pictures, the room they've used, and whether uploads work here.
export const GET = async (event: RequestEvent) => {
	const user = requireUser(event);
	const [pictures, used] = await Promise.all([listArt(user.id), roomUsed(user.id)]);
	return json({ pictures, used, room: ROOM_BYTES, uploads: storeMode() !== 'off' });
};

// Finish an upload begun at /api/art/upload: the server checks what reached storage, then puts
// the picture on the shelf (or in the place of the one it replaces) and returns it.
export const POST = async (event: RequestEvent) => {
	const user = requireUser(event);
	const body = await event.request.json().catch(() => null);
	try {
		const picture = await finishUpload(user.id, body?.uploadId, body ?? {});
		return json(picture);
	} catch (error) {
		if (error instanceof ArtError) return json({ error: error.message }, { status: error.status });
		throw error;
	}
};
