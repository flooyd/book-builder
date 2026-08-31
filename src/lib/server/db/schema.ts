import { pgTable, serial, integer, text, timestamp } from 'drizzle-orm/pg-core';
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
	userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }).notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});

export const part = pgTable('part', {
	id: serial('id').primaryKey(),
	title: text('title').notNull(),
	description: text('description').notNull().default(''),
	bookId: integer('book_id').references(() => book.id, { onDelete: 'cascade' }).notNull(),
	userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }).notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
	hasChapters: integer('has_chapters').notNull().default(1),
});

export const chapter = pgTable('chapter', {
	id: serial('id').primaryKey(),
	title: text('title').notNull(),
	description: text('description').notNull().default(''),
	partId: integer('part_id').references(() => part.id, { onDelete: 'cascade' }).notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});

export const character = pgTable('character', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	description: text('description').notNull().default(''),
	//characters can belong to multiple books or one
	bookIds: text('book_ids').notNull().default(''),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});

export const storyText = pgTable('story_text', {
	id: serial('id').primaryKey(),
	content: text('content').notNull(),
	//part id and chapter id are optional, but at least one of them must be present
	partId: integer('part_id').references(() => part.id, { onDelete: 'cascade' }),
	chapterId: integer('chapter_id').references(() => chapter.id, { onDelete: 'cascade' }),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});

export * from './auth.schema';
