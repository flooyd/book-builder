---
name: bb-rich-text
description: How formatted text works in Book Builder, covering the stored value format (plain text or Tiptap JSON), $lib/rich.ts (parse, clean, toHTML, plainText), the ink and highlight palettes, first-letter (drop cap) styles, @ mentions, footnotes, pictures from the art shelf, the Insert menu and the "/" list, prose.css, the RichEditor, RichText and RichInline components on Tiptap 3.32, and the full list of places that must change when story text gains a new kind of block, inline node or mark. Use this whenever a task touches story text, descriptions, the editor or its toolbar, formatting, paste, word counts, drop caps, rendering text in reading mode or focus mode, or seeding text, and before adding anything new to what the editor can hold (a picture, a footnote, a link, a table, a new style), even if the user only says "the editor" or "the text".
---

# Book Builder: rich text

## The value format

A stored text value (story text, part/chapter/book descriptions, an author bio) is a string
that is either:

- **Plain text** (older values): paragraphs separated by line breaks. A line of only `*`, `#`, `~`, `-`, `•` or `⁂` (e.g. `* * *`) is a scene break.
- **Tiptap JSON**: a string that starts **exactly** with `{"type":"doc"`, which is how `isRich()` tells the two apart. Write it compactly, with no spaces after `:`/`,`. Story docs can carry `attrs.dropCap`.

Both forms are valid forever. Every function in `$lib/rich.ts` accepts either.

## `$lib/rich.ts`, the one place that understands values

| Function                                 | Use                                                                                                                                                                                                              |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parse(value, kind)`                     | Gets a clean doc from either form.                                                                                                                                                                               |
| `cleanDoc` / `cleanValue(value, kind)`   | **Server-side on every save.** Drops unknown nodes, marks, colours and sizes and caps depth. Never trust client JSON.                                                                                            |
| `serialize(doc, kind)`                   | Turns a doc into the stored string: `''` when empty, and a description with no formatting is stored as plain lines. Everything else is compact JSON.                                                             |
| `toHTML(value, kind, notes?, pictures?)` | Allow-listed, escaped HTML. Story text becomes blocks; a description becomes inline text joined with `<br>`. It's the only HTML that may go into `{@html}`. A picture shows only if `pictures` says where it is. |
| `plainText(value, kind)`                 | The words alone, one line per paragraph, without footnotes' notes or pictures' captions. Use it for reading the story as narration.                                                                              |
| `textWithNotes(value)`                   | The words with footnotes and pictures in: numbers where they sit, notes after, a `[Picture: caption]` line where each picture is. For comparing versions.                                                        |
| `hasContent(value, pictures?)`           | Whether a story holds anything to read: words, a note or a picture (given `pictures`, only one that's still on the shelf). The one answer to "is it empty?".                                                     |
| `footnotesIn(value)`                     | A story's notes, note 1 first, each a description value.                                                                                                                                                         |
| `picturesIn` / `mapPictures`             | A story's pictures in reading order, and the text with them changed or taken out (return null).                                                                                                                  |
| `capOf(value)` / `capPresentation(cap)`  | The first-letter settings, and the class and style that render them.                                                                                                                                             |

Word counts and goals count with `storyWords(value)` from `$lib/reading`: the narration's words
plus the notes' and the captions' (the user's choice: the writer wrote those too).

`kind` is `'story'` (block content plus drop cap) or `'description'` (inline formatting; also
used for bios).

### Palettes, not arbitrary colours

- **Colours.** Text colours (`INKS`) and highlights (`HIGHLIGHTS`) are named palette entries stored as `var(--ink-*)` / `var(--mark-*)`, so they adapt to light and dark. Paste keeps only palette colours, never `rgb(...)` or hex from other apps. Sizes (`SIZES`) and fonts (`FONTS`) are fixed lists too.
- **"Any colour".** The colour, highlight and first-letter menus also have a colour picker, and what it stores is `#rrggbb`, which the cleaner accepts. Such a colour is the same in both themes, so it may be hard to read in one of them. That's the writer's choice. Don't build anything that assumes every stored colour is a palette variable.
- **New styles.** To add a colour or size, extend the list in `rich.ts`, the cleaning rules and the tokens (`--ink-*` in `tokens.css`) together, and the export's tables (see the `bb-export` skill).

