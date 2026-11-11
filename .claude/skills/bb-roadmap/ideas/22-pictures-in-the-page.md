# Idea 22: pictures in the page

**The record. Shipped 2026-11-10**, with the Insert menu (24a), on top of the art shelf (18). How
the node works day to day is in the `bb-rich-text` skill, the shelf's side in `bb-art`, and the
files' side in `bb-export`. This file is why it's built the way it is, and what was left out.

## What the user asked for

"I want the editor to be more sophisticated and allow images in page, footnotes, etc."
(2026-11-09), then "I want you to work on 22 and 24a" (2026-11-10). Asked the open questions,
the user chose, on 2026-11-10:

- **Exports stream from the server**, rather than being made in the browser.
- **Deleting a picture that's set in the text warns, then deletes.** The dialog names the
  chapters. Readers see nothing where it was, and the editor shows a "taken off your art shelf"
  box with Take it out.
- **"/" opens the Insert list**, only on an empty line; Esc or typing on closes it.
- **Captions count toward word counts and goals**, like footnotes. Insights, word maps, names and
  casts read the story alone.

## What it is

A picture from the writer's art shelf, a block between the story's top-level blocks:
`{"type":"picture","attrs":{"art":12,"width":1800,"height":1200,"size":"wide","alt":"…",
"decorative":false,"caption":"…"}}`.

