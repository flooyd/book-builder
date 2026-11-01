import { json, type RequestEvent } from '@sveltejs/kit';
import { and, asc, eq, inArray, or } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth-guard';
import { db } from '$lib/server/db';
import {
	chapter,
	chapterCharacter,
	character,
	characterBook,
	entryLink,
	part,
	partCharacter,
	place,
	placeBook,
	storyMention,
	storyText,
	system,
	systemBook
} from '$lib/server/db/schema';
import { descriptionField, ownedBookIds, textField } from '$lib/server/ownership';
import {
	ENTRY_TYPES,
	cleanAliases,
	cleanDetails,
	isEntryType,
	renamedLabel,
	type Appearance,
	type EntryDetail,
	type EntryType
} from '$lib/bible';
import { mapMentions, mentionsIn } from '$lib/rich';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// The story bible on the server: characters, places and systems, the books they belong to, and
// which story text mentions them. The three tables share their columns (only places and systems
// have a `kind`), so one set of handlers serves all of them.

const TABLES = { character, place, system };
const tableOf = (type: EntryType) => TABLES[type] as unknown as typeof place;

const LINKS = {
	character: { table: characterBook, entry: characterBook.characterId, key: 'characterId' },
	place: { table: placeBook, entry: placeBook.placeId, key: 'placeId' },
	system: { table: systemBook, entry: systemBook.systemId, key: 'systemId' }
};
/** An entry's link to its books. The three link tables differ only in that one column's name. */
const linkOf = (type: EntryType) =>
	LINKS[type] as unknown as {
		table: typeof placeBook;
		entry: typeof placeBook.placeId;
		key: 'placeId';
	};
const linkRow = (type: EntryType, entryId: number, bookId: number) =>
	({ [linkOf(type).key]: entryId, bookId }) as typeof placeBook.$inferInsert;

/** The entry, if it exists and belongs to the user. */
export async function findEntry(userId: string, type: EntryType, id: number) {
	const table = tableOf(type);
	const [row] = await db
		.select()
		.from(table)
		.where(and(eq(table.id, id), eq(table.userId, userId)))
		.limit(1);
	return row;
}

type EntryChanges = {
	name?: string;
	description?: string;
	kind?: string;
	aliases?: string[];
	details?: EntryDetail[];
	notes?: string;
};

/** The fields a request may change; only the ones it sends. */
function readEntry(
	type: EntryType,
	body: unknown
): { changes: EntryChanges } | { error: Response } {
	if (!body || typeof body !== 'object') {
		return { error: json({ error: 'Expected a JSON object' }, { status: 400 }) };
	}
	const fields = body as Record<string, unknown>;
	const changes: EntryChanges = {};

	if ('name' in fields) {
		changes.name = textField(fields.name);
		if (!changes.name) return { error: json({ error: 'Name is required' }, { status: 400 }) };
	}
	if (typeof fields.description === 'string') {
		changes.description = descriptionField(fields.description);
	}
	if (type !== 'character' && typeof fields.kind === 'string') {
		changes.kind = textField(fields.kind);
	}
	if ('aliases' in fields) changes.aliases = cleanAliases(fields.aliases, changes.name);
	if ('details' in fields) changes.details = cleanDetails(fields.details);
	if (typeof fields.notes === 'string') changes.notes = descriptionField(fields.notes);
	return { changes };
}

/** GET (the user's entries, each with its bookIds) and POST (a new one) for a type's list route. */
export function entryListHandlers(type: EntryType) {
	const table = tableOf(type);
	const link = linkOf(type);

	const GET = async (event: RequestEvent) => {
		const user = requireUser(event);
		const rows = await db
			.select()
			.from(table)
			.where(eq(table.userId, user.id))
			.orderBy(asc(table.createdAt));
		const links = await db
			.select({ entryId: link.entry, bookId: link.table.bookId })
			.from(link.table)
			.where(
				inArray(
					link.entry,
					rows.map((row) => row.id)
				)
			);
		return json(
			rows.map((row) => ({
				...row,
				bookIds: links.filter((item) => item.entryId === row.id).map((item) => item.bookId)
			}))
		);
	};

	const POST = async (event: RequestEvent) => {
		const user = requireUser(event);
		const body = await event.request.json().catch(() => null);
		const read = readEntry(type, body);
		if ('error' in read) return read.error;
		const { name } = read.changes;
		if (!name) return json({ error: 'Name is required' }, { status: 400 });

		const books = await ownedBookIds(user.id, body?.bookIds);
		if ('error' in books) return books.error;
		const { bookIds } = books;

		const created = await db.transaction(async (tx) => {
			const [row] = await tx
				.insert(table)
				.values({ ...read.changes, name, userId: user.id })
				.returning();
			await tx.insert(link.table).values(bookIds.map((bookId) => linkRow(type, row.id, bookId)));
			return row;
		});
		return json({ ...created, bookIds });
	};

	return { GET, POST };
}