### Blocks and headings

Story blocks are paragraph, heading, blockquote, bullet/ordered list, list item and
horizontal rule (drawn as a scene-break ornament). Headings inside text are output from `<h4>`
down, because reading mode uses `<h2>`/`<h3>` for chapter titles.

## Mentions

A mention is an inline atom node in **story text only**:
`{"type":"mention","attrs":{"entry":"character","id":12,"label":"Juno"}}`, with `entry` one of
`character`, `place` or `system`. `label` is the words on the page, which may be a short name
rather than the entry's own, and it may carry marks.

- **Rules of the road.**
  - `textOf`, and so `plainText` and word counts, read `label`. A new reader of the document must handle the node too, or those words vanish.
  - Descriptions and bios have no mentions: `cleanInline` turns one into plain text there.
  - `mentionsIn(value)` lists them, and `mapMentions(value, change)` rewrites them (return null to leave plain words). Use these rather than walking the JSON yourself.
- **Readers never get them.** `toHTML` prints the label as plain words, and `readableBook` runs every text through `withoutMentions`. A link can be a spoiler: "the stranger" pointing at Juno's id gives the story away in the page source. Only the editor shows them as links, with `.bb-mention` in `prose.css`.
- **Renames and deletes.** A rename rewrites mentions that show the full name or the first name, and leaves aliases alone (`renamedLabel` in `$lib/bible`). A delete leaves the words (`forgetEntry`).
- **The @ menu.** It ranks this book's entries first, then those in the other books of its series ("from the series"), then the rest ("from another book"). A bare @ lists the first two groups, and the rest need a search. Any first mention brings the entry into the book.
- **In the editor.** No space goes in after a mention, since the next character is as likely to be a comma or an apostrophe. Backspace takes the whole name. The menu and card are popovers in the top layer so they show over focus mode, and they're mounted inside the editor because a modal dialog makes everything outside it inert.
- **Names link themselves.** In any editor with a `bookId`, the names of that book's story bible entries are drawn as links wherever they're written, on load and as each one is typed, with no @ (`rich/auto-mention.ts`). They're ProseMirror decorations, never nodes: nothing is saved, the server never sees them, and the words stay ordinary text. Only entries linked to the book count, so one from another book or the series stays plain until it's brought in. Which words count is `storyNames` and `nameFinder` in `$lib/bible` (also what Insights counts by): name, name without "the", aliases, and a person's first or last name; case as written; longest name wins; a spelling two entries share is left alone unless only one of them owns it outright. Only the paragraphs a change touches are searched again, and the store subscriptions rebuild the finder when an entry is added, renamed or joins the book. The span carries `data-auto-mention`, not `data-type="mention"`, so the editor can't mistake it for a real mention if the browser hands it back. The hover card works for both.
- **They count as appearances.** An entry's "Appears in" list and the bible cards' chapter counts add the names written out to the @ mentions. `namesWritten` in `lib/server/bible.ts` reads each book's story text with every mention as `NOT_TEXT` (`plainText(value, 'story', NOT_TEXT)`, so a mention never counts twice) and counts with `countNames`, using the same `nameFinder` as the editor, so a page's count is what the writer sees linked. It runs on each load and nothing is stored, so renames, aliases and new entries count at once with no re-indexing. A whole novel takes milliseconds.
- **They fill the cast.** A name written in a chapter for the first time puts its entry in that chapter's cast, like a first @ mention (`castNamed` in `lib/server/bible.ts`, called by the story-text save). "First" is against the text before the save, so someone taken out of a cast by hand stays out while their name stays on the page. When an entry joins a book, or its name or aliases change, `castByName` reads that book once and casts it wherever the story names it now and didn't before. Nothing is stored about names, so there's no table to keep in step. Text saved before this shipped keeps the casts it had: the user decided a one-off fill isn't needed, so don't offer one.
- **Packages.** `@tiptap/extension-mention` and `@tiptap/suggestion` are pinned with the other Tiptap packages. `@tiptap/suggestion` needs `@floating-ui/dom` as a peer, and without it the editor fails to load.

