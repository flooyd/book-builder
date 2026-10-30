import { db } from '$lib/server/db';
import { part } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { json, type RequestEvent } from '@sveltejs/kit';

export const GET = async (event: RequestEvent) => {
	const partId = String(event.params.partId);
	const partData = await db
		.select()
		.from(part)
		.where(eq(part.id, parseInt(partId)))
		.limit(1);
	return json(partData[0]);
};