/** PUT (any of its fields, and its books) and DELETE for a single entry. */
export function entryHandlers(type: EntryType) {
	const table = tableOf(type);
	const link = linkOf(type);
	const noun = `${type.charAt(0).toUpperCase()}${type.slice(1)}`;

	async function owned(event: RequestEvent) {
		const user = requireUser(event);
		const id = Number(event.params.id);
		if (!Number.isInteger(id)) {
			return { error: json({ error: `Invalid ${type} id` }, { status: 400 }) };
		}
		const entry = await findEntry(user.id, type, id);
		if (!entry) return { error: json({ error: `${noun} not found` }, { status: 404 }) };
		return { id, entry, userId: user.id };
	}

	const PUT = async (event: RequestEvent) => {
		const found = await owned(event);
		if ('error' in found) return found.error;
		const { id, entry, userId } = found;

		const body = await event.request.json().catch(() => null);
		const read = readEntry(type, body);
		if ('error' in read) return read.error;
		const { changes } = read;

		let bookIds: number[] | null = null;
		if (body && 'bookIds' in body) {
			const books = await ownedBookIds(userId, body.bookIds);
			if ('error' in books) return books.error;
			bookIds = books.bookIds;
		}

		const updated = await db.transaction(async (tx) => {
			const [row] = await tx
				.update(table)
				.set({ ...changes, updatedAt: new Date() })
				.where(eq(table.id, id))
				.returning();
			if (changes.name && changes.name !== entry.name) {
				await renameMentions(tx, type, id, entry.name, changes.name);
			}
			if (bookIds) {
				await tx.delete(link.table).where(eq(link.entry, id));
				await tx.insert(link.table).values(bookIds.map((bookId) => linkRow(type, id, bookId)));
			}
			return row;
		});

		const links = await db
			.select({ bookId: link.table.bookId })
			.from(link.table)
			.where(eq(link.entry, id));
		return json({ ...updated, bookIds: links.map((item) => item.bookId) });
	};

	// The words stay in the story, as plain text. Links to books and the cast go with the row.
	const DELETE = async (event: RequestEvent) => {
		const found = await owned(event);
		if ('error' in found) return found.error;
		const { id } = found;

		await db.transaction(async (tx) => {
			await forgetEntry(tx, type, id);
			await tx.delete(table).where(eq(table.id, id));
		});
		return json({ id });
	};

	return { PUT, DELETE };
}

// ---- Mentions in story text ------------------------------------------------------------------

/**
 * Story text as it may be stored: a mention of an entry the writer doesn't own keeps its words but
 * loses the link, so the index below only ever points at their own entries.
 */
export async function ownedMentions(tx: Tx, userId: string, content: string) {
	const mentions = mentionsIn(content);
	if (mentions.length === 0) return content;

	const owned: string[] = [];
	for (const type of ENTRY_TYPES) {
		const ids = mentions.filter((mention) => mention.entry === type).map((mention) => mention.id);
		if (ids.length === 0) continue;
		const table = tableOf(type);
		const rows = await tx
			.select({ id: table.id })
			.from(table)
			.where(and(inArray(table.id, ids), eq(table.userId, userId)));
		owned.push(...rows.map((row) => `${type}-${row.id}`));
	}
	return mapMentions(content, (mention) =>
		owned.includes(`${mention.entry}-${mention.id}`) ? mention : null
	);
}

export type LinkedEntry = { type: EntryType; id: number };

/**
 * Rebuild the mention index for a piece of story text that was just saved. An entry mentioned here
 * for the first time joins the cast (characters) and the book, if it wasn't already part of them.
 * Only the first time: someone the writer took out of a cast by hand stays out, even while their
 * old mentions remain in the text. Returns the entries that joined the book.
 */
