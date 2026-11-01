import { json, type RequestEvent } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth-guard';
import { db } from '$lib/server/db';
import { entryLink } from '$lib/server/db/schema';
import { ownedEntryRef } from '$lib/server/bible';
import { textField } from '$lib/server/ownership';

const LABEL_LENGTH = 120;

/** Connect two of the writer's story bible entries: { from, to, label }. */
export const POST = async (event: RequestEvent) => {
	const user = requireUser(event);
	const body = await event.request.json().catch(() => null);
	const from = await ownedEntryRef(user.id, body?.from);
	const to = await ownedEntryRef(user.id, body?.to);
	if (!from || !to) return json({ error: 'Entry not found' }, { status: 404 });
	if (from.type === to.type && from.id === to.id) {
		return json({ error: "An entry can't be connected to itself." }, { status: 400 });
	}

	const [row] = await db
		.insert(entryLink)
		.values({
			userId: user.id,
			fromType: from.type,
			fromId: from.id,
			toType: to.type,
			toId: to.id,
			label: textField(body?.label).slice(0, LABEL_LENGTH)
		})
		.returning();
	return json(row);
};
