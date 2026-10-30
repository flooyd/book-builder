import { requireUser } from '$lib/server/auth-guard';
import { db } from '$lib/server/db';
import { storyText } from '$lib/server/db/schema';
import { findOwnedPart } from '$lib/server/ownership';
import { json, type RequestEvent } from '@sveltejs/kit';
import { eq, asc } from 'drizzle-orm';

// Every handler checks that the signed-in user owns *this* part (previously POST/PUT only
// checked that they owned some part, and GET checked nothing).
async function ownedPartId(event: RequestEvent) {
	const user = requireUser(event);
	const partId = Number(event.params.id);

	if (!Number.isInteger(partId)) {
		return { error: json({ error: 'Invalid part id' }, { status: 400 }) };
	}
	if (!(await findOwnedPart(user.id, partId))) {
		return { error: json({ error: 'Part not found' }, { status: 404 }) };
	}
	return { partId };
}

async function readContent(event: RequestEvent) {
	const body = await event.request.json().catch(() => null);
	return typeof body?.content === 'string' ? body.content : null;
}

export const GET = async (event: RequestEvent) => {
	const owned = await ownedPartId(event);
	if ('error' in owned) return owned.error;
	const { partId } = owned;

	//get story text
	const storyTextData = await db
		.select()
		.from(storyText)
		.where(eq(storyText.partId, partId))
		.orderBy(asc(storyText.createdAt));
	return json(storyTextData);
};

export const POST = async (event: RequestEvent) => {
	const owned = await ownedPartId(event);
	if ('error' in owned) return owned.error;
	const { partId } = owned;

	//check if story text already exists for this part
	const existingStoryText = await db.select().from(storyText).where(eq(storyText.partId, partId));

	if (existingStoryText.length > 0) {
		return json({ error: 'Story text already exists for this part' }, { status: 400 });
	}

	const content = await readContent(event);
	if (content === null) {
		return json({ error: 'Content must be a string' }, { status: 400 });
	}

	const [newStoryText] = await db.insert(storyText).values({ partId, content }).returning();
	return json(newStoryText);
};

export const PUT = async (event: RequestEvent) => {
	const owned = await ownedPartId(event);
	if ('error' in owned) return owned.error;
	const { partId } = owned;

	const existingStoryText = await db.select().from(storyText).where(eq(storyText.partId, partId));

	if (existingStoryText.length === 0) {
		return json({ error: 'Story text does not exist for this part' }, { status: 404 });
	}

	const content = await readContent(event);
	if (content === null) {
		return json({ error: 'Content must be a string' }, { status: 400 });
	}

	const updatedStoryText = await db
		.update(storyText)
		.set({ content })
		.where(eq(storyText.partId, partId))
		.returning();

	return json(updatedStoryText[0]);
};
