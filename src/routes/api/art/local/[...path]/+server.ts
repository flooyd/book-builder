import { error, json, type RequestEvent } from '@sveltejs/kit';
import { and, eq, sql } from 'drizzle-orm';
import { looksLike } from '$lib/art';
import { requireUser } from '$lib/server/auth-guard';
import {
	isStorePath,
	LOCAL_PREFIX,
	localType,
	readLocal,
	storeMode,
	writeLocal
} from '$lib/server/art-store';
import { db } from '$lib/server/db';
import { artUpload } from '$lib/server/db/schema';

// The stand-in for Vercel Blob while the dev server runs without BLOB_READ_WRITE_TOKEN (see
// $lib/server/art-store). It serves pictures from a folder on this computer and takes the files
// of an upload under way, checking what Blob's token would. Anywhere else it isn't there at all.

function localPath(event: RequestEvent) {
	if (storeMode() !== 'local') error(404, 'Not found');
	const filePath = event.params.path ?? '';
	if (!isStorePath(filePath)) error(404, 'Not found');
	return filePath;
}

export const GET = async (event: RequestEvent) => {
	const filePath = localPath(event);
	const bytes = await readLocal(filePath);
	if (!bytes) error(404, 'Not found');
	return new Response(new Uint8Array(bytes), {
		headers: {
			'content-type': localType(filePath),
			'cache-control': 'no-cache',
			'x-content-type-options': 'nosniff'
		}
	});
};

export const PUT = async (event: RequestEvent) => {
	const user = requireUser(event);
	const filePath = localPath(event);
	const [upload] = await db
		.select()
		.from(artUpload)
		.where(
			and(
				eq(artUpload.userId, user.id),
				sql`${artUpload.paths} @> ${JSON.stringify([filePath])}::jsonb`
			)
		)
		.limit(1);
	if (!upload) return json({ error: 'That upload has run out of time.' }, { status: 403 });

	const type = localType(filePath);
	if (event.request.headers.get('content-type') !== type) {
		return json({ error: 'That isn’t the kind of picture this place takes.' }, { status: 415 });
	}
	const bytes = new Uint8Array(await event.request.arrayBuffer());
	if (!bytes.length || bytes.length > upload.bytes || !looksLike(type, bytes)) {
		return json({ error: 'That picture is too big, or isn’t one.' }, { status: 400 });
	}
	try {
		await writeLocal(filePath, bytes);
	} catch {
		return json({ error: 'Something is already there.' }, { status: 409 });
	}
	return json({ url: LOCAL_PREFIX + filePath, pathname: filePath });
};
