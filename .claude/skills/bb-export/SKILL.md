---
name: bb-export
description: How Book Builder turns a book or a part into a PDF or a Word file, covering the manuscript both files are built from, the PDF typesetter in pdf.ts (page size, line breaking, hyphenation, first letters, lines kept together, running heads, contents, the cover), the typefaces it carries and what happens to characters they can't draw, the Word writer's styles and page-number estimate, the export's own Vercel function and its limits, and how to check a file. Use this whenever a task touches export, download, PDF, Word, docx, print or EPUB, the files in src/lib/server/export, or adds anything to story text (a block, a mark, a colour, a typeface, a picture, a footnote) that an exported file must show too.
---

# Book Builder: PDF and Word export

Everything is in `src/lib/server/export/`, and it only runs on the server.

| File            | What it does                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| `index.ts`      | `requestedFormat` and `exportResponse`: picks the writer, names the file, sends it.                       |
| `manuscript.ts` | What goes into a file, whichever kind: sections in reading order, and formatted text as runs.             |
| `pdf.ts`        | A 6 × 9 inch book, set by our own typesetter and drawn with PDFKit.                                       |
| `fonts.ts`      | The typefaces the PDF is set in, and which one draws each character.                                      |
| `word.ts`       | A US Letter working copy built on Word's own styles, with `docx`.                                         |
| `fonts/`        | The `.woff` files and their licences (all SIL Open Font License). Keep a licence beside any face you add. |

`lib/export.ts` has the two formats and the file's name, and is shared with the browser.

## From a click to a file

1. `book/ExportButtons.svelte` (on the book aside and the part page) saves unsaved text first,
   then fetches `GET /api/book/[id]/export` or `/api/part/[partId]/export` with `?format=pdf` or
   `docx`. It fetches, not links, so the button can say "Making it…" and an error is a sentence.
2. The route checks the owner and loads the book with `readableBook`. Only the owner can export.
3. `bookManuscript` or `partManuscript` turns that into a `Manuscript`.
4. `pdfOf` or `wordOf` returns `{ bytes, missing }`, and `exportResponse` sends the bytes.

**A file holds what reading mode shows and nothing else.** That's why it starts from
`readableBook`: hidden titles and descriptions arrive blank, and mentions are already plain
words. Never load the book another way for an export.

## The manuscript

- **`Section`.** A part's own page (`kind: 'part'`, which holds no story text) or anything that
  holds text (`kind: 'text'`: a chapter, or a part with its own story text). It carries the
  heading as reading mode shows it (`over`, `title`, `short`), the description and the stored
  text. A part with nothing to show gets no page, as in reading mode.
- **One part.** `partManuscript` sets `manuscript.part`, and the title page then does the job of
  the part's own page. Chapters keep the numbers they have in the book.
- **`Run`.** A stretch of text in one style: bold, italic, underline, strike, `family` (`read`,
  `display`, `ui` or `mono`), `scale` (its size against the text around it), `color` and
  `highlight`, and `raise` (lifted off the line) with `note`, for a footnote's number.
  `runsOf` makes them from a block's inline nodes, and a line break is the string `'break'`.
- **Colours are for paper.** `INKS` and `MARKS` in `manuscript.ts` hold the light values of
  `--ink-*` and `--mark-*`, since a page is always paper. A colour picked with "Any colour" is
  already `#rrggbb` and passes straight through.
- **`storyOf(text)`** returns the story's blocks, the first letter, already taken out of the
  first paragraph, and the footnotes' notes, note 1 first. It numbers each footnote node in
  reading order as it goes (`attrs.number`), and `runsOf` turns one into its raised number.
  **`noteParagraphs`** and **`noteInlines`** give a note's runs, by paragraph or joined by line
  breaks. **`descriptionLines`** returns a description's lines, italic with emphasis turned
  upright.

## The PDF

`pdf.ts` is one class, `Book`, which keeps a `y` that runs down the page. PDFKit only draws. The
setting is ours, because a book needs what PDFKit's own text layout doesn't do.