## Footnotes

An inline atom in **story text only** that carries its own note:
`{"type":"footnote","attrs":{"note":"…"}}`. The note is a description value. The record of how
it was built, and what it left out, is `ideas/23-footnotes.md` in the `bb-roadmap` skill.

- **Numbers are never stored.** A number is the note's place among its text's notes, counted
  where it's drawn: a CSS counter in the editor (`.bb-footnote::after`), `toHTML` on the page,
  `storyOf` in the export.
- **The cleaner** keeps `note` only, cleans it as a description (`noteOf`), and drops a footnote
  with a blank note, and every footnote in a description.
- **Whose words.** `plainText` leaves the notes out, so Insights, word maps, names and casts read
  narration only. `storyWords` counts them; `textWithNotes` shows them.
- **On the page.** `toHTML(value, 'story', key)` gives each number a link to its note and back, with
  ids from `key` (the chapter's anchor), and lists the notes in `aside.bb-notes` after the story.
  Without a key there are no ids, for text drawn more than once (the book view). Story `RichText`
  takes the key as `notes`. A tap on a number in reading mode opens `reader/NotePopover.svelte`.
- **In the editor.** `rich/footnote.ts` is the node, its keys (Ctrl+Alt+F adds one) and a bridge
  to `rich/FootnoteBox.svelte`, the note's box: a top-layer popover mounted inside `RichEditor`,
  as the mention menu is, holding a `RichEditor kind="description"` of its own. That nested
  editor is also a `.rich-area`, so a rule meant for the story's editor alone needs a child
  selector (`.surface-editor > .area > .rich-area`).

## Pictures

A block in **story text only**, between the story's top-level blocks (never in a quote, a list or
a description): `{"type":"picture","attrs":{"art":12,"width":1800,"height":1200,"size":"wide",
"alt":"…","decorative":false,"caption":"…"}}`. `size` is `wide`, `small` or `page` (a page to
itself in the book view and both files), and the caption is a description value. The record of
how it was built, and what it left out, is `ideas/22-pictures-in-the-page.md` in the `bb-roadmap`
skill; the shelf it comes from is the `bb-art` skill.

- **An id, never an address.** The document names the picture's id on the writer's art shelf.
  Whatever draws it looks the id up in `PictureSources` (`{ url, smallUrl, width, height }` by id),
  which only the server fills, from the author's own shelf (`picturesFor`), and `pictureHTML`
  checks each address is our own or https. So no document can make a reader's browser load
  something from another site. On the writer's own pages the editor reads `artStore`, and
  version history builds sources with `shelfSources($artStore)` from `$lib/art`.
- **Its box comes first.** `pictureHTML` sets the figure's shape (`--ratio`) and `width`/`height`
  before the file arrives, with a `srcset` of the small copy and the whole picture
  (`pictureSizes`), so nothing moves as it loads: the book view counts its pages before then.
- **On save** (`ownedPictures` in `lib/server/art.ts`): another writer's picture is taken out, and
  the writer's own takes its width and height from the file. One taken off the shelf stays, so
  the editor can show where it was. **Readers** never see that one: `readableBook` takes it out,
  caption and all.
- **Whose words.** Captions count toward word counts and goals (`storyWords`), and nothing else
  reads them: `plainText` leaves them out, so Insights, word maps, names and casts read the story
  alone. Version history shows a picture added, moved or taken out by its `[Picture: …]` line.
