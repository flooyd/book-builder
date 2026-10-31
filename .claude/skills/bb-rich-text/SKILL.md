---
name: bb-rich-text
description: How formatted text works in Book Builder, covering the stored value format (plain text or Tiptap JSON), $lib/rich.ts (parse, clean, toHTML, plainText), the ink and highlight palettes, first-letter (drop cap) styles, prose.css, and the RichEditor, RichText and RichInline components on Tiptap 3.32. Use this whenever a task touches story text, descriptions, the editor or its toolbar, formatting, paste, word counts, drop caps, rendering text in reading mode or focus mode, or seeding text, even if the user only says "the editor" or "the text".
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
- **New styles.** To add a colour or size, extend the list in `rich.ts`, the cleaning rules and the tokens (`--ink-*` in `tokens.css`) together.

### Blocks and headings

Story blocks are paragraph, heading, blockquote, bullet/ordered list, list item and
horizontal rule (drawn as a scene-break ornament). Headings inside text are output from `<h4>`
down, because reading mode uses `<h2>`/`<h3>` for chapter titles.

## Drop caps (the "first letter")

- **Settings.** `DropCap = { style: 'drop' | 'raised' | 'boxed' | 'none', lines: 2 | 3 | 4, font, color }`, defaulting to `{ drop, 2, display, accent }`. It's stored in `doc.attrs.dropCap`.
- **Rendering.** `prose.css` styles it with `.cap-*` classes and `--cap-lines`, `--cap-font`, `--cap-color`. The sizes are **measured** against Gloock and Newsreader at the prose line-height of 1.75:
  - drop: `(lines - 1) * 2.3em + 1.05em`
  - boxed: `(lines - 1) * 1.4em + 1em`
- **Line-height.** If you change `.bb-prose` line-height, re-measure in a browser that the letter spans exactly 2, 3 and 4 lines. Don't guess.

## `prose.css`

- **What it covers.** `.bb-prose` is the single definition of how story text looks: book paragraphs (indented, no gaps, flush after headings, quotes, lists and breaks), headings, quotes, lists, highlights, the scene-break ornament and drop caps.
- **Where it's used.** The editor, reading mode (scroll and book), focus mode and the homepage samples all use it. Change it there, not per page.
- **Colours inside.** Its colours come from tokens, so in a `data-scheme="light"` subtree (the paper book) it renders dark ink automatically.

## Components (`src/lib/components/rich`)

- **`RichEditor.svelte`**: the Tiptap editor.
  - Tiptap and `./extensions` are dynamically imported in `onMount`, which keeps them out of server rendering and the first bundle.
  - Props: `value`, `kind`, `onchange`, `label`, `id`, `placeholder`, `autofocus`, `delay`, `boxed`, `italic`, `toolbar`, `ontransaction(editor, transaction)`, `onescape`, `onblur`.
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
