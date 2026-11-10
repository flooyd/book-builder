# Idea 23: footnotes

**A plan, written 2026-11-09. Nothing here is built.** It needs nothing else first: no storage, no
running cost, and no choice that has to wait for the user. The traps below were found by reading
the code that day, so check they still hold.

## What the user asked for

"I want the editor to be more sophisticated and allow images in page, footnotes, etc."
(2026-11-09)

## What it is

A note tied to a place in the text. On paper it's a small number in the line and the note at the
foot of the page. On a screen it's the number, and the note a tap away. Non-fiction needs them,
and some novelists write half the book in them.

Adding it follows "Adding a kind of node or mark" in the `bb-rich-text` skill, and the two export
writers are covered in `bb-export`. What's below is what's particular to footnotes.

## The node

An inline node in story text that carries its own note, the way a mention carries its label.

- **The note is a value `rich.ts` already understands.** Keep it as a value of the `description`
  kind (plain text, or inline formatting as JSON). Then `cleanValue`, `toHTML`, `plainText` and
  the exports' `descriptionLines` can already read it, and the box it's edited in is a
  `RichEditor` with `kind="description"`. Notes need italics for titles, and little else.
- **Numbers are never stored.** A note's number is its place among the notes of its chapter,
  counted wherever it's drawn. Move a paragraph and the numbers follow.
- **No notes inside notes, and no mentions inside them** in a first version. A description already
  turns a mention into plain words.
- **Write our own, as `mention.ts` is.** There's a community package, `tiptap-footnotes` (3.0.1,
  for Tiptap 3), but it keeps the notes as a list at the end of the document. Here that list
  would be read as paragraphs of the story by everything that reads `plainText` (word counts,
  goals, Insights, who's speaking), and it isn't pinned with our Tiptap packages.

## Where the note goes

| Where                   | The note                                                                                                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editor and focus mode   | A small box by the number to read and edit it. Mount it inside the editor, in the top layer, as the mention menu is: focus mode is a modal dialog, and everything outside it goes inert. |
| Reading mode, scrolling | Listed at the end of the chapter, with a link each way, and shown beside the number on a tap. The whole book is one page, so each link needs the chapter's key in it.                    |
| Reading mode, as a book | The same. Chapters are set in CSS columns, and browsers can't put a note at the foot of the column its number is in.                                                                     |
| Word                    | Real footnotes. `docx` has them (`FootnoteReferenceRun`, and `footnotes` on the `Document`), and Word places them.                                                                       |
| PDF                     | The foot of the page, set by our own typesetter. This is the hard part: see below.                                                                                                       |

## Traps in the code today

1. **The PDF can't raise a character.** A `Run` in `manuscript.ts` has a `scale` and nothing that
   lifts it off the line. The number needs that, and so do superscript and subscript in idea 24,
   so add it once.
2. **The PDF's page has one fixed foot.** `#room` in `pdf.ts` tests against the constant `FOOT`,
   and `#place` fills a page line by line, keeping two lines together at the top and bottom. With
   notes, the foot moves up on any page that has one, a line only fits if its note fits under it,
   and a long note may have to run on to the next page. A first version could set a chapter's
   notes at its end and say so under "left out". Don't promise notes at the foot until it works.
3. **`toHTML` knows nothing about where it is.** It's given one chapter's value and returns
   markup. Links between a number and its note need ids that are unique across the book, so it
   needs the chapter's key passed in.
4. **`plainText` decides what counts.** An inline node it doesn't know adds no words, which is
   right for the number. Decide about the note's own words: counted toward goals and word counts
   (the writer wrote them) but kept out of the paragraph they hang from, so Insights and the word
   maps don't read a note as narration. Whatever is decided, the comparison in version history
   reads `plainText` too, and an edit inside a note must show there.
5. **Descriptions can't hold one.** `cleanInline` has to drop it there, as it turns a mention into
   plain words.
6. **Pasting from Word.** Its footnotes arrive as links to anchors with the notes at the end. A
   first version takes them as plain text.
7. **Others that read the document.** Find and replace (idea 7) must look inside notes, and
   manuscript import (idea 3) should turn Word's footnotes into these.

## Leave out at first

Endnotes for the whole book, symbols in place of numbers (\*, †), and whatever of the PDF's
placing isn't finished.
