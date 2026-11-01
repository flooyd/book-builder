import { json, type RequestEvent } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth-guard';
import { setCast } from '$lib/server/bible';
import { findOwnedChapter, findOwnedPart } from '$lib/server/ownership';
import { isIdList } from '$lib/server/outline';
import { isEntryType } from '$lib/bible';

/**
 * Replace part of the cast of a chapter (/api/cast/chapter/[id]) or of a part that holds story
 * text (/api/cast/part/[id]): `{ type, ids }`, where `type` is character, place or system and
 * `ids` must all be the user's. The other types in that cast stay as they are.
 */
export const PUT = async (event: RequestEvent) => {
	const user = requireUser(event);
	const target = event.params.target;
	const id = Number(event.params.id);
	if ((target !== 'chapter' && target !== 'part') || !Number.isInteger(id)) {
		return json({ error: 'Unknown cast' }, { status: 404 });
	}

	const body = await event.request.json().catch(() => null);
	const type = body?.type;
	if (!isEntryType(type) || !isIdList(body?.ids)) {
		return json({ error: 'Expected { type, ids }' }, { status: 400 });
	}
	const ids = [...new Set<number>(body.ids)];

	const owned = target === 'chapter' ? findOwnedChapter(user.id, id) : findOwnedPart(user.id, id);
	if (!(await owned)) {
		return json(
			{ error: `${target === 'chapter' ? 'Chapter' : 'Part'} not found` },
			{ status: 404 }
		);
	}

	if (!(await setCast(user.id, target, id, type, ids))) {
		return json({ error: `That ${type} doesn't belong to the user` }, { status: 403 });
	}
	return json({ type, ids });
};