- **In the editor.** `rich/picture.ts` is the node and its view: it draws from `artStore`, shows
  "Finding the picture…" while the library loads, a dashed "taken off your art shelf" box with
  Take it out for one that's gone, and small tags under it ("A page to itself", "No description
  yet"). Selecting a picture opens `rich/PictureBox.svelte`, its settings, without taking focus
  from the text: the size, the caption (a `RichEditor kind="description"` of its own, as a
  footnote's box has), what it shows (`alt`, filled from the shelf's description), "Only
  decoration", Change picture and Remove. Enter on a selected picture goes into its caption; Esc
  or Done puts the box away with the caret after the picture (`caretAfterPicture`); typing with
  it selected starts a paragraph after it; Backspace and Delete take it out.
- **No empty paragraph comes with it.** An empty paragraph is a blank line to readers
  (`<p><br></p>`), so `insertPicture` puts in the picture alone (in place of the empty line it's
  on, before the block it's at the start of, or after the block it's in). Where no text follows,
  the caret is ProseMirror's gap cursor, between blocks, and typing there starts a paragraph.
  `RichEditor` draws the gap cursor in the caret's colour, since ProseMirror's is black.
- **Getting one in.** The Insert menu or "/" opens `ShelfPicker` (from the studio's components,
  with `upload` on, so a picture can be uploaded from there too). Picture files dropped or pasted
  go up to the shelf first (`uploadInto` in `RichEditor`, with a notice at the foot of the screen
  while they do) and then in. A picture pasted from another page doesn't come in as a link to it:
  the paste keeps its words and the notice says why.
- **Deleting from the shelf** asks first and names where it's set (`GET /api/art/[id]/uses`), see
  the `bb-art` skill.

## The Insert menu and "/"

- **One list** (`rich/insert.ts`): Picture, Footnote, Scene break, and Mention where the editor has
  a `bookId`, with their keys. The toolbar's Insert button opens it in a `Menu`; typing "/" on an
  empty line opens it in `rich/SlashMenu.svelte`. Both run `runInsert`. The scene break, mention
  and footnote buttons left the toolbar for it.
- **"/"** (`rich/slash.ts`) is `@tiptap/suggestion` with `startOfLine`, allowed only in a paragraph
  holding nothing but the "/". A letter typed after it, or Esc, closes the list and leaves the "/".
  The list is a top-layer popover mounted inside the editor, as the @ list is, so it works over
  focus mode.
- **Esc.** The editor's own Esc (`EscapeKey` in `extensions.ts`, which blurs it and calls
  `onescape`, so focus mode closes) runs at priority 50, below everything else, so an open @ or /
  list takes Esc first. A toolbar `Menu` keeps the caret in the text while it's open, so Esc
  reaches the editor: `EscapeKey` closes any open `[data-menu]` and does nothing else.

## Drop caps (the "first letter")

- **Settings.** `DropCap = { style: 'drop' | 'raised' | 'boxed' | 'none', lines: 2 | 3 | 4, font, color }`, defaulting to `{ drop, 2, display, accent }`. It's stored in `doc.attrs.dropCap`.
- **Rendering.** `prose.css` styles it with `.cap-*` classes and `--cap-lines`, `--cap-font`, `--cap-color`. The sizes are **measured** against Gloock and Newsreader at the prose line-height of 1.75:
  - drop: `(lines - 1) * 2.3em + 1.05em`
  - boxed: `(lines - 1) * 1.4em + 1em`
- **Line-height.** If you change `.bb-prose` line-height, re-measure in a browser that the letter spans exactly 2, 3 and 4 lines. Don't guess.

## Adding a kind of node or mark

Story text is read in many more places than the editor, and nearly all of them skip what they
don't know without an error. So something new (a picture, a footnote, a link, a new mark) can
look finished in the editor and be missing everywhere else, or be thrown away by the next save.
Go down the whole list. Footnotes went down it first and pictures next: their records (ideas 23
and 22 in the `bb-roadmap` skill) say what tripped them up.

1. **The allow-list, in `rich.ts`.** `cleanBlocks` for a block, `cleanInline` for an inline node,
   `cleanMarks` for a mark. Keep only the attributes you name, with values you've checked.
   Whatever isn't there is dropped on every save. Decide what a description does with it too:
   `cleanInline` is given the `kind`.
