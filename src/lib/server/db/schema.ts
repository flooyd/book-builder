import {
	pgTable,
	serial,
	integer,
	text,
	boolean,
	timestamp,
	primaryKey,
	index
} from 'drizzle-orm/pg-core';
import { user } from './auth.schema';

export const task = pgTable('task', {
	id: serial('id').primaryKey(),
	title: text('title').notNull(),
	priority: integer('priority').notNull().default(1)
});

export const book = pgTable('book', {
	id: serial('id').primaryKey(),
	title: text('title').notNull(),
	description: text('description').notNull().default(''),
	userId: text('user_id')
		.references(() => user.id, { onDelete: 'cascade' })
		.notNull(),
	//random id in the book's public /read/<shareId> link; null while the book is private
	shareId: text('share_id').unique(),
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
	showDescription: boolean('show_description').notNull().default(false)
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

export * from './auth.schema';
