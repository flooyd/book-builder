import { randomBytes } from 'node:crypto';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { art, artUpload } from '$lib/server/db/schema';
import {
	DESCRIPTION_LIMIT,
	isArtType,
	LONG_SIDE,
	MAX_FILE_BYTES,
	ROOM_BYTES,
	TITLE_LIMIT,
	UPLOAD_MINUTES,
	type ArtPicture,
	type ArtSource,
	type CoverArt
} from '$lib/art';
import {
	inspect,
	localType,
	newPaths,
	remove,
	storeMode,
	uploadTarget,
	type UploadTarget
} from './art-store';

/**
 * The art shelf on the server (idea 18). Uploading a picture takes two calls, and the picture
 * itself never passes through here:
 *
 * 1. `startUpload` checks the writer's room, holds the bytes they say they'll send, and hands out
 *    two places in storage (the picture and its small copy), each allowing one type and that size.
 * 2. The browser sends the files straight to storage, then `finishUpload` asks storage what
 *    really arrived before writing the row. Blob's own "upload completed" call isn't used: it's a
 *    call from Vercel to the site, which can't reach a computer running it locally.
 *
 * An upload that's never finished is cleared, files and all, the next time the writer starts one.
 * Deleting goes to storage by hand, files first, because cascades stop at the database.
 */

export class ArtError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
	}
}

/** An upload left this long was abandoned: its token ran out a while ago. */
const STALE_MS = (UPLOAD_MINUTES + 5) * 60_000;
/** Uploads one writer can have under way at once. */
const MAX_UNDER_WAY = 4;

type Row = typeof art.$inferSelect;

export const pictureOf = (row: Row): ArtPicture => ({
	id: row.id,
	url: row.url,
	smallUrl: row.smallUrl,
	width: row.width,
	height: row.height,
	bytes: row.bytes,
	source: row.source,
	draftKey: row.draftKey,
	title: row.title,
	description: row.description,
	createdAt: row.createdAt.toISOString(),
	updatedAt: row.updatedAt.toISOString()
});

export async function listArt(userId: string) {
	const rows = await db
		.select()
		.from(art)
		.where(eq(art.userId, userId))
		.orderBy(desc(art.createdAt), desc(art.id));
	return rows.map(pictureOf);
}

export async function findOwnedArt(userId: string, id: number) {
	if (!Number.isInteger(id)) return null;
	const [row] = await db
		.select()
		.from(art)
		.where(and(eq(art.id, id), eq(art.userId, userId)))
		.limit(1);
	return row ?? null;
}

/** Bytes kept on the shelf, plus those held for uploads under way. */
export async function roomUsed(userId: string, database: Pick<typeof db, 'select'> = db) {
	const [kept] = await database
		.select({ total: sql<number>`coalesce(sum(${art.bytes}), 0)::int` })
		.from(art)
		.where(eq(art.userId, userId));
	const [held] = await database
		.select({ total: sql<number>`coalesce(sum(${artUpload.bytes}), 0)::int` })
		.from(artUpload)
		.where(eq(artUpload.userId, userId));
	return Number(kept?.total ?? 0) + Number(held?.total ?? 0);
}

/** Clear a writer's abandoned uploads, and whatever of them reached storage. */
async function clearStale(userId: string) {
	const stale = await db
		.select()
		.from(artUpload)
		// Compared in Postgres, against the clock that stamped created_at: a timestamp without a time
		// zone read against JavaScript's clock is off by the database's time zone.
		.where(
			and(
				eq(artUpload.userId, userId),
				sql`${artUpload.createdAt} < now() - make_interval(secs => ${STALE_MS / 1000})`
			)
		);
	if (!stale.length) return;
	await remove(stale.flatMap((upload) => upload.paths));
	await db.delete(artUpload).where(
		inArray(
			artUpload.id,
			stale.map((upload) => upload.id)
		)
	);
}

export type StartedUpload = { id: string; files: UploadTarget[] };

/**
 * Begin an upload of a picture and its small copy, as `[picture, small]`, each with its type and
 * exact size. With `replaces`, the new files take the place of that picture's, so a studio
 * drawing saved again keeps its id and every cover it's on.
 */
