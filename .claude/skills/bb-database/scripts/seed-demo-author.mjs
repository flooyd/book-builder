// One-off: build the "Demo Author" account from a throwaway database.
//   SOURCE_DATABASE_URL  the throwaway database holding "The Long Light"
//   DATABASE_URL         where the demo account is created (re-running replaces it)
//   ENV_FILE             optional: a file to append the generated login to (never printed)
import { appendFileSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { hashPassword } from 'better-auth/crypto';

const EMAIL = 'demo@book-builder.invalid';
const HANDLE = 'demo-author';
const SOURCE_BOOK = 'The Long Light';

const src = postgres(process.env.SOURCE_DATABASE_URL);
const dst = postgres(process.env.DATABASE_URL);
const id = () => randomBytes(24).toString('base64url').replace(/[-_]/g, 'x').slice(0, 32);

const doc = (...paragraphs) =>
	JSON.stringify({
		type: 'doc',
		content: paragraphs.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] }))
	});

const STATUS = {
	Prologue: 'done',
	'The Drowned Moon': 'done',
	'The Far Side': 'outlined',
	'Salvage Rights': 'done',
	'The Map of Dead Stars': 'revising',
	'Through the Gate': 'drafting',
	Glasswater: 'outlined'
};

const people = [
	[
		'Juno Halley',
		'Captain of the salvage ship Meridian. She wrote her crew’s rules in the years after Tamsin.'
	],
	['Ade', 'Juno’s scanner and signals man, with an ear for dying engines.'],
	['Pell', 'The Meridian’s engineer, who sings to the engines.'],
	['Tamsin', 'Lost before the story starts.']
];
const starsinging = [
	'Starsinging',
	'Pilots sing their ships from star to star.\n\nA song that is answered must be finished.',
	'Magic'
];

const [book] = await src`select * from book where title = ${SOURCE_BOOK} order by id desc limit 1`;
const parts = await src`select * from part where book_id = ${book.id} order by position, id`;
const chapters = await src`
	select c.* from chapter c join part p on p.id = c.part_id where p.book_id = ${book.id}
	order by c.position, c.id`;
const texts = await src`
	select * from story_text
	where part_id in ${src(parts.map((p) => p.id))} or chapter_id in ${src(chapters.map((c) => c.id))}`;

const password = randomBytes(18).toString('base64url');
const passwordHash = await hashPassword(password);

await dst.begin(async (sql) => {
	await sql`delete from "user" where email = ${EMAIL}`;
	const userId = id();
	await sql`insert into "user" (id, name, email, email_verified) values (${userId}, 'Demo Author', ${EMAIL}, true)`;
	await sql`insert into account (id, account_id, provider_id, user_id, password, updated_at)
		values (${id()}, ${userId}, 'credential', ${userId}, ${passwordHash}, now())`;
	await sql`insert into profile (user_id, handle, bio, website, is_public) values (
		${userId}, ${HANDLE},
		${doc('A made-up author with a finished sample novel, here to show what Book Builder can do. Read The Long Light, then start a book of your own.')},
		'', true)`;

	const shareId = randomBytes(12).toString('base64url');
	const [newBook] = await sql`
		insert into book (title, description, user_id, share_id, created_at, updated_at)
		values (${book.title}, ${book.description}, ${userId}, ${shareId}, ${book.created_at}, ${book.updated_at})
		returning id`;

	const partIds = new Map();
	for (const p of parts) {
		const [row] = await sql`
			insert into part (title, description, book_id, user_id, has_chapters, show_description, position, status, created_at, updated_at)
			values (${p.title}, ${p.description}, ${newBook.id}, ${userId}, ${p.has_chapters}, ${p.show_description},
				${p.position}, ${STATUS[p.title] ?? p.status}, ${p.created_at}, ${p.updated_at})
			returning id`;
		partIds.set(p.id, row.id);
	}

	const chapterIds = new Map();
	for (const c of chapters) {
		if (!(c.title in STATUS)) continue; // a leftover empty test chapter
		const [row] = await sql`
			insert into chapter (title, description, part_id, show_description, position, status, created_at, updated_at)
			values (${c.title}, ${c.description}, ${partIds.get(c.part_id)}, ${c.show_description}, ${c.position},
				${STATUS[c.title]}, ${c.created_at}, ${c.updated_at})
			returning id`;
		chapterIds.set(c.id, row.id);
	}

	for (const t of texts) {
		const partId = t.part_id ? partIds.get(t.part_id) : null;
		const chapterId = t.chapter_id ? chapterIds.get(t.chapter_id) : null;
		if (!partId && !chapterId) continue;
		await sql`insert into story_text (content, part_id, chapter_id, created_at, updated_at)
			values (${t.content}, ${partId}, ${chapterId}, ${t.created_at}, ${t.updated_at})`;
	}

	const cast = [];
	for (const [name, description] of people) {
		const [row] = await sql`
			insert into character (name, description, user_id) values (${name}, ${description}, ${userId}) returning id`;
		await sql`insert into character_book (character_id, book_id) values (${row.id}, ${newBook.id})`;
		cast.push(row.id);
	}
	const [system] = await sql`
		insert into system (name, description, kind, user_id)
		values (${starsinging[0]}, ${starsinging[1]}, ${starsinging[2]}, ${userId}) returning id`;
	await sql`insert into system_book (system_id, book_id) values (${system.id}, ${newBook.id})`;

	// Juno, Ade and Pell crew every chapter and the prologue; Tamsin is only remembered.
	const prologue = parts.find((p) => !p.has_chapters);
	for (const characterId of cast.slice(0, 3)) {
		for (const chapterId of chapterIds.values()) {
			await sql`insert into chapter_character (character_id, chapter_id) values (${characterId}, ${chapterId})`;
		}
		await sql`insert into part_character (part_id, character_id) values (${partIds.get(prologue.id)}, ${characterId})`;
	}

	console.log(`book ${newBook.id}  share /read/${shareId}  author /author/${HANDLE}`);
});

const envFile = process.env.ENV_FILE;
if (envFile) {
	const lead = readFileSync(envFile, 'utf8').endsWith('\n') ? '' : '\n';
	appendFileSync(
		envFile,
		`${lead}\n# The demo account on the production database (see the bb-database skill)\nDEMO_AUTHOR_EMAIL=${EMAIL}\nDEMO_AUTHOR_PASSWORD=${password}\n`
	);
	console.log('login saved to the env file');
}

await src.end();
await dst.end();