2. **Its words, in `rich.ts`.** `textOf` and `blockLines` decide what `plainText` returns. A new
   block that holds text directly must be in `BLOCK_TYPES`, or its words are gone from every
   count. Decide on purpose whether its words count. `plainText` is what Insights, word maps and
   who's speaking, "Appears in" and the casts that fill from names read. Word counts and writing
   goals read `storyWords` (in `$lib/reading`), and the comparison in version history reads
   `textWithNotes`: both add footnotes' notes to `plainText`, and a new node with words of its
   own belongs in whichever of the three should see them. `plainText` takes a third argument
   that stands in for a mention, and a `Reading` inside it handles footnotes and pictures;
   something similar may suit a node whose words shouldn't be read as the story.
3. **Whether anything is there.** `isEmpty` in `rich.ts` counts words, scene breaks, footnotes and
   pictures and nothing else, so text holding only something new is stored as `''`. Reading mode
   (`Reader.svelte` and `BookView.svelte`) and the export (`hasStoryText`) ask `hasContent`, which
   would leave out a chapter holding only something it doesn't know. Teach both.
4. **The page, in `rich.ts`.** `blockHTML`, `inlineNodeHTML` or `textHTML`, which make `toHTML`:
   reading mode, share links, every `RichText`, and version history. Escape every string, and
   write attribute values only from the allow-list. Anything a reader's browser would load or
   follow (an address, a link) must be one the cleaner has checked, since shared books are
   public.
5. **The editor.** The extension in `extensions.ts` (a Tiptap package pinned to 3.32.0, or our own
   as `mention.ts` is), a row in the Insert list (`insert.ts`) for something put in, or a control
   in `Toolbar.svelte` for a style, and paste: `cleanPastedHTML` decides what
   survives from another app. It takes off classes and styles and keeps `data-` attributes, which
   is how a footnote copied inside the editor keeps its note. Whatever the editor can make, the
   cleaner must keep, and the reverse.
6. **How it looks, in `prose.css`,** once, for the editor, both reading views, focus mode and the
   homepage samples. Check it at night and on paper.
7. **The book view.** Each chapter is set in CSS columns one page wide and measured in a hidden
   copy to count its pages (`reader/book-layout.ts`). Something that changes size after that, or
   can't break across a column, moves every page after it. Give it its size up front and say how
   it breaks. A chapter with footnotes is cut into pages by the app instead (`sliceFlow`, with
   lines read by `reader/flow-lines.ts`), which treats a heading, a title, a scene break or a
   picture as one block that isn't split (`alone` for a picture with a page to itself) and reads
   everything else as lines of text: a new block that mustn't be cut needs adding to the list in
   `flowLines`.
8. **Both exported files.** They read the document themselves, not through `toHTML`:
   `manuscript.ts`, `pdf.ts` and `word.ts`. See the `bb-export` skill.
9. **Saving, on the server.** If it points at something a writer owns, check that on save, as
   `ownedMentions` does for mentions and `ownedPictures` for pictures. If readers shouldn't get
   it, take it out in `readableBook`, as `withoutMentions` does.
10. **Old text.** Both stored forms are valid forever. Text is cleaned whenever it's shown as well
    as when it's saved, and a restored version is cleaned again. So taking a kind of node off
    the allow-list later hides it everywhere at once, and deletes it the next time that text is
    saved.
11. **Samples and seeds.** `seed-long-book.py` in the `bb-verify` skill, and the homepage's editor
    picture if the user wants it shown.

Test the cleaner before trusting it: `test-lib.mjs` in the `bb-verify` skill runs a test file
against `$lib/rich` in a second or two. The cases that matter are the hostile ones: an attribute
that isn't on the list, a value of the wrong type, the node inside a description, the node as
the only thing in the text.

## Exports

`lib/server/export/manuscript.ts` reads the document itself rather than going through `toHTML`, so
a new node, mark, colour, size or font has to be added there and in `pdf.ts` and `word.ts`. Its
colour tables hold the light values of `--ink-*` and `--mark-*`, because a page is always paper.
The `bb-export` skill has the rest.

