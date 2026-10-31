---
name: bb-feature-map
description: A map of every Book Builder feature and the files that own it (library and dashboard, book, part and chapter pages, the writing surface and focus mode, the outline and corkboard, characters, systems and cast, reading mode in scroll and book views, share links, author profiles and settings, theme, header, homepage). Use this at the start of any task that changes or asks about an existing feature, or that adds one next to them, so you go straight to the right files and reuse what's there instead of searching the whole repo or rebuilding something that exists.
---

# Book Builder: where everything lives

File paths are relative to `src/`. If a file named here has moved, search for its main export
before assuming the feature is gone.

## The domain in one paragraph

A **book** holds **parts** in order. A part either holds **chapters** (`has_chapters = 1`,
labelled "Part One", "Part Two", ...) or holds its own **story text** (a prologue, an
interlude). Chapters are numbered across the whole book. Each chapter or story-text part has
a **status**: idea, outlined, drafting, revising or done. **Characters** and **systems** (magic,
politics, trade) belong to the user and can be linked to many books. A chapter's or part's
**cast** is the characters in it. Descriptions can show as subtitles in reading mode
(`show_description`).

## Features → files

| Feature                   | Routes                                | Main files                                                                                                                                                                                                                                                                                                                                  |
| ------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signed-out home page      | `/`                                   | `lib/components/marketing/Home.svelte`, `AnimatedBook.svelte` + `hero-book.ts`, `soon.ts`, `SiteHeader`, `SiteFooter` (see the `bb-homepage` skill)                                                                                                                                                                                         |
| Dashboard / library       | `/` (signed in)                       | `lib/components/library/Dashboard.svelte`, stores in `lib/stores`, loading and helpers in `lib/library.ts`                                                                                                                                                                                                                                  |
| Sign in / up / out        | `/login`, `/logout`                   | `routes/login/+page.server.ts` (form actions `signInEmail`, `signUpEmail`), `lib/server/auth.ts`, `hooks.server.ts`                                                                                                                                                                                                                         |
| Create anything           | dock and modal                        | `lib/components/ui/CommandDock.svelte`, `CreateModal.svelte`                                                                                                                                                                                                                                                                                |
| Book page                 | `/book/[id]`                          | `lib/components/book/BookPage.svelte`, `BookAside.svelte`, `TocChapterRow.svelte`                                                                                                                                                                                                                                                           |
| Part page                 | `/part/[id]`                          | `lib/components/part/PartPage.svelte`                                                                                                                                                                                                                                                                                                       |
| Chapter page              | `/chapter/[id]`                       | `lib/components/chapter/ChapterPage.svelte`                                                                                                                                                                                                                                                                                                 |
| Writing surface           | inside part and chapter pages         | `lib/components/story/StorySurface.svelte` (Night/Paper surface, word count, Focus button), `TitleBlock`, `Rail`, `SaveStatus`, `PageFrame`, `Missing`                                                                                                                                                                                      |
| Saving story text         | `/api/story-text/{part,chapter}/[id]` | client `lib/story-text.svelte.ts`; server `lib/server/story-text.ts` (cleans, saves, touches `updatedAt`, returns `touchedAt`); `touchLibrary` in `lib/library.ts`                                                                                                                                                                          |
| Rich text editor          | everywhere text is edited             | `lib/components/rich/*`, `lib/rich.ts`, `lib/styles/prose.css` (see the `bb-rich-text` skill)                                                                                                                                                                                                                                               |
| Focus mode                | Focus button on the surface           | `lib/components/story/FocusMode.svelte` (modal `<dialog>` and fullscreen, typewriter scrolling only on edits, dimming, sprint timer, autosave after 2.5s; the bar stays visible)                                                                                                                                                            |
| Outline / corkboard       | `/book/[id]/outline`                  | `lib/components/outline/*` (`OutlinePage`, `OutlineList`, `Corkboard`, `Inspector`, `ImportDialog`, `CastStack`, `StatusPill`, `drag.ts`), state in `lib/outline.svelte.ts` (`OutlineDoc`), text import/export in `lib/outline-text.ts`, server `lib/server/outline.ts`, order `PUT /api/book/[id]/order`, outline `/api/book/[id]/outline` |
| Status                    | outline, pages                        | `lib/status.ts`                                                                                                                                                                                                                                                                                                                             |
| Characters, systems, cast | dashboard, pages                      | `/api/characters`, `/api/systems`, `/api/cast/[target]/[id]`; tables `character_book`, `system_book`, `chapter_character`, `part_character`                                                                                                                                                                                                 |
| Reading mode, scroll view | `/book/[id]/read` (owner)             | `lib/components/reader/Reader.svelte` (bar, contents, text settings, progress, resume), `lib/reading.ts` (prefs cookie `bb-reader`, `ReaderData`, `ReadingPosition`), server `lib/server/reading.ts` (`readableBook`)                                                                                                                       |
| Reading mode, book view   | the reader's Book button              | `lib/components/reader/BookView.svelte` (3D page turns, cover opening, controls), `book-layout.ts` (geometry, page run, positions). Text is paginated with CSS columns in hidden copies.                                                                                                                                                    |
| Public share links        | `/read/[shareId]` (noindex)           | `/api/book/[id]/share`, `book.share_id`, same `Reader` with `owner: false`                                                                                                                                                                                                                                                                  |
| Author profiles           | `/settings`, `/author/[handle]`       | `lib/components/profile/SettingsPage.svelte`, `AuthorPage.svelte`, `lib/profile.ts` (handle and website rules), `lib/server/profile.ts`, `/api/profile`, `/api/profile/password`                                                                                                                                                            |
| Theme                     | toggle in headers                     | `lib/theme.svelte.ts` (`ThemeState`, cookie `bb-theme`), `ThemeToggle.svelte`, `hooks.server.ts`                                                                                                                                                                                                                                            |
| Signed-in header          | all app pages                         | `lib/components/ui/AppHeader.svelte`, crumbs via `useAppHeader` in `lib/app-header.svelte.ts`                                                                                                                                                                                                                                               |
| Motion                    | site-wide                             | `lib/motion.ts` (registers motion-components after hydration)                                                                                                                                                                                                                                                                               |

`routes/demo/*` is leftover scaffolding from the SvelteKit template.

## How data reaches pages

- **App pages.** Book, part and chapter pages mostly read the client stores (`lib/stores`), filled by `loadLibrary()` from the `/api/*` list endpoints, and write through `sendJSON` / `putJSON`. After a write they update the stores in place rather than reloading.
- **Server-loaded pages.** Reading mode, profiles and the author page load on the server in `+page.server.ts` and pass plain data to one component.
- **Ordering** always goes through `bookOutline()` in `lib/library.ts`, which sorts by position, then created date, then id.

## Reading position, shared by both reader views

- **Format.** `{ key: 'chapter-12' | 'part-3', fraction }` is kept in `localStorage` under `bb-reading-<bookId>`.
- **Who writes it.** The scroll view measures it against a reading line, and the book view uses the page's column within its chapter. Switching views passes the position across.
- **Preferences.** Text size, typeface and view live in the `bb-reader` cookie (`3-sans-book`), so the server renders the right one.

## Coming soon

The homepage's "Coming soon" shelf (`lib/components/marketing/soon.ts`) lists what the user
plans next. When you build one of those features, take it off the shelf and consider showing
it on the homepage (see the `bb-homepage` skill).
