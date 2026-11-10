---
name: bb-roadmap
description: Book Builder's numbered list of major feature ideas, with the status of each, what depends on what, the recommended order, and a notes file for each idea holding its plan and open questions before it's built or how it works afterwards. Use this whenever the user asks what to build next, asks for ideas or a roadmap, refers to an idea by number ("start on 6", "build 23"), or asks for something that's on the list by name (footnotes, pictures in the text, uploading artwork or a cover, file storage or Vercel Blob, the art studio, drawing or painting, designing a cover, ornaments, find and replace, import, EPUB, comments, co-authors and so on), and whenever a feature on the list ships or changes so the list stays true. It's the working list; the homepage's Coming soon shelf is the public one.
---

# Book Builder: the roadmap

The user picks from this list by number ("4, 8, and 10", "begin on 6"), so a number means the
idea with that number here. If they name a number, or ask for something the list already holds,
start from its row, and read its notes file in `ideas/` before anything else.

## Keeping this list true

- **Numbers never change.** Don't renumber when something ships or is dropped. Mark it, and give
  new ideas the next free number. The next free number is 27.
- **Update it in the same commit as the work.** When a feature ships, set its status and write
  down what was left out, so the leftovers aren't lost.
- **Adding ideas.** Add them when the user asks for ideas or agrees to one. Say which are new.
- **Notes files.** An idea that needs more than its row has a file, `ideas/NN-short-name.md` (see
  "Notes on each idea" below). Before it's built the file is a plan, and says so at the top: check
  it against the code, and where it says a choice is the user's, ask them. When the idea ships,
  rewrite the file as the record of what was built and how it works.
- **The public shelf is separate.** `src/lib/components/marketing/soon.ts` is what visitors see.
  Only add to it when the user asks, and take an entry off when it ships (see the `bb-homepage`
  skill). An idea here isn't a promise there. The shelf holds 2 at the moment, both added at the
  user's request: Find and replace (7) on 2026-11-04, and Art studio (25) on 2026-11-09.
  Connections map (19) came off when it shipped on 2026-11-06, Your account (4) when it shipped on
  2026-11-07, and Footnotes (23), added on 2026-11-09, when it shipped the same day.
- **Check before trusting it.** Copilot also commits to this repo, so read `git log` and glance at
  the code before calling something unbuilt.

Statuses: **Not started**, **In progress**, **Shipped**, **Dropped**.

## Where the user is heading

On 2026-11-09 the user set the direction for what comes next:

> I want the editor to be more sophisticated and allow images in page, footnotes, etc. I want the
> user to be able to upload or create custom art for their book.

That's the section "The page and its art" below: 18 (uploading), 22 (pictures in the text), 23
(footnotes), 24 (the "etc."), 25 (creating) and 26 (how a book looks). 18 was already on the list
as Images, and the others were added that day.

Asked the open questions, the user decided, also on 2026-11-09:

- **Files go in Vercel Blob.** The key will come later, in `.env` (see idea 18).
- **No generated art**, "at this time". The art studio is to be "like a painter/svg/vector creator
  and to have sophisticated tools so the user can make their own art" (see idea 25). So the
  cover designer and ornaments that were part of 25 that morning moved to 26.

## The list

### Protect the writer's work

| #   | Idea               | Status      | What it is                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ------------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Version history    | Shipped     | Every chapter's and story-text part's earlier text, kept as it's saved: compare a version with the text now, word by word, keep one for good with a name, and bring one back with an undo. Left out: history in focus mode, comparing two old versions with each other, versions of descriptions and notes, and a way back for a deleted chapter (its versions go with it). |
| 2   | Export             | Shipped     | PDF and Word of a book or one part, from the book page and the part page, for the owner. Left out: EPUB, the drawn cover in Word, and other scripts in the PDF (it covers Latin, Greek, Cyrillic and Vietnamese; the rest become `?` with a note, and Word keeps them). How it works is the `bb-export` skill.                                                              |
| 3   | Manuscript import  | Not started | Upload a Word document and split it into parts and chapters. "Import from text" only takes outlines, so an existing novel has to be pasted in chapter by chapter. Word's footnotes should become footnotes (23).                                                                                                                                                            |
| 4   | Accounts and email | Shipped     | Confirming a new account's email, password reset and account deletion, with email through Resend. Left out: changing the email address, a "your account was deleted" email, sign-in with Google and the like, and a way back for a deleted account. Needs a domain verified in Resend (`EMAIL_FROM`) before anyone but the Resend account's owner gets mail.                |
| 5   | Offline writing    | Not started | Keep drafts on the device and sync them when back online, which also helps on phones. There's no service worker and nothing is stored locally.                                                                                                                                                                                                                              |

### Build the world