export async function startUpload(
	userId: string,
	files: unknown,
	replaces: unknown
): Promise<StartedUpload> {
	if (storeMode() === 'off') {
		throw new ArtError('Uploading pictures isn’t available on this site yet.', 503);
	}
	if (
		!Array.isArray(files) ||
		files.length !== 2 ||
		!files.every(
			(file) =>
				isArtType(file?.type) &&
				Number.isInteger(file?.bytes) &&
				file.bytes > 0 &&
				file.bytes <= MAX_FILE_BYTES
		)
	) {
		throw new ArtError('A picture must be a JPEG or a PNG of at most 12 MB.', 400);
	}
	const [picture, small] = files as { type: 'image/jpeg' | 'image/png'; bytes: number }[];
	let replaced: Row | null = null;
	if (replaces !== undefined && replaces !== null) {
		replaced = await findOwnedArt(userId, Number(replaces));
		if (!replaced) throw new ArtError('That picture isn’t on your shelf any more.', 404);
	}

	await clearStale(userId);
	const bytes = picture.bytes + small.bytes;
	const paths = newPaths(picture.type, small.type);
	const id = randomBytes(16).toString('base64url');

	// One at a time for each writer, so two uploads started together can't both fit the room.
	await db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'art:' + userId}))`);
		const [{ count }] = await tx
			.select({ count: sql<number>`count(*)::int` })
			.from(artUpload)
			.where(eq(artUpload.userId, userId));
		if (Number(count) >= MAX_UNDER_WAY) {
			throw new ArtError('Wait for your other pictures to finish uploading.', 429);
		}
		const used = (await roomUsed(userId, tx)) - (replaced?.bytes ?? 0);
		if (used + bytes > ROOM_BYTES) {
			throw new ArtError(
				'There isn’t room on your shelf for this picture. Delete one you don’t use to make room.',
				413
			);
		}
		await tx.insert(artUpload).values({ id, userId, paths, bytes, replaces: replaced?.id ?? null });
	});

	return {
		id,
		files: await Promise.all([
			uploadTarget(paths[0], picture.type, picture.bytes),
			uploadTarget(paths[1], small.type, small.bytes)
		])
	};
}

export type PictureDetails = {
	width: unknown;
	height: unknown;
	title?: unknown;
	description?: unknown;
	source?: unknown;
	draftKey?: unknown;
};

const plain = (value: unknown, limit: number) =>
	typeof value === 'string'
		? value
				// Control characters, line breaks among them, become spaces: each is one line.
				.replace(/\p{Cc}+/gu, ' ')
				.trim()
				.slice(0, limit)
		: '';

/** Check what reached storage and put it on the shelf. */
export async function finishUpload(
	userId: string,
	uploadId: unknown,
	details: PictureDetails
): Promise<ArtPicture> {
	const [upload] =
		typeof uploadId === 'string'
			? await db
					.select()
					.from(artUpload)
					.where(and(eq(artUpload.id, uploadId), eq(artUpload.userId, userId)))
					.limit(1)
			: [];
	if (!upload) throw new ArtError('That upload has run out of time. Try again.', 404);

	const width = Number(details.width);
	const height = Number(details.height);
	const sides = [width, height];
	if (!sides.every((side) => Number.isInteger(side) && side > 0 && side <= LONG_SIDE)) {
		await abandon(upload);
		throw new ArtError('That picture is the wrong size.', 400);
	}

	const arrived = await Promise.all(upload.paths.map((filePath) => inspect(filePath)));
	const wrong =
		arrived.some((file, index) => !file || file.type !== localType(upload.paths[index])) ||
		arrived.reduce((sum, file) => sum + (file?.bytes ?? 0), 0) > upload.bytes;
	if (wrong) {
		await abandon(upload);
		throw new ArtError('The picture didn’t arrive. Try again.', 400);
	}
	const [picture, small] = arrived as NonNullable<(typeof arrived)[number]>[];

	const source: ArtSource = details.source === 'studio' ? 'studio' : 'upload';
	const draftKey =
		source === 'studio' &&
		typeof details.draftKey === 'string' &&
		/^[A-Za-z0-9_-]{1,64}$/.test(details.draftKey)
			? details.draftKey
			: null;
	const values = {
		url: picture.url,
		smallUrl: small.url,
		width,
		height,
		bytes: picture.bytes + small.bytes,
		source,
		draftKey,
		title: plain(details.title, TITLE_LIMIT)
	};
	const description =
		details.description === undefined ? undefined : plain(details.description, DESCRIPTION_LIMIT);

	let old: Row | null = null;
	const row = await db.transaction(async (tx) => {
		await tx.delete(artUpload).where(eq(artUpload.id, upload.id));
		if (upload.replaces !== null) {
			const [before] = await tx
				.select()
				.from(art)
				.where(and(eq(art.id, upload.replaces), eq(art.userId, userId)))
				.limit(1);
			if (before) {
				old = before;
				const [updated] = await tx
					.update(art)
					.set({ ...values, ...(description === undefined ? {} : { description }) })
					.where(eq(art.id, before.id))
					.returning();
				return updated;
			}
		}
		const [inserted] = await tx
			.insert(art)
			.values({ ...values, userId, description: description ?? '' })
			.returning();
		return inserted;
	});

	// The files it replaced; if this fails they're left behind, which costs room but nothing else.
	const replaced = old as Row | null;
	if (replaced) await remove([replaced.url, replaced.smallUrl]).catch(() => {});
	return pictureOf(row);
}

/** Give up on an upload: its files, if any arrived, and the bytes it held. */
async function abandon(upload: typeof artUpload.$inferSelect) {
	await remove(upload.paths).catch(() => {});
	await db.delete(artUpload).where(eq(artUpload.id, upload.id));
}

/** Change what a picture is called or the words that describe it. */
export async function describeArt(
	userId: string,
	id: number,
	changes: { title?: unknown; description?: unknown }
) {
	const found = await findOwnedArt(userId, id);
	if (!found) return null;
	const set: Partial<Pick<Row, 'title' | 'description'>> = {};
	if (changes.title !== undefined) set.title = plain(changes.title, TITLE_LIMIT);
	if (changes.description !== undefined) {
		set.description = plain(changes.description, DESCRIPTION_LIMIT);
	}
	if (!Object.keys(set).length) return pictureOf(found);
	const [row] = await db.update(art).set(set).where(eq(art.id, id)).returning();
	return pictureOf(row);
}

/**
 * Take a picture off the shelf: its files first, while the row still says where they are, then
 * the row. A cover it was on goes back to the drawn one (the column is set to null).
 */
export async function deleteArt(userId: string, id: number) {
	const found = await findOwnedArt(userId, id);
	if (!found) return false;
	await remove([found.url, found.smallUrl]);
	await db.delete(art).where(eq(art.id, id));
	return true;
}

/**
 * Before an account is deleted: every file it has in storage, kept or still uploading. The rows
 * then go with the user.
 */
export async function removeAllArt(userId: string) {
	const kept = await db
		.select({ url: art.url, smallUrl: art.smallUrl })
		.from(art)
		.where(eq(art.userId, userId));
	const uploading = await db
		.select({ paths: artUpload.paths })
		.from(artUpload)
		.where(eq(artUpload.userId, userId));
	await remove([
		...kept.flatMap((row) => [row.url, row.smallUrl]),
		...uploading.flatMap((row) => row.paths)
	]);
}

/** The covers of some books, by their pictures' ids, for pages anyone can open. */
export async function coversFor(ids: (number | null)[]) {
	const wanted = [...new Set(ids.filter((id): id is number => id !== null))];
	const covers: Record<number, CoverArt> = {};
	if (!wanted.length) return covers;
	const rows = await db
		.select({
			id: art.id,
			url: art.url,
			smallUrl: art.smallUrl,
			width: art.width,
			height: art.height,
			description: art.description
		})
		.from(art)
		.where(inArray(art.id, wanted));
	for (const { id, ...cover } of rows) covers[id] = cover;
	return covers;
}

export async function coverFor(id: number | null): Promise<CoverArt | null> {
	return id === null ? null : ((await coversFor([id]))[id] ?? null);
}
