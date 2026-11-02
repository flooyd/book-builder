import { json, type RequestEvent } from '@sveltejs/kit';
import { and, asc, eq, inArray, ne, or } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth-guard';
import { db } from '$lib/server/db';
import {
	chapter,
	chapterCharacter,
	chapterPlace,
	chapterSystem,
	character,
	characterBook,
	entryLink,
	part,
	partCharacter,
	partPlace,
	partSystem,
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
	type Cast,
	type CastTarget,
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

// The cast of a chapter or story-text part: one table for each type of entry on each side.
const CASTS = {
	chapter: {
		character: {
			table: chapterCharacter,
			target: chapterCharacter.chapterId,
			entry: chapterCharacter.characterId,
			row: (chapterId: number, characterId: number) => ({ chapterId, characterId })
		},
		place: {
			table: chapterPlace,
			target: chapterPlace.chapterId,
			entry: chapterPlace.placeId,
			row: (chapterId: number, placeId: number) => ({ chapterId, placeId })
		},
		system: {
			table: chapterSystem,
			target: chapterSystem.chapterId,
			entry: chapterSystem.systemId,
			row: (chapterId: number, systemId: number) => ({ chapterId, systemId })
		}
	},
	part: {
		character: {
			table: partCharacter,
			target: partCharacter.partId,
			entry: partCharacter.characterId,
			row: (partId: number, characterId: number) => ({ partId, characterId })
		},
		place: {
			table: partPlace,
			target: partPlace.partId,
			entry: partPlace.placeId,
			row: (partId: number, placeId: number) => ({ partId, placeId })
		},
		system: {
			table: partSystem,
			target: partSystem.partId,
			entry: partSystem.systemId,
			row: (partId: number, systemId: number) => ({ partId, systemId })
		}
	}
};
/** A cast table. Like the book links above, they differ only in their columns' names. */
const castTable = (target: CastTarget, type: EntryType) =>
	CASTS[target][type] as unknown as typeof CASTS.chapter.place;

/** The ids among `ids` that are entries of this type belonging to the user. */
async function ownedIds(tx: Tx, userId: string, type: EntryType, ids: number[]) {
	const table = tableOf(type);
	const rows = await tx
		.select({ id: table.id })
		.from(table)
		.where(and(inArray(table.id, ids), eq(table.userId, userId)));
	return rows.map((row) => row.id);
}

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
		owned.push(...(await ownedIds(tx, userId, type, ids)).map((id) => `${type}-${id}`));
	}
	return mapMentions(content, (mention) =>
		owned.includes(`${mention.entry}-${mention.id}`) ? mention : null
	);
}

export type LinkedEntry = { type: EntryType; id: number };

/**
 * Rebuild the mention index for a piece of story text that was just saved. An entry mentioned here
 * for the first time joins the cast and the book, if it wasn't already part of them. Only the first
 * time: anything the writer took out of a cast by hand stays out, even while its old mentions
 * remain in the text. Returns the entries that joined the book.
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
		await joinCast(tx, target, targetId, type, ids);
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
	target: CastTarget,
	targetId: number,
	type: EntryType,
	ids: number[]
) {
	const cast = castTable(target, type);
	await tx
		.insert(cast.table)
		.values(ids.map((id) => cast.row(targetId, id)))
		.onConflictDoNothing();
}

/** Replace one type of entry in a cast. False, and nothing saved, unless all are the user's. */
export function setCast(
	userId: string,
	target: CastTarget,
	targetId: number,
	type: EntryType,
	ids: number[]
) {
	return db.transaction(async (tx) => {
		if (ids.length > 0 && (await ownedIds(tx, userId, type, ids)).length !== ids.length) {
			return false;
		}
		const cast = castTable(target, type);
		await tx.delete(cast.table).where(eq(cast.target, targetId));
		if (ids.length > 0) await joinCast(tx, target, targetId, type, ids);
		return true;
	});
}

/** A book's story bible, as much of it as tells where an entry appears. */
export async function entriesOfBook(bookId: number) {
	const entries = await Promise.all(
		ENTRY_TYPES.map(async (type) => {
			const table = tableOf(type);
			const link = linkOf(type);
			const rows = await db
				.select({ id: table.id, name: table.name, aliases: table.aliases })
				.from(table)
				.innerJoin(link.table, eq(link.entry, table.id))
				.where(eq(link.table.bookId, bookId));
			return rows.map((row) => ({ type, ...row }));
		})
	);
	return entries.flat();
}

/** The casts of these parts and chapters, keyed like the section anchors ("chapter-12"). */
export async function castsOf(partIds: number[], chapterIds: number[]) {
	const casts: Record<string, Cast> = {};

	async function read(target: CastTarget, targetIds: number[], type: EntryType) {
		if (targetIds.length === 0) return;
		const cast = castTable(target, type);
		const rows = await db
			.select({ targetId: cast.target, entryId: cast.entry })
			.from(cast.table)
			.where(inArray(cast.target, targetIds));
		for (const { targetId, entryId } of rows) {
			const found = (casts[`${target}-${targetId}`] ??= { character: [], place: [], system: [] });
			found[type].push(entryId);
		}
	}

	await Promise.all(
		ENTRY_TYPES.flatMap((type) => [read('part', partIds, type), read('chapter', chapterIds, type)])
	);
	return casts;
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

/**
 * A book is going, and the rest of its series stays: entries that belong to it alone join `heir`,
 * so the series' story bible doesn't shrink with it.
 */
export async function passEntriesOn(tx: Tx, bookId: number, heir: number) {
	for (const type of ENTRY_TYPES) {
		const link = linkOf(type);
		const rows = await tx
			.select({ id: link.entry })
			.from(link.table)
			.where(eq(link.table.bookId, bookId));
		const ids = rows.map((row) => row.id);
		if (ids.length === 0) continue;
		const shared = await tx
			.select({ id: link.entry })
			.from(link.table)
			.where(and(inArray(link.entry, ids), ne(link.table.bookId, bookId)));
		const alone = ids.filter((id) => !shared.some((row) => row.id === id));
		if (alone.length === 0) continue;
		await tx.insert(link.table).values(alone.map((id) => linkRow(type, id, heir)));
	}
}

// ---- Where an entry appears ------------------------------------------------------------------

/** Every chapter and story-text part an entry appears in, by mention or by cast. */
export async function appearancesOf(type: EntryType, id: number) {
	const found: Record<string, Appearance> = {};
	const at = (target: CastTarget, targetId: number) =>
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

	for (const target of ['chapter', 'part'] as const) {
		const cast = castTable(target, type);
		const rows = await db.select({ id: cast.target }).from(cast.table).where(eq(cast.entry, id));
		for (const row of rows) at(target, row.id).cast = true;
	}
	return Object.values(found);
}

/** How many chapters and story-text parts of these books each entry appears in, keyed "place-12". */
export async function appearanceCounts(bookIds: number[]) {
	const seen: Record<string, string[]> = {};
	const add = (entry: string, where: string) => {
		const list = (seen[entry] ??= []);
		if (!list.includes(where)) list.push(where);
	};

	const parts = bookIds.length
		? await db.select({ id: part.id }).from(part).where(inArray(part.bookId, bookIds))
		: [];
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
	}
	for (const [where, cast] of Object.entries(await castsOf(partIds, chapterIds))) {
		for (const type of ENTRY_TYPES) {
			for (const id of cast[type]) add(`${type}-${id}`, where);
		}
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
