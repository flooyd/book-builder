import { json } from '@sveltejs/kit';
import { asc, inArray, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { storyText } from '$lib/server/db/schema';
import { descriptionField, textField } from '$lib/server/ownership';
import { isStatus, type Status } from '$lib/status';

export type DetailChanges = {
	title?: string;
	description?: string;
	showDescription?: boolean;
	status?: Status;
};

/**
 * The fields a PUT to a part or chapter may change: any of title (not empty), description,
 * showDescription and status. Returns the changes, or an error response to send back.
 */
export function readDetails(body: unknown): { changes: DetailChanges } | { error: Response } {
	if (!body || typeof body !== 'object') {
		return { error: json({ error: 'Expected a JSON object' }, { status: 400 }) };
	}
	const fields = body as Record<string, unknown>;
	const changes: DetailChanges = {};

	if ('title' in fields) {
		const title = textField(fields.title);
		if (!title) return { error: json({ error: 'Title is required' }, { status: 400 }) };
		changes.title = title;
	}
	if (typeof fields.description === 'string') {
		changes.description = descriptionField(fields.description);
	}
	if (typeof fields.showDescription === 'boolean') {
		changes.showDescription = fields.showDescription;
	}
	if ('status' in fields) {
		if (!isStatus(fields.status)) {
			return { error: json({ error: 'Unknown status' }, { status: 400 }) };
		}
		changes.status = fields.status;
	}
	return { changes };
}

/** A list of integer ids (possibly empty). */
export const isIdList = (value: unknown): value is number[] =>
	Array.isArray(value) && value.every((id) => Number.isInteger(id));

/** The same ids, each exactly once. */
export function sameIds(listed: number[], actual: number[]) {
	const set = new Set(listed);
	return (
		set.size === listed.length && set.size === actual.length && actual.every((id) => set.has(id))
	);
}

/**
 * Story text of the given parts and chapters, keyed like the section anchors ("part-3",
 * "chapter-12"). The oldest row wins, as in the editor.
 */
export async function storyTexts(partIds: number[], chapterIds: number[]) {
	const rows =
		partIds.length || chapterIds.length
			? await db
					.select({
						partId: storyText.partId,
						chapterId: storyText.chapterId,
						content: storyText.content
					})
					.from(storyText)
					.where(
						or(
							partIds.length ? inArray(storyText.partId, partIds) : undefined,
							chapterIds.length ? inArray(storyText.chapterId, chapterIds) : undefined
						)
					)
					.orderBy(asc(storyText.createdAt))
			: [];

	const texts: Record<string, string> = {};
	for (const row of rows) {
		const key = row.chapterId ? `chapter-${row.chapterId}` : `part-${row.partId}`;
		texts[key] ??= row.content;
	}
	return texts;
}
