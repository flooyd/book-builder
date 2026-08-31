import { requireUser } from "$lib/server/auth-guard";
import { db } from "$lib/server/db";
import { part, storyText } from "$lib/server/db/schema";
import { json, type RequestEvent } from "@sveltejs/kit";
import { eq, asc } from "drizzle-orm";

export const GET = async (event: RequestEvent) => {
    const { id } = event.params;
    const partId = Number(id);

    if (!Number.isInteger(partId)) {
        return json({ error: "Invalid part id" }, { status: 400 });
    }

    //get story text
    const storyTextData = await db.select().from(storyText).where(eq(storyText.partId, partId)).orderBy(asc(storyText.createdAt));
    return json(storyTextData);
}

export const POST = async (event: RequestEvent) => {
    const { id } = event.params;
    const partId = Number(id);
    const user = requireUser(event);

    if(!user) {
        return json({ error: "Unauthorized" }, { status: 401 });
    }

    const existingPart = await db.select().from(part).where(eq(part.userId, user.id))

    if(existingPart.length === 0) {
        return json({error: "Unauthorized"}, {status: 401})
    }

    if (!Number.isInteger(partId)) {
        return json({ error: "Invalid part id" }, { status: 400 });
    }

    //check if story text already exists for this part
    const existingStoryText = await db.select().from(storyText).where(eq(storyText.partId, partId));

    if (existingStoryText.length > 0) {
        return json({ error: "Story text already exists for this part" }, { status: 400 });
    }

    const { content } = await event.request.json();
    const newStoryText = await db.insert(storyText).values({ partId, content });
    return json(newStoryText);
}

export const PUT = async (event: RequestEvent) => {
    const { id } = event.params;
    const partId = Number(id);
    const user = requireUser(event);

    if (!user) {
        return json({ error: "Unauthorized" }, { status: 401 });
    }

    const existingPart = await db.select().from(part).where(eq(part.userId, user.id));

    if (existingPart.length === 0) {
        return json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!Number.isInteger(partId)) {
        return json({ error: "Invalid part id" }, { status: 400 });
    }

    const existingStoryText = await db.select().from(storyText).where(eq(storyText.partId, partId));

    if (existingStoryText.length === 0) {
        return json({ error: "Story text does not exist for this part" }, { status: 404 });
    }

    const { content } = await event.request.json();
    const updatedStoryText = await db.update(storyText)
        .set({ content })
        .where(eq(storyText.partId, partId))
        .returning();

    return json(updatedStoryText[0]);
}
