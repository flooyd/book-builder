# Idea 23: footnotes

**A record. Shipped 2026-11-09.** What was built, where it lives, and the choices behind it. The
plan it was built from is in git history (commit `2fcd543`).

## What the user asked for

"I want the editor to be more sophisticated and allow images in page, footnotes, etc."
(2026-11-09), then "Begin work on footnotes :D" the same day.

## The node

An inline atom in **story text only**, carrying its own note:
`{"type":"footnote","attrs":{"note":"…"}}`.

- **The note is a description value.** It's plain text, or inline formatting as compact JSON, so
  everything that reads descriptions reads it, and it's edited in a `RichEditor` with
  `kind="description"`. Mentions in it become plain words, and there are no notes inside notes.
- **Numbers are never stored.** A number is its note's place among the notes of its text (one
  chapter, or one part with its own story text), counted wherever it's drawn. Move a paragraph and
  the numbers follow. In the editor a CSS counter draws them (`.bb-footnote::after`).
- **The cleaner** (`cleanInline` in `rich.ts`) keeps `note` and nothing else, cleans it as a
  description (`noteOf`), caps it at `MAX_NOTE` (100,000 characters) and drops a footnote whose
  note is blank. In a description, a footnote is dropped.
- **Text holding only a footnote is kept.** `isEmpty` counts footnotes, and reading mode and the
  export ask `textWithNotes(text).trim()`, not `plainText`.

## What counts

| Reads                                 | With                     | The notes' words |
| ------------------------------------- | ------------------------ | ---------------- |
| Word counts, goals, the outline       | `storyWords` (`reading`) | Counted          |
| Insights, word maps, names, casts     | `plainText`              | Left out         |
| Version history's comparison          | `textWithNotes`          | Shown, inline    |
| Is there anything here to read/export | `textWithNotes`          | Counted          |

`plainText` leaves notes out on purpose, so a note isn't read as narration (who's speaking, the
words a writer leans on). `storyWords` adds them back: the writer wrote them. Insights' chapter
word counts are narration only, so they can be a little under the writing surface's count.
`textWithNotes` puts superscript numbers where they sit and the notes after the story, a line each,
so an edit inside a note shows in version history.

## Where the note goes

| Where                   | How                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editor and focus mode   | `rich/footnote.ts` (the node, Ctrl+Alt+F, the toolbar's footnote button) and `rich/FootnoteBox.svelte`, a top-layer popover inside the editor that holds the note's own editor. Adding one opens the box with the caret in it; a click on a number opens it to write in; arrowing onto a number shows it without taking the caret. Esc goes back to the text after the number. A note left empty takes its number with it. Remove deletes both. |
| Reading mode, scrolling | `toHTML(value, 'story', key)` numbers the notes and lists them after the chapter (`aside.bb-notes`), with a link each way (`{key}-ref-N`, `{key}-note-N`). A tap on a number shows its note beside it (`reader/NotePopover.svelte`, which copies the note from that list). A click with Ctrl, Cmd, Shift or Alt is left to the browser.                                                                                                         |
| Reading mode, as a book | The same list after the chapter, and the same tap. No ids or links, since the text is drawn more than once (hidden copies to count pages). A tap on a number doesn't turn the page.                                                                                                                                                                                                                                                             |
| PDF                     | At the foot of the page the number is on, under a short rule. A line only fits on a page if its notes fit under it. A note of more than 3 lines may split, with at least 2 on the page (`NOTE_FIRST_LINES`), and run on to the foot of the next. Numbers are raised runs (`Run.raise`, `RISE`). A section's last notes may take pages of their own (`#lastNotes`).                                                                              |
| Word                    | Real footnotes (`FootnoteReferenceRun`) in Word's Footnote Text style, one paragraph per paragraph of the note. Word numbers and places them.                                                                                                                                                                                                                                                                                                   |

## Things that tripped it up

- **The box changes the document from inside a view update.** The plugin view calls the box, and
  the box may delete the footnote, which can't happen mid-update, so the bridge calls wait for a
  microtask (`queueMicrotask`).
- **Tiptap loads late.** `FootnoteBox` is part of the page, so it imports Tiptap's types only;
  `footnoteAt` and `footnoteNumber` live in it, not in `footnote.ts`.
- **The note's editor is an editor inside an editor.** Rules aimed at the story's
  `.rich-area` (StorySurface's 520px minimum height, focus mode's dimming) reached the note too.
  They're now child selectors (`.surface-editor > .area > .rich-area`). Write any new one that way.
- **A box opened by adding a footnote never has a node selection**, so leaving is also caught in
  `track` when the selection moves anywhere else.
- **Paste.** `cleanPastedHTML` keeps `data-` attributes, so a footnote copied inside the editor
  keeps its note. One copied out of the editor has no number in it (the counter isn't text).

## Left out

- Endnotes for the whole book, and symbols in place of numbers (\*, †).
- Footnotes pasted from Word arrive as text: the `[1]` and the notes as paragraphs at the end.
- Numbering differs in Word: the file is one section, so Word numbers notes straight through the
  book, where the app and the PDF start again in each chapter.
- Mentions inside notes (they become plain words), and notes in descriptions.
- Find and replace (7) has to look inside notes, and manuscript import (3) should turn Word's
  footnotes into these.