## `prose.css`

- **What it covers.** `.bb-prose` is the single definition of how story text looks: book paragraphs (indented, no gaps, flush after headings, quotes, lists and breaks), headings, quotes, lists, highlights, the scene-break ornament, drop caps, footnotes' numbers (`.bb-footnote` in the editor, `.bb-fn-ref` on the page) and the list of notes (`.bb-notes`), and pictures (`.bb-picture`, `-small`, `-page`: on paper so line art reads at night, never taller than `--picture-most`, which the book view sets from its page, and an italic caption with emphasis upright). The editor's own look for a picture (selected, gone, its tags) is in `RichEditor.svelte`.
- **Where it's used.** The editor, reading mode (scroll and book), focus mode and the homepage samples all use it. Change it there, not per page.
- **Colours inside.** Its colours come from tokens, so in a `data-scheme="light"` subtree (the paper book) it renders dark ink automatically.

## Components (`src/lib/components/rich`)

- **`RichEditor.svelte`**: the Tiptap editor.
  - Tiptap and `./extensions` are dynamically imported in `onMount`, which keeps them out of server rendering and the first bundle.
  - Props: `value`, `kind`, `onchange`, `label`, `id`, `placeholder`, `autofocus`, `delay`, `boxed`, `italic`, `toolbar`, `bookId` (turns on @ mentions), `ontransaction(editor, transaction)`, `onescape`, `onblur`.
  - Exports `flush()` (emit pending changes now, a footnote's note or a caption first) and `focus()`.
  - A story editor mounts `FootnoteBox.svelte` (a footnote's note), `PictureBox.svelte` (a picture's settings), `SlashMenu.svelte` (the "/" list), `ShelfPicker` while a picture is being chosen, and a notice for uploads and refused pastes. Their bridges reach the extensions through `extensionsFor(kind, placeholder, { onescape, mentions, footnotes, pictures, slash })`.
  - An empty value opens as one empty paragraph (`contentOf`), so the placeholder shows before the field is focused.
- **`Toolbar.svelte`, `Menu.svelte`**: formatting controls (bold, italic, underline, strike, colour, highlight, size, font, alignment, headings, lists, quote, first letter) and, for story text, the Insert menu (see above). `Menu` carries `data-menu`, which is how Esc finds an open one.
- **`RichText.svelte`**: read-only rendering through `toHTML`. Story text gets `.bb-prose` plus the cap class; descriptions are inline (`italic` flips emphasis to roman inside italic text). `notes` is the key that links footnotes to their notes, and `pictures` says where its pictures are.
- **`RichInline.svelte`**: click-to-edit for short rich fields (descriptions).
  - It tracks whether focus is still `inside`, because unmounting the focused editor fires `focusout`. Without that flag it closes the moment it opens.
- **`extensions.ts`**: the Tiptap extension set. Keep it in step with the allow-list in `rich.ts`. Anything the editor can make, the cleaner must keep, and the reverse.

### Tiptap version

All `@tiptap/*` packages are pinned to **3.32.0** with no caret. Upgrade them together, on
purpose, and run the editor through `bb-verify` afterwards.

## Saving story text

- **Client.** `$lib/story-text.svelte.ts` (`StoryTextDoc`, `guardStoryText`) handles debounced saves, Ctrl/Cmd+S (not with Shift, since Ctrl+Shift+S is the editor's strikethrough), asking before leaving with unsaved text, and a `flush` before navigation.
- **Server.** `$lib/server/story-text.ts` cleans the value, saves it, touches `updatedAt` up the chain and returns `touchedAt`. Focus mode autosaves 2.5s after typing stops.
- **Versions.** The same save keeps the text it replaces as a version when one is due, and `StoryTextDoc.restore` puts one back (see Version history in the `bb-feature-map` skill). A version is stored in the value format above, so anything that reads values reads versions too, and a restore cleans it again in case the allow-list has changed.
