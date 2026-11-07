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
  skill). An idea here isn't a promise there. The shelf holds 1 at the moment: Find and replace
  (7), added at the user's request on 2026-11-04. Connections map (19) came off when it shipped on
  2026-11-06, and Your account (4) when it shipped on 2026-11-07.
- **Check before trusting it.** Copilot also commits to this repo, so read `git log` and glance at
  the code before calling something unbuilt.

Statuses: **Not started**, **In progress**, **Shipped**, **Dropped**.

## The list

### Protect the writer's work

| #   | Idea               | Status      | What it is                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | ------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Version history    | Shipped     | Every chapter's and story-text part's earlier text, kept as it's saved: compare a version with the text now, word by word, keep one for good with a name, and bring one back with an undo. See "Idea 1" below. Left out: history in focus mode, comparing two old versions with each other, versions of descriptions and notes, and a way back for a deleted chapter (its versions go with it). |
| 2   | Export             | Shipped     | PDF and Word of a book or one part, from the book page and the part page, for the owner. Left out: EPUB, the drawn cover in Word, and other scripts in the PDF (it covers Latin, Greek, Cyrillic and Vietnamese; the rest become `?` with a note, and Word keeps them).                                                                                                                         |
| 3   | Manuscript import  | Not started | Upload a Word document and split it into parts and chapters. "Import from text" only takes outlines, so an existing novel has to be pasted in chapter by chapter.                                                                                                                                                                                                                               |
| 4   | Accounts and email | Shipped     | Confirming a new account's email, password reset and account deletion, with email through Resend. Left out: changing the email address, a "your account was deleted" email, sign-in with Google and the like, and a way back for a deleted account. Needs a domain verified in Resend (`EMAIL_FROM`) before anyone but the Resend account's owner gets mail.                                    |
| 5   | Offline writing    | Not started | Keep drafts on the device and sync them when back online, which also helps on phones. There's no service worker and nothing is stored locally.                                                                                                                                                                                                                                                  |

### Build the world

| #   | Idea                           | Status      | What it is                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6   | Mentions and story bible       | In progress | Links from story text to the bible, typed with `@` or found by name, and a real page for every character, place and system. See "Idea 6" below for what's done and what's left.                                                                                                                                                                |
| 7   | Find and replace across a book | Not started | Rename a character everywhere, with a preview of each match. Mentions follow a rename, but a name written out doesn't, and since names link themselves by spelling, an old name left in the text stops linking, counting and filling casts. This closes that gap.                                                                              |
| 8   | Series                         | Shipped     | Books grouped in a reading order, with a story bible worked out from their entries, an owner's page and a public page on the author profile, plus links between books in reading mode. Left out: an omnibus export, "Book 2 of…" on exported title pages, and series-wide goals, outlines and timelines.                                       |
| 9   | Plot threads                   | Not started | A grid of subplots against chapters, showing where a thread goes quiet.                                                                                                                                                                                                                                                                        |
| 10  | Scenes                         | Not started | Smaller units inside chapters, each with its own point of view, location and status. A big change to both the data and the editor.                                                                                                                                                                                                             |
| 11  | Timeline                       | Not started | Put events on an in-world calendar and warn when a character is in two places at once.                                                                                                                                                                                                                                                         |
| 18  | Images                         | Not started | Portraits for characters, maps for places, and uploaded covers. Needs file storage (Vercel Blob or similar): the app's first running cost that grows with every writer, so it needs a size cap. The last big piece of 6.                                                                                                                       |
| 19  | Connections map                | Shipped     | The bible's connections drawn as a web, for a book or a whole series, at `/book/[id]/bible/connections` and `/series/[id]/bible/connections`: see "Idea 19" below. Left out: saving the arrangement to the account (it's kept in the browser), editing a label in place, choosing a connection's kind by hand, and saving the map as an image. |

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

| #   | Idea                | Status      | What it is                                                                                                                                                                                                                                                                                                                                                                   |
| --- | ------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 15  | Manuscript insights | Shipped     | A page for each book at `/book/[id]/insights`: chapter pacing, the words a writer leans on, who drifts off the page, and a "Worth a look" list, all with no AI. Left out: hiding a word from the lists, -ly adverbs, close repeats (echoes), names missing from the bible, insights across a series, and highlighting uses in the editor.                                    |
| 16  | AI continuity check | Not started | Ask questions about a book and flag contradictions with the bible. Opt-in, and probably on the writer's own API key: the running cost matters on a free app, and many writers object to AI. Ask before starting.                                                                                                                                                             |
| 17  | Word maps           | Shipped     | A word cloud of the whole book at `/book/[id]/word-map`, and one for each character from the lines they speak, all with no AI: see "Idea 17" below. Left out: a map for one chapter or part, comparing two characters side by side, hiding a word, adding a name to the bible from the page, linking a first-person narrator to their entry, and saving a cloud as an image. |

