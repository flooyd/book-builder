# Idea 22: pictures in the page

**A plan, written 2026-11-09. Nothing here is built.** It needs the uploads in idea 18 first. The
traps below were found by reading the code that day, so check they still hold.

## What the user asked for

"I want the editor to be more sophisticated and allow images in page, footnotes, etc."
(2026-11-09)

## What it is

A picture set in story text, with a caption if the writer wants one: as wide as the text, smaller
and centred, or with a page to itself (a map, a plate). It has to show in the editor and focus
mode, both views of reading mode, share links, version history, the PDF and the Word file. A
picture that only the editor can show isn't finished.

Adding it follows "Adding a kind of node or mark" in the `bb-rich-text` skill, and the two export
writers are covered in `bb-export`. What's below is what's particular to pictures.

## The node

A block of its own, written like `mention.ts` is: the document holds the picture's id on the art
shelf, its width and height, how big to set it, a description for screen readers, and the
caption.

- **Nothing from anywhere else.** The cleaner must only keep a picture that points into our own
  store, and `toHTML` must build the address itself from what the node holds. A document that
  could name any address would let a shared book load things from any site, and tell that site
  about every reader.
- **Ownership on save.** Drop a picture that isn't the writer's, the way `ownedMentions` drops
  links to entries they don't own.
- **Keep `rich.ts` free of the app.** It imports nothing but `$lib/bible`, which is why it can be
  tested on its own and run on the server and in the browser. Hand it the store's address; don't
  import `$env` into it.
- **`@tiptap/extension-image` exists at 3.32.0** (MIT), but it keeps a `src`. Our own node fits
  the rule above better. `@tiptap/extension-file-handler` (MIT, also at 3.32.0) takes files that
  are dropped or pasted. Pin whatever is added with the rest.

## Traps in the code today

1. **A chapter that's only a picture counts as empty, and is thrown away.** `isEmpty` in `rich.ts`
   looks for words or a scene break, so `serialize` and `cleanValue` store `''`. (A scratch test
   on 2026-11-09 showed it.) The same question is asked three more times with
   `plainText(text).trim()`: in `reader/Reader.svelte`, in `reader/BookView.svelte` and in
   `hasStoryText` in the export. Give `rich.ts` one answer to "is there anything here?" and use it
   in all four.
2. **Anything unknown vanishes without a word.** `cleanBlocks` drops a node it doesn't know, and
   so do `#blocks` in `pdf.ts` and `Blocks.of` in `word.ts`. Miss one and the picture is simply
   not there, with no error to find.
3. **An exported file can outgrow what a function may send.** Vercel caps a function's response at
   4.5 MB unless it's streamed, and `exportResponse` sends the whole file at once. How close a
   long book of text already comes hasn't been measured. Pictures will pass it. Either stream the
   file, or make the file in the browser (PDFKit and `docx` both run there, and it would take the
   work off the server altogether, though `fonts.ts` would have to load its typefaces another way
   and the browser would fetch them at export time). Streaming is the small change. Settle it
   with the user when this starts.
4. **The book view counts pages by measuring.** Each chapter is set in CSS columns one page wide,
   in a hidden copy, and the number of columns is the number of pages (`book-layout.ts`). A
   picture that takes up no room until it loads changes that count afterwards and moves every
   reading position. So the box must be kept from the start (that's what the stored width and
   height are for), a picture must never break across columns or be taller than a page, and a
   picture with a page to itself starts and ends a column.
5. **Line art disappears at night.** Black ink on a clear ground, over navy. Set every picture on
   paper, the way a page of the book is (`data-scheme="light"`).
6. **Pasting.** `cleanPastedHTML` keeps the structure of what's pasted. A picture pasted from
   another site must not stay as a link to that site. Take a pasted or dropped file through the
   upload, and drop a pasted address with a sentence saying why.
7. **Words.** Decide whether a caption counts toward word counts and goals, and whether Insights
   and the word maps read it. `plainText` is what they all read.
8. **Version history compares words.** Adding or removing a picture would show as no change. And
   a version may point at a picture that has since been deleted (see idea 18).
9. **A description for screen readers** on every picture, asked for when it's added, with a way to
   say it's only decoration.

## In the exported files

- **PDF.** A branch in `#blocks`: make room with `ensure`, draw with PDFKit's `image` (JPEG or PNG,
  which is all idea 18 stores), and set the caption with `#setBlock`. Fetch every picture's bytes
  before setting starts, a few at a time. The export has 60 seconds (`maxDuration` in its routes).
- **Word.** An `ImageRun` with its size, and a caption style beside the others. Then open it in
  Word (`word-check.ps1` in `bb-verify`): the contents' page numbers come from an estimate that
  has never seen a picture.

## Leave out at first

Text that wraps round a picture, pictures side by side, and editing a picture in place. (The
PDF's line breaker could do wrapping one day: `#lines` already takes a different width for each
line, which is how a first letter sits beside its lines.)
