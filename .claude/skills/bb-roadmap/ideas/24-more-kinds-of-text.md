# Idea 24: more kinds of text

**A plan, written 2026-11-09. Nothing here is built.** This is the "etc." in what the user asked
for: "I want the editor to be more sophisticated and allow images in page, footnotes, etc."
Pictures are idea 22 and footnotes idea 23. These are the smaller pieces, and each can ship on
its own. The user can ask for one by letter ("24c").

Every piece follows "Adding a kind of node or mark" in the `bb-rich-text` skill, and has to reach
the PDF and the Word file (`bb-export`).

## What the editor has today

Undo and redo; paragraph, three headings and quote; four typefaces and six sizes; bold, italic,
underline and strikethrough; text colour and highlight; four alignments; bulleted and numbered
lists; scene break; the first letter; `@` mentions; clear formatting. That's 22 controls in one
row, which wraps on a wide screen and scrolls sideways under 600 px.

## The pieces

### a. An Insert menu

The toolbar has no room for a picture button, a footnote button and the blocks below. Put what's
inserted (picture, footnote, scene break, the kinds of quote, page break) in one Insert menu, and
open the same list by typing `/` at the start of a line. `@tiptap/suggestion` is already
installed for `@`, and `MentionMenu.svelte` shows how a list like that is mounted so it works
over focus mode.

Worth doing as soon as there are two new things to insert, so with whichever of 22 and 23 comes
second. Be careful with a bar that floats over selected text
(`@tiptap/extension-bubble-menu`): the user doesn't like controls that come and go while typing
(see "Things the user has reacted to" in the `bb-design` skill).

### b. Small capitals, superscript and subscript

Three marks. Small capitals are what a printed book sets the first words of a chapter in, after
the first letter, so offer that with the first letter's settings as well as on a selection.

- **On the page:** `font-variant-caps`, `<sup>`, `<sub>`. Check that Newsreader, as Google serves
  it, has real small capitals; a browser fakes them otherwise.
- **PDF:** the font files in `server/export/fonts` are cut-down pieces, so small capitals there are
  probably capitals at a smaller `scale`, which a `Run` already has. Raising and lowering needs
  the lift that footnotes add (idea 23, trap 1).
- **Word:** `docx` has small capitals, superscript and subscript on a run.
- `@tiptap/extension-superscript` and `-subscript` exist at 3.32.0 (MIT).

### c. Kinds of quote: epigraph, verse, letter

- **Epigraph:** a quotation and who said it, at the head of a chapter.
- **Verse:** a poem or a song. Its line breaks are kept, it's never justified or hyphenated, and a
  line too long for the page turns over with an indent.
- **Letter:** anything a character reads (a letter, a message, a sign), set apart.

One attribute on the quote that's already there, not three new blocks: fewer things for the
cleaner, the styles and both exports to learn. In `pdf.ts` the quote branch of `#blocks` already
changes its `Flow` (insets, italic), so verse is a `Flow` with `align: 'left'` and no
hyphenation. In `word.ts` each kind is a style beside `BookQuote`.

### d. Links

They're switched off (`link: false` in `extensions.ts`). The package is there already, as part
of the starter kit.

- **Only `https:`, `http:` and `mailto:`**, checked by the cleaner on save and again by `toHTML`.
  Never `javascript:` or anything else.
- **Shared books and author pages are public**, and a free app with public pages and links draws
  spam. Mark links `nofollow`, and check what the public pages tell search engines (share links
  are `noindex` already).
- **PDF:** a link over the words. **Word:** a real hyperlink.

### e. Page break

A block that starts a new page: a new column in the book view, a new page in the PDF and in Word,
and nothing at all when scrolling.

### f. Tables

For non-fiction and appendices. `@tiptap/extension-table` exists at 3.32.0 (MIT), but it's the
dearest piece here: `pdf.ts` sets lines of words and has no table layout, a table doesn't break
across the book view's columns, and phones are narrow. Do it last, and ask the user first whether
their writers need it.

## Left out on purpose

- **Spacing and indents on one paragraph.** `prose.css` is the one definition of how a book's text
  looks. How a whole book is set (its faces, its spacing) belongs with book design, idea 26.
- **Code blocks.** They're switched off, and it's a tool for stories.
