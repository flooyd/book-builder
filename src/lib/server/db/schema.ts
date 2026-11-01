import {
	pgTable,
	serial,
	integer,
	text,
	boolean,
	date,
	jsonb,
	timestamp,
	primaryKey,
	index
} from 'drizzle-orm/pg-core';
import type { EntryDetail } from '$lib/bible';
import type { LabelStyle } from '$lib/headings';
import { user } from './auth.schema';

export const book = pgTable('book', {
	id: serial('id').primaryKey(),
	title: text('title').notNull(),
	description: text('description').notNull().default(''),
	userId: text('user_id')
		.references(() => user.id, { onDelete: 'cascade' })
		.notNull(),
	//random id in the book's public /read/<shareId> link; null while the book is private
	shareId: text('share_id').unique(),
	//writing goals: the book's word target and when it should be finished (null = none set)
	targetWords: integer('target_words'),
	deadline: date('deadline', { mode: 'string' }),
	//how reading mode labels parts and chapters (see $lib/headings)
	partLabels: text('part_labels').$type<LabelStyle>().notNull().default('words'),
	chapterLabels: text('chapter_labels').$type<LabelStyle>().notNull().default('numeral'),
	//off, every chapter goes by its label alone in reading mode
	chapterTitles: boolean('chapter_titles').notNull().default(true),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at')
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
});

export const part = pgTable('part', {
	id: serial('id').primaryKey(),
	title: text('title').notNull(),
	description: text('description').notNull().default(''),
	bookId: integer('book_id')
		.references(() => book.id, { onDelete: 'cascade' })
		.notNull(),
	userId: text('user_id')
		.references(() => user.id, { onDelete: 'cascade' })
		.notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at')
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
	hasChapters: integer('has_chapters').notNull().default(1),
	//show the description as a subtitle under the title in reading mode
	showDescription: boolean('show_description').notNull().default(false),
	//the label above the title in reading mode: null follows the book, '' hides it
	headingLabel: text('heading_label'),
	//show the title in reading mode
	showTitle: boolean('show_title').notNull().default(true),
	//order within the book (the outline sets it)
	position: integer('position').notNull().default(0),
	//writing status of a part that holds story text: idea, outlined, drafting, revising, done
	status: text('status').notNull().default('idea')
});

export const chapter = pgTable('chapter', {
	id: serial('id').primaryKey(),
	title: text('title').notNull(),
	description: text('description').notNull().default(''),
	partId: integer('part_id')
		.references(() => part.id, { onDelete: 'cascade' })
		.notNull(),
	//show the description as a subtitle under the title in reading mode
	showDescription: boolean('show_description').notNull().default(false),
	//the label above the title in reading mode: null follows the book, '' hides it
	headingLabel: text('heading_label'),
	//show the title in reading mode
	showTitle: boolean('show_title').notNull().default(true),
	//order within the part (the outline sets it)
	position: integer('position').notNull().default(0),
	//writing status: idea, outlined, drafting, revising, done
	status: text('status').notNull().default('idea'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at')
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
});

export const character = pgTable('character', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	description: text('description').notNull().default(''),
	//the story bible: short names to mention them by, labelled details and free notes
	aliases: jsonb('aliases').$type<string[]>().notNull().default([]),
	details: jsonb('details').$type<EntryDetail[]>().notNull().default([]),
	notes: text('notes').notNull().default(''),
	userId: text('user_id')
		.references(() => user.id, { onDelete: 'cascade' })
		.notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at')
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
});

//characters can belong to multiple books or one
export const characterBook = pgTable(
	'character_book',
	{
		characterId: integer('character_id')
			.references(() => character.id, { onDelete: 'cascade' })
			.notNull(),
		bookId: integer('book_id')
			.references(() => book.id, { onDelete: 'cascade' })
			.notNull()
	},
	(table) => [
		primaryKey({ columns: [table.characterId, table.bookId] }),
		index('character_book_book_id_idx').on(table.bookId)
	]
);