| #   | Idea                           | Status      | What it is                                                                                                                                                                                                                                                                                                                |
| --- | ------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6   | Mentions and story bible       | In progress | Links from story text to the bible, typed with `@` or found by name, and a real page for every character, place and system. Left: portraits and maps (which wait on 18), mentions in descriptions and notes, and spotting names that aren't in the bible yet.                                                             |
| 7   | Find and replace across a book | Not started | Rename a character everywhere, with a preview of each match. Mentions follow a rename, but a name written out doesn't, and since names link themselves by spelling, an old name left in the text stops linking, counting and filling casts. This closes that gap. It must look inside footnotes' notes too (23).          |
| 8   | Series                         | Shipped     | Books grouped in a reading order, with a story bible worked out from their entries, an owner's page and a public page on the author profile, plus links between books in reading mode. Left out: an omnibus export, "Book 2 of…" on exported title pages, and series-wide goals, outlines and timelines.                  |
| 9   | Plot threads                   | Not started | A grid of subplots against chapters, showing where a thread goes quiet.                                                                                                                                                                                                                                                   |
| 10  | Scenes                         | Not started | Smaller units inside chapters, each with its own point of view, location and status. A big change to both the data and the editor.                                                                                                                                                                                        |
| 11  | Timeline                       | Not started | Put events on an in-world calendar and warn when a character is in two places at once.                                                                                                                                                                                                                                    |
| 19  | Connections map                | Shipped     | The bible's connections drawn as a web, for a book or a whole series, at `/book/[id]/bible/connections` and `/series/[id]/bible/connections`. Left out: saving the arrangement to the account (it's kept in the browser), editing a label in place, choosing a connection's kind by hand, and saving the map as an image. |

### The page and its art

What the user asked for on 2026-11-09. Footnotes (23) shipped that day, and its file is now the
record. The rest isn't built, and each has a plan in `ideas/`.

| #   | Idea                 | Status      | What it is                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | -------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 18  | Artwork              | Not started | Uploading: a place for a writer's pictures to live, an art shelf that shows what's there and how much room is left, and its first uses, which are a cover of the writer's own, portraits for characters and maps for places. It was called Images until 2026-11-09. Files go in Vercel Blob (the user's choice); the key isn't in `.env` yet, and the per-writer cap is still to decide.                                                                 |
| 22  | Pictures in the page | Not started | A picture set in story text, with a caption: as wide as the text, smaller, or with a page to itself. It has to reach the editor, both views of reading mode, share links, the PDF and the Word file. Needs 18.                                                                                                                                                                                                                                           |
| 23  | Footnotes            | Shipped     | A note tied to a place in the text: a number in the line, the note in a box by it in the editor, a tap away in reading mode and listed after the chapter, at the foot of the page in the PDF, and real footnotes in Word. Left out: endnotes, symbols for numbers, footnotes pasted from Word (they arrive as text), and numbering by chapter in Word (Word counts through the book).                                                                    |
| 24  | More kinds of text   | Not started | The smaller pieces of a fuller editor, each able to ship alone and asked for by letter: (a) an Insert menu, (b) small capitals, superscript and subscript, (c) kinds of quote (epigraph, verse, letter), (d) links, (e) page breaks, (f) tables.                                                                                                                                                                                                         |
| 25  | The art studio       | Not started | Creating: a painting and vector drawing program in the browser, with the tools a designer expects. (a) The artboard and vector tools: shapes, the pen and point editing, fill and stroke, layers, undo, saving to the art shelf. (b) Paint: pressure-sensitive brushes, eraser, fill, blend modes. (c) Finishing: text, gradients, path operations, snapping, mirror drawing. (d) Working from pictures, and SVG out. Saving needs 18. No generated art. |
| 26  | Book design          | Not started | How a book looks: (a) a cover designer (layout, colours, typeface, the title set over art from the shelf or the studio), and (b) ornaments for scene breaks and headings, chosen for the book. A cover without a picture is a design, not a file, so it needs no storage.                                                                                                                                                                                |

### Writing and revising

