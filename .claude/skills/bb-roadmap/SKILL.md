---
name: bb-roadmap
description: Book Builder's numbered list of major feature ideas, with the status of each, what depends on what, and the recommended order. Use this whenever the user asks what to build next, asks for ideas or a roadmap, refers to an idea by number ("start on 6", "build 2"), or when a feature on this list ships or changes so the list stays true. It's the working list; the homepage's Coming soon shelf is the public one.
---

# Book Builder: the roadmap

The user picks from this list by number ("4, 8, and 10", "begin on 6"), so a number means the
idea with that number here. If they name a number, start from its entry.

## Keeping this list true

- **Numbers never change.** Don't renumber when something ships or is dropped. Mark it, and give
  new ideas the next free number.
- **Update it in the same commit as the work.** When a feature ships, set its status and write
  down what was left out, so the leftovers aren't lost.
- **Adding ideas.** Add them when the user asks for ideas or agrees to one. Say which are new.
- **The public shelf is separate.** `src/lib/components/marketing/soon.ts` is what visitors see.
  Only add to it when the user asks, and take an entry off when it ships (see the `bb-homepage`
  skill). An idea here isn't a promise there. The shelf holds 4, 8 and 15 at the moment.
- **Check before trusting it.** Copilot also commits to this repo, so read `git log` and glance at
  the code before calling something unbuilt.

Statuses: **Not started**, **In progress**, **Shipped**, **Dropped**.

## The list

### Protect the writer's work

| #   | Idea               | Status      | What it is                                                                                                                                                                                                                                                              |
| --- | ------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Version history    | Not started | Snapshots of each chapter, with compare and restore. Today a save replaces the only copy (`PUT` in `src/lib/server/story-text.ts`), so a mistaken delete can't be undone once it's saved.                                                                               |
| 2   | Export             | Shipped     | PDF and Word of a book or one part, from the book page and the part page, for the owner. Left out: EPUB, the drawn cover in Word, and other scripts in the PDF (it covers Latin, Greek, Cyrillic and Vietnamese; the rest become `?` with a note, and Word keeps them). |
| 3   | Manuscript import  | Not started | Upload a Word document and split it into parts and chapters. "Import from text" only takes outlines, so an existing novel has to be pasted in chapter by chapter.                                                                                                       |
| 4   | Accounts and email | Not started | Password reset and account deletion. A forgotten password locks someone out for good, and the app can't send email at all.                                                                                                                                              |
| 5   | Offline writing    | Not started | Keep drafts on the device and sync them when back online, which also helps on phones. There's no service worker and nothing is stored locally.                                                                                                                          |

### Build the world

| #   | Idea                           | Status      | What it is                                                                                                                                                           |
| --- | ------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6   | Mentions and story bible       | In progress | `@` links in story text, and a real page for every character, place and system. See "Idea 6" below for what's done and what's left.                                  |
| 7   | Find and replace across a book | Not started | Rename a character everywhere, with a preview of each match. Mentions already follow a rename; this covers the plain text around them.                               |
| 8   | Series                         | Not started | Reading order, a shared bible and a series page on the author profile. Characters, places and systems already span books, but nothing connects the books themselves. |
| 9   | Plot threads                   | Not started | A grid of subplots against chapters, showing where a thread goes quiet.                                                                                              |
| 10  | Scenes                         | Not started | Smaller units inside chapters, each with its own point of view, location and status. A big change to both the data and the editor.                                   |
| 11  | Timeline                       | Not started | Put events on an in-world calendar and warn when a character is in two places at once.                                                                               |

### Readers and collaborators

| #   | Idea                            | Status      | What it is                                                                                                                                                                                       |
| --- | ------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 12  | Reader comments and beta rounds | Not started | Margin notes from share links, plus how far each reader got. Authors get no feedback from share links today.                                                                                     |
| 13  | Serial publishing and follows   | Not started | Release chapters on a schedule, and readers get an email for each one. The biggest direction choice here: it moves Book Builder from writing tool towards reading platform. Ask before starting. |
| 14  | Co-authors and editors          | Not started | Invite people to a book as editors or commenters and see who changed what.                                                                                                                       |

### Insight

| #   | Idea                | Status      | What it is                                                                                                                                                                                                       |
| --- | ------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 15  | Manuscript insights | Not started | Overused words, chapter pacing, and characters who vanish for long stretches, with no AI needed. The mention index (`story_mention`) already says who appears where.                                             |
| 16  | AI continuity check | Not started | Ask questions about a book and flag contradictions with the bible. Opt-in, and probably on the writer's own API key: the running cost matters on a free app, and many writers object to AI. Ask before starting. |

## Recommended order

Version history (1), then the rest of 6. Version history comes first because it's the only idea
here that stops writers permanently losing work. The user chose to start 6 first, on 2026-11-01,
and had Export (2) built next, the same day.

## What depends on what

- **Email (4):** needed for 13 and 14, and for comment alerts in 12.
- **Image storage (nothing built yet):** needed for character portraits, uploaded covers and maps.
- **Mentions (6):** the character-tracking parts of 11 and 15 work best on top of it.

## Idea 6: what's done and what's left

Done:

- Places, as a third kind of entry beside characters and systems.
- `@` mentions in story text, in the editor and in focus mode, with short names.
- A story bible page per book, and a page for every entry with details, notes, connections and
  "Appears in".
- Hover cards while writing. Mentions are plain words in reading mode and on share links.
- A cast for places and systems: chosen in the outline's details panel, joined by a first mention,
  and filtered by in the outline.

Left:

- **Images:** portraits and maps, which wait on image storage.
- **Mentions in descriptions and notes:** they only work in story text so far.
- **Finding names without an `@`:** suggesting links for names already in the text, so a book
  written before mentions existed can catch up.

## Earlier ideas that shipped

From the first list (2026-10-31, with different numbers): writing goals, focus mode and author
pages, and ambient sound in focus mode, which followed on 2026-11-01. One small part was never
built: following an author (now part of 13).