//rules of a world: magic, law, trade...
export const system = pgTable('system', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	description: text('description').notNull().default(''),
	//free-form label shown as the overline, e.g. "Magic" or "Law"
	kind: text('kind').notNull().default(''),
	//the story bible: short names to mention them by, labelled details and free notes
	aliases: jsonb('aliases').$type<string[]>().notNull().default([]),
	details: jsonb('details').$type<EntryDetail[]>().notNull().default([]),
	notes: text('notes').notNull().default(''),
	userId: text('user_id')
		.references(() => user.id, { onDelete: 'cascade' })
		.notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at')
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
});

//systems can apply to multiple books or one
export const systemBook = pgTable(
	'system_book',
	{
		systemId: integer('system_id')
			.references(() => system.id, { onDelete: 'cascade' })
			.notNull(),
		bookId: integer('book_id')
			.references(() => book.id, { onDelete: 'cascade' })
			.notNull()
	},
	(table) => [
		primaryKey({ columns: [table.systemId, table.bookId] }),
		index('system_book_book_id_idx').on(table.bookId)
	]
);

//the places of a world: a moon, a station, a ship...
export const place = pgTable('place', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	description: text('description').notNull().default(''),
	//free-form label shown as the overline, e.g. "Moon" or "Station"
	kind: text('kind').notNull().default(''),
	//the story bible: short names to mention them by, labelled details and free notes
	aliases: jsonb('aliases').$type<string[]>().notNull().default([]),
	details: jsonb('details').$type<EntryDetail[]>().notNull().default([]),
	notes: text('notes').notNull().default(''),
	userId: text('user_id')
		.references(() => user.id, { onDelete: 'cascade' })
		.notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at')
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
});

//places can appear in multiple books or one
export const placeBook = pgTable(
	'place_book',
	{
		placeId: integer('place_id')
			.references(() => place.id, { onDelete: 'cascade' })
			.notNull(),
		bookId: integer('book_id')
			.references(() => book.id, { onDelete: 'cascade' })
			.notNull()
	},
	(table) => [
		primaryKey({ columns: [table.placeId, table.bookId] }),
		index('place_book_book_id_idx').on(table.bookId)
	]
);

//characters who appear in a chapter (the outline's cast)
export const chapterCharacter = pgTable(
	'chapter_character',
	{
		chapterId: integer('chapter_id')
			.references(() => chapter.id, { onDelete: 'cascade' })
			.notNull(),
		characterId: integer('character_id')
			.references(() => character.id, { onDelete: 'cascade' })
			.notNull()
	},
	(table) => [
		// Character first: with (chapter_id, character_id), drizzle-kit push keeps proposing to
		// drop and re-add the key, even on a database it just created.
		primaryKey({ columns: [table.characterId, table.chapterId] }),
		index('chapter_character_chapter_id_idx').on(table.chapterId)
	]
);

//characters who appear in a part that holds its own story text
export const partCharacter = pgTable(
	'part_character',
	{
		partId: integer('part_id')
			.references(() => part.id, { onDelete: 'cascade' })
			.notNull(),
		characterId: integer('character_id')
			.references(() => character.id, { onDelete: 'cascade' })
			.notNull()
	},
	(table) => [
		primaryKey({ columns: [table.partId, table.characterId] }),
		index('part_character_character_id_idx').on(table.characterId)
	]
);

//places a chapter is set in: the same shape as its cast of characters
export const chapterPlace = pgTable(
	'chapter_place',
	{
		chapterId: integer('chapter_id')
			.references(() => chapter.id, { onDelete: 'cascade' })
			.notNull(),
		placeId: integer('place_id')
			.references(() => place.id, { onDelete: 'cascade' })
			.notNull()
	},
	(table) => [
		primaryKey({ columns: [table.placeId, table.chapterId] }),
		index('chapter_place_chapter_id_idx').on(table.chapterId)
	]
);

//places a part that holds its own story text is set in
export const partPlace = pgTable(
	'part_place',
	{
		partId: integer('part_id')
			.references(() => part.id, { onDelete: 'cascade' })
			.notNull(),
		placeId: integer('place_id')
			.references(() => place.id, { onDelete: 'cascade' })
			.notNull()
	},
	(table) => [
		primaryKey({ columns: [table.placeId, table.partId] }),
		index('part_place_part_id_idx').on(table.partId)
	]
);

