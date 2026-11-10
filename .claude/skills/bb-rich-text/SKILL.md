---
name: bb-rich-text
description: How formatted text works in Book Builder, covering the stored value format (plain text or Tiptap JSON), $lib/rich.ts (parse, clean, toHTML, plainText), the ink and highlight palettes, first-letter (drop cap) styles, @ mentions, prose.css, the RichEditor, RichText and RichInline components on Tiptap 3.32, and the full list of places that must change when story text gains a new kind of block, inline node or mark. Use this whenever a task touches story text, descriptions, the editor or its toolbar, formatting, paste, word counts, drop caps, rendering text in reading mode or focus mode, or seeding text, and before adding anything new to what the editor can hold (a picture, a footnote, a link, a table, a new style), even if the user only says "the editor" or "the text".
---

# Book Builder: rich text

## The value format

A stored text value (story text, part/chapter/book descriptions, an author bio) is a string
that is either:

- **Plain text** (older values): paragraphs separated by line breaks. A line of only `*`, `#`, `~`, `-`, `•` or `⁂` (e.g. `* * *`) is a scene break.
- **Tiptap JSON**: a string that starts **exactly** with `{"type":"doc"`, which is how `isRich()` tells the two apart. Write it compactly, with no spaces after `:`/`,`. Story docs can carry `attrs.dropCap`.

Both forms are valid forever. Every function in `$lib/rich.ts` accepts either.

## `$lib/rich.ts`, the one place that understands values

| Function                                | Use                                                                                                                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parse(value, kind)`                    | Gets a clean doc from either form.                                                                                                                          |
| `cleanDoc` / `cleanValue(value, kind)`  | **Server-side on every save.** Drops unknown nodes, marks, colours and sizes and caps depth. Never trust client JSON.                                       |
| `serialize(doc, kind)`                  | Turns a doc into the stored string: `''` when empty, and a description with no formatting is stored as plain lines. Everything else is compact JSON.        |
| `toHTML(value, kind)`                   | Allow-listed, escaped HTML. Story text becomes blocks; a description becomes inline text joined with `<br>`. It's the only HTML that may go into `{@html}`. |
| `plainText(value, kind)`                | The words alone, one line per paragraph. Use it for word counts, emptiness checks and exports.                                                              |
| `capOf(value)` / `capPresentation(cap)` | The first-letter settings, and the class and style that render them.                                                                                        |

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
Go down the whole list. Plans for pictures and footnotes are in the `bb-roadmap` skill (ideas 22
and 23).

1. **The allow-list, in `rich.ts`.** `cleanBlocks` for a block, `cleanInline` for an inline node,
   `cleanMarks` for a mark. Keep only the attributes you name, with values you've checked.
   Whatever isn't there is dropped on every save. Decide what a description does with it too:
   `cleanInline` is given the `kind`.
2. **Its words, in `rich.ts`.** `textOf` and `blockLines` decide what `plainText` returns. A new
   block that holds text directly must be in `BLOCK_TYPES`, or its words are gone from every
   count. Decide on purpose whether its words count, because `plainText` is what all of these
   read: word counts and writing goals, Insights, word maps and who's speaking, "Appears in" and
   the casts that fill from names, the outline's text export, and the comparison in version
   history. `plainText` takes a third argument that stands in for a mention; something similar
   may suit a node whose words shouldn't be read as the story.
3. **Whether anything is there, in four places.** `isEmpty` in `rich.ts` counts words and scene
   breaks and nothing else, so text holding only something new is stored as `''`. Reading mode
   (`Reader.svelte` and `BookView.svelte`) and the export (`hasStoryText`) ask the same thing with
   `plainText(text).trim()` and would leave the chapter out.
4. **The page, in `rich.ts`.** `blockHTML`, `inlineNodeHTML` or `textHTML`, which make `toHTML`:
   reading mode, share links, every `RichText`, and version history. Escape every string, and
   write attribute values only from the allow-list. Anything a reader's browser would load or
   follow (an address, a link) must be one the cleaner has checked, since shared books are
   public.
5. **The editor.** The extension in `extensions.ts` (a Tiptap package pinned to 3.32.0, or our own
   as `mention.ts` is), a control in `Toolbar.svelte`, and paste: `cleanPastedHTML` decides what
   survives from another app. Whatever the editor can make, the cleaner must keep, and the
   reverse.
6. **How it looks, in `prose.css`,** once, for the editor, both reading views, focus mode and the
   homepage samples. Check it at night and on paper.
7. **The book view.** Each chapter is set in CSS columns one page wide and measured in a hidden
   copy to count its pages (`reader/book-layout.ts`). Something that changes size after that, or
   can't break across a column, moves every page after it. Give it its size up front and say how
   it breaks.
8. **Both exported files.** They read the document themselves, not through `toHTML`:
   `manuscript.ts`, `pdf.ts` and `word.ts`. See the `bb-export` skill.
9. **Saving, on the server.** If it points at something a writer owns, check that on save, as
   `ownedMentions` does for mentions. If readers shouldn't get it, take it out in `readableBook`,
   as `withoutMentions` does.
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

- **What it covers.** `.bb-prose` is the single definition of how story text looks: book paragraphs (indented, no gaps, flush after headings, quotes, lists and breaks), headings, quotes, lists, highlights, the scene-break ornament and drop caps.
- **Where it's used.** The editor, reading mode (scroll and book), focus mode and the homepage samples all use it. Change it there, not per page.
- **Colours inside.** Its colours come from tokens, so in a `data-scheme="light"` subtree (the paper book) it renders dark ink automatically.

## Components (`src/lib/components/rich`)

- **`RichEditor.svelte`**: the Tiptap editor.
  - Tiptap and `./extensions` are dynamically imported in `onMount`, which keeps them out of server rendering and the first bundle.
  - Props: `value`, `kind`, `onchange`, `label`, `id`, `placeholder`, `autofocus`, `delay`, `boxed`, `italic`, `toolbar`, `bookId` (turns on @ mentions), `ontransaction(editor, transaction)`, `onescape`, `onblur`.
  - Exports `flush()` (emit pending changes now) and `focus()`.
- **`Toolbar.svelte`, `Menu.svelte`**: formatting controls (bold, italic, underline, strike, colour, highlight, size, font, alignment, headings, lists, quote, scene break, first letter).
- **`RichText.svelte`**: read-only rendering through `toHTML`. Story text gets `.bb-prose` plus the cap class; descriptions are inline (`italic` flips emphasis to roman inside italic text).
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