## Recommended order

Find and replace (7): it's the last thing on the public shelf, and it matters more now that names
link themselves (see 7). Email (4) is in now, which opens up 12, 13 and 14.

So far the user has chosen 6 first (2026-11-01), then Export (2) the same day, Series (8),
Insights (15) and Word maps (17), names that link themselves (part of 6), Version history (1)
on 2026-11-04, Connections map (19) on 2026-11-06, and Accounts and email (4) on 2026-11-07.

## What depends on what

- **Email (4):** needed for 13 and 14, and for comment alerts in 12.
- **Images (18):** needed for character portraits, uploaded covers and maps, and so for the rest
  of 6.
- **Connections map (19):** draws the `entry_link` rows that each entry's page already makes.
- **Mentions (6):** the character-tracking parts of 11 and 15 work best on top of it.
- **Insights (15):** 17 reuses its counting, and 21 draws its beats on the pacing chart. The
  per-character map also leans on the names and aliases in the story bible (6).

## Idea 6: what's done and what's left

Done:

- Places, as a third kind of entry beside characters and systems.
- `@` mentions in story text, in the editor and in focus mode, with short names.
- A story bible page per book, and a page for every entry with details, notes, connections and
  "Appears in".
- Hover cards while writing. Mentions are plain words in reading mode and on share links.
- A cast for places and systems: chosen in the outline's details panel, joined by a first mention,
  and filtered by in the outline.
- Names that link themselves (2026-11-04). In the editor, a name, alias, first or last name from
  the book's bible links as it's typed. The links are editor decorations, never saved, so reading
  mode and share links can't see them. Written names count in "Appears in" and the bible's
  counts, and a name written in a chapter for the first time adds its entry to the cast.
  Chapters saved before then keep the casts they had. The user decided a one-off fill for them
  isn't needed, so don't offer one.

Left:

- **Images:** portraits and maps, now idea 18.
- **Mentions in descriptions and notes:** they only work in story text so far.
- **Spotting names not in the bible yet:** a capitalised name that keeps turning up could be
  offered as a new entry, in the editor or on the insights page (15 left this out too).

## Idea 19: how the map is drawn

The rules are in `lib/connections.ts` (type imports only, so it can be tested on its own), and
the page is `lib/components/bible/ConnectionsPage.svelte` with `ConnectionsMap`,
`ConnectionsPanel` and `ConnectionsList`.

- **What the server does.** One query per page load (`connectionsIn` in `lib/server/bible.ts`):
  every connection touching an entry in the book or series, found through the link tables and the
  `entry_link` indexes. Everything else happens in the browser, as the user prefers.
- **Kinds.** A line's colour comes from its label, by word lists in `relationKind`: family, then
  rivals, then allies, first match wins, so "Estranged sister of" is family and "Sworn enemy of" a
  rival. Anything else ("Captain of", "Owes") is other. The colours are the `--bb-tie-*` tokens.
- **Layout.** A force layout with no randomness, so a web always comes out the same. Lines pull
  towards a length that leaves room for their label, entries push apart (more sideways than up and
  down, for their names), and entries keep off lines that aren't theirs. Webs up to 60 entries are
  laid out from five starts and the one with the fewest crossings and hidden names wins. On random
  test webs: 25 entries in about 15 ms, 250 in about 200 ms.
- **Arrangement.** Entries the writer drags (or moves with the arrow keys) stay where they're put,
  in `localStorage` under `bb-connections-book-<id>` or `-series-<id>`. New entries find a place
  among them without moving anything. Tidy up lays the whole web out afresh, with an Undo.
- **Visiting entries.** A connection to an entry outside the book or series brings that entry in
  with a dashed outline, "From another book".
- **Phones.** A chosen entry opens in a sheet over the page. The panel under the map stays in the
  flow, so opening the sheet never changes the page's height or scrolls it.

## Idea 1: how versions are kept

The rules are in `lib/story-versions.ts` (no imports), the server side in
`lib/server/story-versions.ts`, and the window in `lib/components/story/VersionHistory.svelte`.