//systems at work in a chapter
export const chapterSystem = pgTable(
	'chapter_system',
	{
		chapterId: integer('chapter_id')
			.references(() => chapter.id, { onDelete: 'cascade' })
			.notNull(),
		systemId: integer('system_id')
			.references(() => system.id, { onDelete: 'cascade' })
			.notNull()
	},
	(table) => [
		primaryKey({ columns: [table.systemId, table.chapterId] }),
		index('chapter_system_chapter_id_idx').on(table.chapterId)
	]
);

//systems at work in a part that holds its own story text
export const partSystem = pgTable(
	'part_system',
	{
		partId: integer('part_id')
			.references(() => part.id, { onDelete: 'cascade' })
			.notNull(),
		systemId: integer('system_id')
			.references(() => system.id, { onDelete: 'cascade' })
			.notNull()
	},
	(table) => [
		primaryKey({ columns: [table.systemId, table.partId] }),
		index('part_system_part_id_idx').on(table.partId)
	]
);

export const storyText = pgTable('story_text', {
	id: serial('id').primaryKey(),
	content: text('content').notNull(),
	//part id and chapter id are optional, but at least one of them must be present
	partId: integer('part_id').references(() => part.id, { onDelete: 'cascade' }),
	chapterId: integer('chapter_id').references(() => chapter.id, { onDelete: 'cascade' }),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at')
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
});

//who and what a piece of story text mentions, and how often: an index of the mention nodes in
//its content, rebuilt on every save (see $lib/server/bible). entry_type is character, place or
//system; entry_id points into that table, so nothing here cascades from the entry
export const storyMention = pgTable(
	'story_mention',
	{
		storyTextId: integer('story_text_id')
			.references(() => storyText.id, { onDelete: 'cascade' })
			.notNull(),
		entryType: text('entry_type').notNull(),
		entryId: integer('entry_id').notNull(),
		uses: integer('uses').notNull().default(1)
	},
	(table) => [
		primaryKey({ columns: [table.storyTextId, table.entryType, table.entryId] }),
		index('story_mention_entry_idx').on(table.entryType, table.entryId)
	]
);

//a connection between two story bible entries: Juno is "captain of" the Meridian
export const entryLink = pgTable(
	'entry_link',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id')
			.references(() => user.id, { onDelete: 'cascade' })
			.notNull(),
		fromType: text('from_type').notNull(),
		fromId: integer('from_id').notNull(),
		toType: text('to_type').notNull(),
		toId: integer('to_id').notNull(),
		label: text('label').notNull().default(''),
		createdAt: timestamp('created_at').notNull().defaultNow()
	},
	(table) => [
		index('entry_link_from_idx').on(table.fromType, table.fromId),
		index('entry_link_to_idx').on(table.toType, table.toId)
	]
);

//an author's page: settings, and whether it is public at /author/<handle>
export const profile = pgTable('profile', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	//the address of the public page: lowercase letters, digits and dashes
	handle: text('handle').unique(),
	//formatted like a description (see $lib/rich)
	bio: text('bio').notNull().default(''),
	website: text('website').notNull().default(''),
	isPublic: boolean('is_public').notNull().default(false),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at')
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
});

//a writer's daily word target (0 = none set)
export const writingGoal = pgTable('writing_goal', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	dailyWords: integer('daily_words').notNull().default(0),
	//weekdays kept for rest, as a bit mask (Monday = 1 ... Sunday = 64): they never break a streak
	restDays: integer('rest_days').notNull().default(0),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at')
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
});

//words written on one day, in the writer's own time zone: what saved story text added, less
//what it took away (so it can dip below zero; readers of it use max(0, words))
export const writingDay = pgTable(
	'writing_day',
	{
		userId: text('user_id')
			.references(() => user.id, { onDelete: 'cascade' })
			.notNull(),
		day: date('day', { mode: 'string' }).notNull(),
		words: integer('words').notNull().default(0)
	},
	(table) => [primaryKey({ columns: [table.userId, table.day] })]
);

export * from './auth.schema';
