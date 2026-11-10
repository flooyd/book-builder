# Idea 26: book design

**A plan, written 2026-11-09. Nothing here is built.** These two pieces were the first and second
parts of idea 25 until the user said what the art studio should be (a full paint and vector
editor), the same day. They're about how a book looks rather than making art, so they became an
idea of their own. The user can ask for one by letter ("26a").

## a. A cover designer

**Today.** A book's cover is generated: `coverVariant(id)` in `lib/cover.ts` picks navy or paper
from the book's id, and the title and author are set on it. The writer has no say. It's drawn in
three places that have to agree: `ui/BookCover.svelte` in CSS, the cover face in
`reader/BookView.svelte`, and `cover()` in `server/export/pdf.ts`. The Word file has no cover.

**The idea.** The writer designs the cover: a layout from a handful, the colours, the typeface for
the title, an emblem or ornament, whether the author's name shows and where, and a picture behind
it all, from the art shelf or made in the art studio (idea 25), with a tint so the title stays
readable.

- **A cover is a design, not a file.** Keep it as a small object on the book (the layout's name,
  colours, face, ornament, the picture's id), cleaned on the server against an allow-list the way
  a document is. Without a picture it needs no storage at all, weighs nothing and stays sharp at
  any size, so that much can ship before idea 18.
- **The title is set here, over the art.** That keeps it sharp at every size, set in the book's
  own typefaces, and right when the title changes. The studio makes the art; the designer puts the
  words on it.
- **Three drawers, one vocabulary.** Whatever the designer offers, CSS has to draw it in two
  components and PDFKit in a third, and the PDF sets the title with its own line breaking
  (`#coverLines` shrinks it until it fits in five lines). So keep the choices few and exact, and
  put the rules in `lib/cover.ts`, which the browser and the server already share.
- **A picture on a cover** needs an answer for the cover's different shapes: it's roughly 3 by 4
  on the page and 2 by 3 in the PDF, so a picture needs a point to stay centred on.
- **Where it goes.** On the book page, by the cover, with the live cover beside the controls. The
  book's aside already holds its headings and its goal.

## b. Ornaments

**Today.** A scene break is drawn as a diamond between two rules, three separate times: in
`prose.css` (`.bb-prose hr`), in `ornament()` in `pdf.ts`, and as `* * *` in `word.ts`. The same
ornament sits under a part's title and on the title page of the PDF.

**The idea.** A set of ornaments to choose from for a book (a diamond, an asterism, a fleuron,
stars, three dots), used for its scene breaks and under its part and chapter headings.

- **One list of shapes, as SVG path data**, in a module the browser and the server share. CSS can
  draw a path as a mask, and PDFKit draws SVG paths itself (`doc.path`). Word keeps `* * *`.
- **Chosen for the whole book**, beside the heading styles (`book/BookHeadings.svelte`,
  `lib/headings.ts`), not scene break by scene break.
- **An ornament of the writer's own,** drawn in the art studio on its vector layers, can stay
  vector: its paths go through the studio's cleaner (idea 25) and are drawn the same way as the
  built-in ones, so it's sharp in the PDF too.

## Later, perhaps

How a whole book is set: its typefaces, its spacing, its page size in the PDF. Idea 24 left
per-paragraph spacing out on purpose, because `prose.css` is the one definition of how a book's
text looks; a book-wide choice of design is the right place for it.