export async function indexMentions(
	tx: Tx,
	saved: {
		storyTextId: number;
		content: string;
		target: 'part' | 'chapter';
		targetId: number;
		bookId: number;
	}
): Promise<LinkedEntry[]> {
	const { storyTextId, content, target, targetId, bookId } = saved;
	const uses: Record<string, { entryType: EntryType; entryId: number; uses: number }> = {};
	for (const mention of mentionsIn(content)) {
		const row = (uses[`${mention.entry}-${mention.id}`] ??= {
			entryType: mention.entry,
			entryId: mention.id,
			uses: 0
		});
		row.uses += 1;
	}
	const rows = Object.values(uses).map((row) => ({ ...row, storyTextId }));

	const before = await tx
		.select({ entryType: storyMention.entryType, entryId: storyMention.entryId })
		.from(storyMention)
		.where(eq(storyMention.storyTextId, storyTextId));
	if (before.length === 0 && rows.length === 0) return [];

	await tx.delete(storyMention).where(eq(storyMention.storyTextId, storyTextId));
	if (rows.length > 0) await tx.insert(storyMention).values(rows);

	const known = before.map((row) => `${row.entryType}-${row.entryId}`);
	const fresh = rows.filter((row) => !known.includes(`${row.entryType}-${row.entryId}`));

	const linked: LinkedEntry[] = [];
	for (const type of ENTRY_TYPES) {
		const ids = fresh.filter((row) => row.entryType === type).map((row) => row.entryId);
		if (ids.length === 0) continue;
		if (type === 'character') await joinCast(tx, target, targetId, ids);
		const link = linkOf(type);
		const added = await tx
			.insert(link.table)
			.values(ids.map((id) => linkRow(type, id, bookId)))
			.onConflictDoNothing()
			.returning({ id: link.entry });
		linked.push(...added.map((row) => ({ type, id: row.id })));
	}
	return linked;
}

async function joinCast(
	tx: Tx,
	target: 'part' | 'chapter',
	targetId: number,
	characterIds: number[]
) {
	if (target === 'chapter') {
		await tx
			.insert(chapterCharacter)
			.values(characterIds.map((characterId) => ({ chapterId: targetId, characterId })))
			.onConflictDoNothing();
	} else {
		await tx
			.insert(partCharacter)
			.values(characterIds.map((characterId) => ({ partId: targetId, characterId })))
			.onConflictDoNothing();
	}
}

/** The story text that mentions an entry. */
function textsMentioning(tx: Tx, type: EntryType, id: number) {
	return tx
		.select({ id: storyText.id, content: storyText.content, updatedAt: storyText.updatedAt })
		.from(storyMention)
		.innerJoin(storyText, eq(storyMention.storyTextId, storyText.id))
		.where(and(eq(storyMention.entryType, type), eq(storyMention.entryId, id)));
}

/** Store rewritten text without dating it: following a rename isn't an edit to the chapter. */
async function rewriteText(
	tx: Tx,
	text: { id: number; content: string; updatedAt: Date },
	content: string
) {
	if (content === text.content) return;
	await tx
		.update(storyText)
		.set({ content, updatedAt: text.updatedAt })
		.where(eq(storyText.id, text.id));
}

/** Mentions that show the old name take the new one. Short names are the writer's own. */
async function renameMentions(tx: Tx, type: EntryType, id: number, before: string, after: string) {
	for (const text of await textsMentioning(tx, type, id)) {
		const content = mapMentions(text.content, (mention) =>
			mention.entry === type && mention.id === id
				? { ...mention, label: renamedLabel(mention.label, before, after) }
				: mention
		);
		await rewriteText(tx, text, content);
	}
}

/**
 * Everything that points at an entry without a foreign key: its mentions become plain words, and
 * they and its connections leave the index. Whatever deletes an entry must call this.
 */
export async function forgetEntry(tx: Tx, type: EntryType, id: number) {
	for (const text of await textsMentioning(tx, type, id)) {
		const content = mapMentions(text.content, (mention) =>
			mention.entry === type && mention.id === id ? null : mention
		);
		await rewriteText(tx, text, content);
	}
	await tx
		.delete(storyMention)
		.where(and(eq(storyMention.entryType, type), eq(storyMention.entryId, id)));
	await tx
		.delete(entryLink)
		.where(
			or(
				and(eq(entryLink.fromType, type), eq(entryLink.fromId, id)),
				and(eq(entryLink.toType, type), eq(entryLink.toId, id))
			)
		);
}

// ---- Where an entry appears ------------------------------------------------------------------

