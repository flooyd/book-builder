import { json, type RequestEvent } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth-guard';
import { ArtError, startUpload } from '$lib/server/art';

// Begin an upload: { files: [{ type, bytes }, { type, bytes }], replaces? }, the picture and its
// small copy. Returns the upload's id and, for each file, where the browser sends it.
export const POST = async (event: RequestEvent) => {
	const user = requireUser(event);
	const body = await event.request.json().catch(() => null);
	try {
		return json(await startUpload(user.id, body?.files, body?.replaces));
	} catch (error) {
		if (error instanceof ArtError) return json({ error: error.message }, { status: error.status });
		throw error;
	}
};