- **The page.** 432 × 648 pt. The text block is 312 pt wide (`MEASURE`) and sits towards the
  spine: `left` is `INNER` (68) on a right-hand page and `OUTER` (52) on a left-hand one. Text
  runs from `TOP` (68) to `FOOT` (576). Body type is 11 on 15.5.
- **How a paragraph is set.** `runsOf` → `#stretches` (words, split at the writer's line breaks)
  → `#lines` (breaks them into lines) → `#place` (puts lines on pages) → `#draw` (one line).
  - `#lines` takes a `box` function that gives each line its own indent and width. That's how a
    first letter sits beside the first few lines.
  - **Justifying.** A space may close to 0.82 of its width (`SHRINK`) and open by up to 1.3 of a
    space more (`STRETCH`). Past that the line is left short of the margin.
  - **Hyphenation** uses British patterns (`hyphen/en-gb`), only in justified text, only for a
    plain lower-case word of five letters or more (so never a name), and at most twice running.
  - **Lines kept together.** `#place` never leaves a paragraph's last line alone at the top of a
    page or its first alone at the foot.
- **`ensure(height)` and `gap(height)`.** Call `ensure` before anything that mustn't be split from
  what follows (a heading, a scene break): it turns the page unless that much fits. Use `gap` for
  space between blocks: it adds nothing at the top of a page.
- **Blocks.** `#blocks` walks the story's nodes: paragraph, heading, blockquote, the two lists and
  the scene break (`ornament`). **A node it doesn't know is skipped without an error.** A
  paragraph after a paragraph is indented; after anything else it starts flush.
- **The first letter.** `#opening` sets the first paragraph round it, sized from the face's real
  capital height so it spans its lines exactly. A raised letter is just large text.
- **Raised runs.** `#draw` lifts a run with `raise` by `RISE` (0.36 of the text's size), its
  highlight, underline and strike with it.
- **Footnotes** go at the foot of the page their number is on, in 8.6 on 11.6 under a 72 pt rule.
  Each `Line` lists the notes whose numbers are in it, and `#place` only puts a line on a page if
  its notes fit under it too (`#footFor`). What they take is `#reserved`, which moves the foot up
  (`#room` tests against `FOOT - reserved`). A note longer than 3 lines may split after 2
  (`NOTE_FIRST_LINES`) and run on to the next page's foot (`#runOn`), and nothing else with a
  note goes on the page it split on. `addPage` draws the page's notes first (`#footnotes`), and a
  section's last notes are drawn when it ends (`#lastNotes`), on pages of their own if they must.
  Numbers start again in each chapter, as in reading mode.
- **Pages of the book.** `part()` starts a right-hand page (`toRecto`). `story()` starts a new
  page. A page that opens with a section's heading has no running head. Every other page has
  one: the section's title on a right-hand page, the book's on a left-hand one.
- **Page numbers.** Front matter has none (`front` counts those pages), and the story starts on
  page 1, which is always a right-hand page.
- **Front matter.** The cover (a whole book only), the title page, then the contents if there's
  more than one entry. The contents' pages are added empty and drawn last (`drawContents`), once
  every section knows its page. That needs `bufferPages: true`. Each line links to its section,
  and the sections are also the PDF's bookmarks.
- **The cover** is drawn here a second time, to match `ui/BookCover.svelte`: the variant from
  `coverVariant(id)`, colours in `COVER`. Change one and change the other. The book view in
  reading mode draws a third (`.cover-face` in `reader/BookView.svelte`).

### Typefaces, and characters they can't draw

- **The faces** are the app's own: Newsreader (`read`), Gloock (`display`), Schibsted Grotesk
  (`ui`), and Courier Prime for typewriter (`mono`), which the app itself leaves to the device.
  Gloock has one weight and no italic.
- **In pieces.** Each face comes cut up by alphabet, as Google serves it. `FacePicker.pick` looks
  for a character in the face's Latin piece, then its extended Latin, then Noto Serif's
  Vietnamese, Greek and Cyrillic.
- **None of them has it.** The character is drawn as `?` and counted. The count goes back in the
  `X-Export-Missing` header and the buttons show a note. Word needs none of this: it finds a font
  itself.
- **Loading.** `faces()` reads every file once and keeps them, since one function may serve many
  exports. `font: null` on the document keeps out PDFKit's built-in Helvetica, whose files aren't
  there once deployed.

## The Word file

A working copy to edit or send on, so it leans on styles and not on direct formatting: changing
Book Text or Heading 2 in Word changes the whole book.

- **Styles.** `BookText` (indented) and `BookTextFirst` (flush, for a paragraph that follows
  anything but a paragraph), `BookQuote`, `SceneBreak` (which holds `* * *`), `Description`,
  `Byline`, `BookName`, `TitleLabel`, `ContentsTitle`, and `ChapterDrop` and `PartDrop`, which are
  empty paragraphs that make the space above a heading (Word ignores space before at the top of
  a page).
- **Headings.** Parts are Heading 1 and chapters Heading 2, which fill the contents and the
  Navigation pane. Headings inside story text are Heading 3 to 5.
- **Fonts.** Cambria, Calibri and Courier New: they come with Office, and they're faces the
  page-number estimate can measure.
- **Lists.** Each numbered list gets its own instance so it counts from its own start, and every
  start number used needs its own definition (`blocks.starts`).
- **The first letter** is a Word frame (a drop cap). A raised one is a large run.
- **Footnotes** are Word's own (`FootnoteReferenceRun`), in its Footnote Text style at 9.5 pt, a
  paragraph for each of the note's. Word numbers and places them. The file is one section, so
  Word numbers them straight through the book, not by chapter. `docx` sets the number first in
  the note with nothing after it, so `footnote()` adds the space Word's own notes have.
- **The contents' page numbers** come from `estimatePageNumbersWith`, which takes about 8 seconds
  per 100,000 words. Over 250,000 words it's skipped, and Word offers to fill the numbers in when
  the file opens.

## Adding something to story text

Start with "Adding a kind of node or mark" in the `bb-rich-text` skill. For the files:

1. **`manuscript.ts`** if it's inline: a mark becomes a field on `Run` in `runsOf`. A new colour
   or highlight goes in `INKS` or `MARKS`, a new typeface in `FAMILIES` and `Family`.
2. **`pdf.ts`**: a branch in `#blocks` for a block, or handling in `#draw` for a `Run` field. A new
   typeface needs its `.woff` pieces and licence in `fonts/` and a name in `FILE_NAMES`.
3. **`word.ts`**: a branch in `Blocks.of`, or an option in `textRun`. Prefer a named style to
   direct formatting.
4. **Check both files** (below). Neither writer complains about a node it doesn't know, so only
   looking at the result shows whether it arrived.

Not there yet, and needed by ideas on the roadmap: nothing draws a picture, and a `Run` can be
raised (footnotes) but not lowered (subscript).

## The function and its limits

- **Its own function.** `export const config = { maxDuration: 60 }` in each route gives the export
  a Vercel function to itself. That keeps the typefaces and the typesetting out of the function
  that serves every page.
- **4.5 MB.** Vercel won't let a function send back more than that unless the response is
  streamed (checked 2026-11-09), and `exportResponse` sends the whole file at once. Stream it
  before anything makes files much bigger, pictures above all.
- **Packages.** PDFKit's dependencies clash with Better Auth's, which is why `vite.config.ts` has
  `ssr.noExternal`. Read "Adding a package" in the `bb-stack` skill before adding another.

## Checking a file

The `bb-verify` skill has the steps: fetch it signed in, put the PDF's pages on a sheet with
`pdf-sheet.mjs` and look at them, open the Word file in real Word with `word-check.ps1` (every
number in the contents should match where its heading lands), search both for anything that
should have stayed out, and after a change to server packages run the built function with
`serve-func.mjs`.

## Left out so far

EPUB, a cover in the Word file, and scripts beyond Latin, Greek, Cyrillic and Vietnamese in the
PDF. They're on idea 2's row in the `bb-roadmap` skill. Endnotes, and footnotes numbered by
chapter in Word, are on idea 23's.