| #   | Idea            | Status      | What it is                                                                                                                                                                         |
| --- | --------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 20  | Notes to self   | Not started | Margin notes and "TK" placeholders inside story text, listed per book so none are forgotten. Kept out of reading mode, share links, exports and word counts, the way mentions are. |
| 21  | Story structure | Not started | Start an outline from a beat sheet (three acts, the hero's journey and so on), and see where each beat lands on the pacing chart from 15.                                          |

### Readers and collaborators

| #   | Idea                            | Status      | What it is                                                                                                                                                                                       |
| --- | ------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 12  | Reader comments and beta rounds | Not started | Margin notes from share links, plus how far each reader got. Authors get no feedback from share links today.                                                                                     |
| 13  | Serial publishing and follows   | Not started | Release chapters on a schedule, and readers get an email for each one. The biggest direction choice here: it moves Book Builder from writing tool towards reading platform. Ask before starting. |
| 14  | Co-authors and editors          | Not started | Invite people to a book as editors or commenters and see who changed what.                                                                                                                       |

### Insight

| #   | Idea                | Status      | What it is                                                                                                                                                                                                                                                                                                                                              |
| --- | ------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 15  | Manuscript insights | Shipped     | A page for each book at `/book/[id]/insights`: chapter pacing, the words a writer leans on, who drifts off the page, and a "Worth a look" list, all with no AI. Left out: hiding a word from the lists, -ly adverbs, close repeats (echoes), names missing from the bible, insights across a series, and highlighting uses in the editor.               |
| 16  | AI continuity check | Not started | Ask questions about a book and flag contradictions with the bible. Opt-in, and probably on the writer's own API key: the running cost matters on a free app, and many writers object to AI. Ask before starting.                                                                                                                                        |
| 17  | Word maps           | Shipped     | A word cloud of the whole book at `/book/[id]/word-map`, and one for each character from the lines they speak, all with no AI. Left out: a map for one chapter or part, comparing two characters side by side, hiding a word, adding a name to the bible from the page, linking a first-person narrator to their entry, and saving a cloud as an image. |

## Notes on each idea

Read an idea's file before starting on it or changing how it works.

| #   | File                                   | What's in it                                                                                           |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | `ideas/01-version-history.md`          | Record: when a version is kept, how old ones thin out, what it costs.                                  |
| 6   | `ideas/06-mentions-and-story-bible.md` | What's done and what's left.                                                                           |
| 17  | `ideas/17-word-maps.md`                | Record: how the app tells who's speaking, how that was measured, and its limits.                       |
| 18  | `ideas/18-artwork.md`                  | Plan: Vercel Blob and its limits, setting up the store, the cap, how uploads and deletes should work.  |
| 19  | `ideas/19-connections-map.md`          | Record: kinds of connection, the layout, the arrangement.                                              |
| 22  | `ideas/22-pictures-in-the-page.md`     | Plan: the node, and nine traps in today's code, among them that a picture-only chapter is thrown away. |
| 23  | `ideas/23-footnotes.md`                | Record: the node, what counts its words, where the note goes on each surface, what tripped it up.      |
| 24  | `ideas/24-more-kinds-of-text.md`       | Plan: the six pieces, a to f.                                                                          |
| 25  | `ideas/25-art-studio.md`               | Plan: the tools, a to d, drafts and saving, the drawing format, pen input, memory, libraries.          |
| 26  | `ideas/26-book-design.md`              | Plan: the cover designer and ornaments, and why a cover is a design rather than a file.                |

## Recommended order

For the direction the user set on 2026-11-09:

1. ~~**Footnotes (23).**~~ Shipped 2026-11-09. Adding it showed what a new kind of thing in story
   text costs: see "Things that tripped it up" in its file before starting 22.
2. **Artwork (18).** Storage is decided. Build it on the stand-in that keeps files in a scratch
   folder; it can ship once the key is in Vercel, and the per-writer cap has an answer.
3. **The art studio (25)**, piece a first, then b, c and d. It saves to 18's shelf, so it comes
   after, though its tools can be started alongside.
4. **Pictures in the page (22)**, with the Insert menu (24a), which gathers the footnote button
   and the new picture button in one place.
5. **Book design (26)** and the rest of 24, as the user asks for them.

The art studio (25) is on the public shelf now, so it's a promise. So is Find and replace (7),
which matters more now that names link themselves (see 7). It needs nothing else, so it can come
at any point. Email (4) is in, which opens up 12, 13 and 14.

So far the user has chosen 6 first (2026-11-01), then Export (2) the same day, Series (8),
Insights (15) and Word maps (17), names that link themselves (part of 6), Version history (1)
on 2026-11-04, Connections map (19) on 2026-11-06, Accounts and email (4) on 2026-11-07, and
Footnotes (23) on 2026-11-09.

## What depends on what

- **Email (4):** needed for 13 and 14, and for comment alerts in 12.
- **Artwork (18):** needed for 22, for saving anything made in the studio (25), for a picture on a
  designed cover (26a), and for portraits and maps, which are the rest of 6. Files go in Vercel
  Blob, and its Hobby limits (2,000 uploads a month across the site) shape 25's saving too.
- **The art studio (25):** what it makes are pictures on 18's shelf. Book design (26) sets a
  cover's title over the studio's art, and can use an ornament drawn in it.
- **Footnotes (23):** gave the PDF a way to raise a character off the line (`raise` on a `Run`),
  which superscript and subscript in 24b can reuse, and gave the PDF's page a foot that moves.
- **A new kind of thing in story text (22, 23, most of 24):** each has to be read by everything
  that reads a document. That's exports (2) today, and find and replace (7), import (3), notes to
  self (20) and scenes (10) when they're built. Whichever is built later has to learn about the
  other.
- **Connections map (19):** draws the `entry_link` rows that each entry's page already makes.
- **Mentions (6):** the character-tracking parts of 11 and 15 work best on top of it.
- **Insights (15):** 17 reuses its counting, and 21 draws its beats on the pacing chart. The
  per-character map also leans on the names and aliases in the story bible (6).

## Earlier ideas that shipped

From the first list (2026-10-31, with different numbers): writing goals, focus mode and author
pages, and ambient sound in focus mode, which followed on 2026-11-01. One small part was never
built: following an author (now part of 13).