- **When.** A save keeps the text it replaces when the newest version is ten minutes old or more,
  and always before a cut of 100 words or more, so a slip costs ten minutes of work at worst. A
  restore always keeps the text it replaces, which is what its Undo puts back.
- **Thinning.** Every version from the last two days, then the last of each day for a month, then
  the last of each week, counted in UTC. One the writer keeps (a `label`, even an empty one) never
  goes.
- **What it costs.** One indexed read per save. A copy and the thinning happen only when a version
  is kept. Each version is a whole copy of the text, which Postgres compresses. The comparison runs
  in the browser (`lib/diff.ts`, Myers' algorithm, paragraphs then words), so the server only ever
  sends the text.
- **Goals.** A restore counts toward today's words only when the version was kept today: then it
  undoes today's edits. An older one would count old words as new.

## Idea 17: telling who's speaking

The user asked for two maps: the whole book with no AI, and the whole book split by character.
They expected the second to need AI, so that it wouldn't take a huge list of words to look for,
"unless you think it's not necessary". Decided on 2026-11-02: it isn't, for a first version, and
that version shipped the same day. The rules are in `lib/speakers.ts`.

- **No list of speech verbs.** The names are already in the story bible. In
  `"How are you doing?" Will inquired.`, a known name or alias next to the quotation marks says who
  it is, whatever the verb is.
- **In order of trust** (`How` in the code):
  1. `named`: a name beside the words, with the article or title it comes with (`said the Hatter`,
     `Captain Halley asked`), or `I said` for the narrator. A paragraph ending in a colon, comma or
     dash goes by who its last sentence is about.
  2. `nearby`: the subject of the sentence next to the line, or the one person the paragraph's
     narration mentions, if they're also its subject. Across a paragraph break it needs a he or she
     tag that fits. A pronoun that clashes overrules it, and nobody can address themselves.
  3. `turns`: unbroken talk between exactly two people, followed from lines it's sure of, names
     used in address and he or she. It only runs if the sure lines either side agree, and stops
     for a third person within four paragraphs or a tag it can't place.
- **Never guess.** Anything still uncertain goes under "Not sure who", where the writer can read
  it. A character's map with a stranger's words in it is worse than a smaller map.
- **He and she** aren't in the story bible, so `pronounsOf` reads them from the book: narration
  about one person, counting he, she, himself, herself and titles. His and her were too noisy.
- **Names beside lines that aren't in the bible** are collected and offered as ones to add. A tag
  with an unknown name also stops the guessing around it.
- **Names are not words.** The user's rule, from 2026-11-02: if a character is in the bible or
  linked with an @, they should be on the cloud without anyone adding them. So people are tallied
  by name, apart from ordinary words, and keep a place on the book's cloud however rarely they're
  named. A character who never appears in the text isn't drawn: there's nothing to size them by.
  A name that's an everyday word (Hope) also picks up that word where it opens a sentence, since a
  capital proves nothing there. Questions are the one case told apart: "Will she come?", "May I?"
- **Tried and dropped.** Giving an untagged line to the one person the paragraph before was about
  scored 0 of 10 in the blind test, because that line is usually the other person answering.
- **How it was measured.** Hiding the tags of known lines in four public-domain novels and seeing
  if the rules put them back: `named` 55 of 55, `turns` 65 of 68. That's on lines where the answer
  is known, so it's a good sign and not a promise. Share of spoken words placed: Alice in
  Wonderland 70%, The Secret Adversary 41%, The Adventures of Sherlock Holmes 33%, Pride and
  Prejudice 32%. The low ones are long stretches of untagged talk, and clients nobody has listed.
- **Known limits.** Quoted thoughts count as speech. Scene breaks don't reach `plainText`, so an
  exchange can run across one. Someone speaking two paragraphs in a row can flip the turns that
  follow. A first-person narrator is "The narrator", not their entry.
- **The tests** aren't in the repo, which has no test runner. They bundle these modules with
  esbuild and were run from a scratch folder: 47 on the rules and 45 on the maps and cloud.
- **AI, if ever.** Only for what's left, opt-in, on the writer's own key, for the same reasons as 16. Don't promise it, or its absence, on the public shelf.

## Earlier ideas that shipped

From the first list (2026-10-31, with different numbers): writing goals, focus mode and author
pages, and ambient sound in focus mode, which followed on 2026-11-01. One small part was never
built: following an author (now part of 13).
