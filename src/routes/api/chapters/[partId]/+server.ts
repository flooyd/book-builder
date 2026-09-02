import { db } from '$lib/server/db';
import { chapter } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';
import { json, type RequestEvent } from '@sveltejs/kit';

export const GET = async (event: RequestEvent) => {
    const partId = String(event.params.partId);
    const chapters = await db
        .select()
        .from(chapter)
        .where(eq(chapter.partId, parseInt(partId)))
        .orderBy(asc(chapter.createdAt));
    return json(chapters);
};