/** Every chapter and story-text part an entry appears in, by mention or by cast. */
export async function appearancesOf(type: EntryType, id: number) {
	const found: Record<string, Appearance> = {};
	const at = (target: 'part' | 'chapter', targetId: number) =>
		(found[`${target}-${targetId}`] ??= { target, id: targetId, uses: 0, cast: false });

	const mentions = await db
		.select({
			chapterId: storyText.chapterId,
			partId: storyText.partId,
			uses: storyMention.uses
		})
		.from(storyMention)
		.innerJoin(storyText, eq(storyMention.storyTextId, storyText.id))
		.where(and(eq(storyMention.entryType, type), eq(storyMention.entryId, id)));
	for (const row of mentions) {
		if (row.chapterId) at('chapter', row.chapterId).uses += row.uses;
		else if (row.partId) at('part', row.partId).uses += row.uses;
	}

	if (type === 'character') {
		const chapters = await db
			.select({ id: chapterCharacter.chapterId })
			.from(chapterCharacter)
			.where(eq(chapterCharacter.characterId, id));
		for (const row of chapters) at('chapter', row.id).cast = true;
		const parts = await db
			.select({ id: partCharacter.partId })
			.from(partCharacter)
			.where(eq(partCharacter.characterId, id));
		for (const row of parts) at('part', row.id).cast = true;
	}
	return Object.values(found);
}

/** How many chapters and story-text parts of a book each entry appears in, keyed "character-12". */
export async function appearanceCounts(bookId: number) {
	const seen: Record<string, string[]> = {};
	const add = (entry: string, where: string) => {
		const list = (seen[entry] ??= []);
		if (!list.includes(where)) list.push(where);
	};

	const parts = await db.select({ id: part.id }).from(part).where(eq(part.bookId, bookId));
	const partIds = parts.map((row) => row.id);
	const chapters = partIds.length
		? await db.select({ id: chapter.id }).from(chapter).where(inArray(chapter.partId, partIds))
		: [];
	const chapterIds = chapters.map((row) => row.id);

	if (partIds.length > 0) {
		const mentions = await db
			.select({
				entryType: storyMention.entryType,
				entryId: storyMention.entryId,
				chapterId: storyText.chapterId,
				partId: storyText.partId
			})
			.from(storyMention)
			.innerJoin(storyText, eq(storyMention.storyTextId, storyText.id))
			.where(
				or(
					inArray(storyText.partId, partIds),
					chapterIds.length ? inArray(storyText.chapterId, chapterIds) : undefined
				)
			);
		for (const row of mentions) {
			add(
				`${row.entryType}-${row.entryId}`,
				row.chapterId ? `chapter-${row.chapterId}` : `part-${row.partId}`
			);
		}

		const partCast = await db
			.select()
			.from(partCharacter)
			.where(inArray(partCharacter.partId, partIds));
		for (const row of partCast) add(`character-${row.characterId}`, `part-${row.partId}`);
	}
	if (chapterIds.length > 0) {
		const chapterCast = await db
			.select()
			.from(chapterCharacter)
			.where(inArray(chapterCharacter.chapterId, chapterIds));
		for (const row of chapterCast) add(`character-${row.characterId}`, `chapter-${row.chapterId}`);
	}

	return Object.fromEntries(Object.entries(seen).map(([entry, list]) => [entry, list.length]));
}

// ---- Connections between entries -------------------------------------------------------------

/** Everything connected to an entry, in either direction. */
export function connectionsOf(userId: string, type: EntryType, id: number) {
	return db
		.select({
			id: entryLink.id,
			fromType: entryLink.fromType,
			fromId: entryLink.fromId,
			toType: entryLink.toType,
			toId: entryLink.toId,
			label: entryLink.label
		})
		.from(entryLink)
		.where(
			and(
				eq(entryLink.userId, userId),
				or(
					and(eq(entryLink.fromType, type), eq(entryLink.fromId, id)),
					and(eq(entryLink.toType, type), eq(entryLink.toId, id))
				)
			)
		)
		.orderBy(asc(entryLink.createdAt));
}

/** A { type, id } from a request, if it names one of the user's entries. */
export async function ownedEntryRef(userId: string, value: unknown) {
	const ref = value as { type?: unknown; id?: unknown } | null;
	const id = Number(ref?.id);
	if (!isEntryType(ref?.type) || !Number.isInteger(id)) return null;
	return (await findEntry(userId, ref.type, id)) ? { type: ref.type, id } : null;
}
