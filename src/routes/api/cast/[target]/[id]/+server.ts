import { json, type RequestEvent } from '@sveltejs/kit';
import { and, eq, inArray } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth-guard';
import { db } from '$lib/server/db';
import { character, chapterCharacter, partCharacter } from '$lib/server/db/schema';
import { findOwnedChapter, findOwnedPart } from '$lib/server/ownership';
import { isIdList } from '$lib/server/outline';

/**
 * Replace the cast of a chapter (/api/cast/chapter/[id]) or of a part that holds story text
 * (/api/cast/part/[id]) with `characterIds`, which must all be the user's characters.
 */
export const PUT = async (event: RequestEvent) => {
	const user = requireUser(event);
	const target = event.params.target;
	const id = Number(event.params.id);
	if ((target !== 'chapter' && target !== 'part') || !Number.isInteger(id)) {
		return json({ error: 'Unknown cast' }, { status: 404 });
	}

	const body = await event.request.json().catch(() => null);
	const ids = body?.characterIds;
	if (!isIdList(ids)) return json({ error: 'Expected { characterIds }' }, { status: 400 });
	const characterIds = [...new Set(ids)];

	const owned = target === 'chapter' ? findOwnedChapter(user.id, id) : findOwnedPart(user.id, id);
	if (!(await owned)) {
		return json(
			{ error: `${target === 'chapter' ? 'Chapter' : 'Part'} not found` },
			{ status: 404 }
		);
	}

	if (characterIds.length) {
		const mine = await db
			.select({ id: character.id })
			.from(character)
			.where(and(inArray(character.id, characterIds), eq(character.userId, user.id)));
		if (mine.length !== characterIds.length) {
			return json({ error: 'Character does not belong to the user' }, { status: 403 });
		}
	}

	await db.transaction(async (tx) => {
		if (target === 'chapter') {
			await tx.delete(chapterCharacter).where(eq(chapterCharacter.chapterId, id));
			if (characterIds.length) {
				await tx
					.insert(chapterCharacter)
					.values(characterIds.map((characterId) => ({ chapterId: id, characterId })));
			}
		} else {
			await tx.delete(partCharacter).where(eq(partCharacter.partId, id));
			if (characterIds.length) {
				await tx
					.insert(partCharacter)
					.values(characterIds.map((characterId) => ({ partId: id, characterId })));
			}
		}
	});

	return json({ characterIds });
};