- **Sizes:** wide (the measure), small (60%, centred) and a page to itself (the book view and
  both files give it a page; scrolling, it's a wide picture with more space round it).
- **A description** (`alt`), filled from the shelf's description when it's put in, and "Only
  decoration", which empties the alt so a screen reader passes over it. The editor tags a picture
  with neither: "No description yet".
- **A caption**, a description value: italic, with its own small toolbar in the box.
- **Only between top-level blocks.** Never in a quote, a list, a note or a description. The editor's
  schema says so (`group: 'figure'`, the story document's content is `(block | figure)+`) and the
  cleaner agrees (`depth === 0`, `kind === 'story'`).

## Where a picture comes from

The plan's first rule held: **the document holds an id, never an address.** A page is told where
the files are by the server, looked up on the author's own shelf (`picturesFor`), and
`pictureHTML` checks each address is our own stand-in's or https before writing it. So a document
can't make a reader's browser load anything from another site, and an id that's someone else's
picture shows nothing. The owner's own pages use their shelf in the browser (`artStore`, or
`shelfSources` in version history). `rich.ts` still imports nothing from the app beyond
`$lib/bible` and now `$lib/art` (which imports nothing), so it stays testable on its own.

- **On save** (`ownedPictures`, in the save's transaction): another writer's picture is taken out,
  and the writer's own takes its width and height from the file. One that's been deleted stays,
  so the editor can show where it was.
- **For readers** (`readableBook`): a picture that isn't on the author's shelf any more is taken out
  of the text, caption and all, before the page gets it.
- **What it costs.** Readers' browsers load the files straight from Blob, the small copy or the
  whole picture by how wide it's drawn (`srcset`), so reading adds no work to our server. Loading
  a book to read runs one more query, and only when its text has pictures; so does a save. The
  delete dialog runs one query over the writer's story text when it opens. Exports read every
  picture's file on the server, four at a time, only when a writer asks for one.

## Each surface

- **The editor** (`rich/picture.ts`, `PictureBox.svelte`): click a picture and its settings open
  beside it without taking focus from the text; Enter goes into its caption; Esc or Done puts them
  away with the caret just after it; typing with it selected starts a paragraph after it;
  Backspace and Delete take it out. Change picture keeps its size and caption. Files dropped or
  pasted go up to the shelf and in; a picture pasted from another page doesn't come in, and a
  notice says why.
- **Focus mode**: the same editor, with the box, the shelf and the lists in the top layer over it.
- **Reading mode, scrolling**: `toHTML` with the server's `pictures`. Its box has its shape before
  the file arrives (`--ratio`, and `width`/`height` on the `img`), and it sits on paper, so black
  line art reads at night.
- **Reading mode, the book view**: a picture is never split across pages and never taller than one
  (`--picture-most`, set from the page height, less room for a caption). A page-to-itself picture
  is a column of its own, in the middle of it (`break-before`/`break-after: column`). A chapter
  with footnotes is cut into pages by the app, so `flowLines` reads a figure as one block and
  marks a page picture `alone`, which `sliceFlow` gives a page.
- **Share links**: as reading mode, signed out.
- **Version history**: "As it reads" draws the version's pictures from the shelf; the comparison
  reads each picture as a `[Picture: caption]` line, so one added, moved or taken out shows.
- **PDF**: wide or small on the measure, at most 0.72 of the text block high with its caption; a
  page picture on a page of its own, in the middle. A heading or a scene break before a picture
  keeps room for the whole of it.
- **Word**: an `ImageRun` in a `Picture` style, the caption in Word's own `Caption` style, alt text
  from the description. A page picture has a page break before it and before what follows.

## Things that tripped it up

1. **A chapter holding only a picture counted as empty** (trap 1 in the plan). `rich.ts` now has
   one answer, `hasContent`, used by both reading views and the export, and `isEmpty` counts a
   picture.
2. **An empty paragraph is a blank line to readers** (`<p><br></p>`). Putting one after each
   picture, so the caret had somewhere to go, left gaps on the page. No paragraph comes with a
   picture now: where no text follows, the caret is ProseMirror's gap cursor between blocks, and
   typing there starts a paragraph. Its default look is a black line that night hides, so
   `RichEditor` draws it in the caret's colour.
3. **Esc went to the wrong thing, four ways.** The editor's own Esc (blur, and close focus mode)
   ran before the @ and / lists' Esc, because Tiptap runs a later-listed extension's keys first
   at equal priority: `EscapeKey` now has priority 50. Esc in the picture box's buttons did
   nothing: the box listens for it on the panel. Esc with a picture selected blurred the editor:
   the node has its own Escape, which puts the box away and keeps the caret. And Esc with a
   toolbar menu open (Insert, the colours) reached the editor, because a toolbar menu keeps the
   caret in the text, so it closed focus mode: `EscapeKey` now closes an open `[data-menu]` and
   does nothing else. Test Esc from every place it can be pressed.
4. **A deleted picture's caption reached readers.** It drew nothing, but its words were in the
   page's data. `readableBook` takes the whole node out.
5. **The PDF left a heading or a scene break at the foot of a page** with its picture overleaf, and
   once a scene break alone on a page. `#keepWith` makes room for the picture that follows.
6. **Word's contents went one page out.** Word lets go of a keep with next before a page break;
   `docx`'s page-number estimate doesn't. The block before a page picture says `keepNext: false`.
   Only opening the file in real Word (`word-check.ps1`) showed it.
7. **Version history's "As it reads" drew no pictures**: it had no sources. `shelfSources`.
8. **The caption box showed no placeholder until clicked**: an empty value had no paragraph to put
   it in. `RichEditor`'s `contentOf` opens an empty value as one empty paragraph.
9. **Svelte trims spaces at the edge of a tag**, so "Picture · Upload" lost its spaces. `&nbsp;`
   holds them (the linter refuses `{' · '}`).
10. **Testing on a phone width**: a script that taps and types in the same instant types before
    ProseMirror has read where the tap put the caret. Pause about 200 ms after a tap.

## Checked, 2026-11-10

On the throwaway database and the stand-in store: the Insert menu and "/" (opening, closing,
arrowing, Esc, mid-line), choosing and uploading from the shelf picker, the box (sizes, caption
with italic, description, decoration), the gap cursor and typing there, undo, save and reload;
both reading views at 1440 in the dark, a share link signed out on a phone in the light, focus
mode at 1440 in the light, the editor at 390 in both themes (no sideways scroll, no console
errors); version history; hostile saves through the real API (an address and a script added to a
picture's attributes, another writer's id, a missing one, a wrong width and height, a size that
isn't one, a picture inside a quote); the PDF on a contact sheet and the Word file in real Word, with
contents matching; and deleting a picture set in two chapters.

## Left out

- Text wrapping round a picture, and pictures side by side. (The PDF's line breaker could wrap one
  day: `#lines` already takes a width for each line.)
- Cropping, or editing a picture in place. Drawing over one is the studio's (25d).
- Pictures inside quotes, lists, footnotes' notes and descriptions.
- Word's "decorative" mark: a decorative picture has empty alt text instead, which `docx` can't
  mark as decorative.
- A page-to-itself picture centred on its page in Word: it sits half an inch below the top margin.
  The PDF centres it.
- Version history's word tallies count the word "Picture" from a picture's line.
- Old versions keep a picture's id after it's deleted from the shelf; they show nothing there.
- A picture's own share-link preview (an `og:image`), with the cover's, is on 18's row.
