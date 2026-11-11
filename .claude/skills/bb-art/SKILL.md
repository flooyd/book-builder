---
name: bb-art
description: How Book Builder's art shelf works (idea 18), covering where pictures are stored (Vercel Blob, a public store, or a folder on this computer while developing), the two-step upload that never passes a picture through the server, the art and art_upload tables, the per-writer room, deleting files (a picture, an account) and the warning when a picture is set in story text, covers from the shelf on every page and in the PDF, pictures set in story text (idea 22) and how pages find their files, saving a studio drawing to the shelf, and how to run and test it locally without touching the real store. Use this whenever a task touches pictures, uploads, the art shelf, /art, covers, BookCover's picture, Vercel Blob, BLOB_READ_WRITE_TOKEN, storage or files, or adds a new use for a picture (portraits, maps, pictures in the text).
---

# Book Builder: the art shelf

A writer's pictures, kept online with their account: uploaded, or saved from the art studio. The
first use was a book's cover, and pictures in the story text (idea 22) came next. Portraits and
maps come after and should reuse all of this. The plan and what was left out are in
`bb-roadmap`'s `ideas/18-artwork.md` (and `ideas/22-pictures-in-the-page.md` for the text).

## Where the code is

| Piece   | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rules   | `lib/art.ts`: types (`ArtPicture`, `CoverArt`, `PictureUse`), `ROOM_BYTES`, sizes, `ART_TYPES`, `looksLike` (a file's first bytes), `coverFrom`, `shelfSources` (the shelf as `toHTML`'s `pictures`), `formatBytes`. Imports nothing.                                                                                                                                                                                                                                                            |
| Browser | `lib/art-upload.ts` (`prepare`, `prepareFile`, `savePicture`), `lib/art-shelf.ts` (store updates: `uploadFile`, `savePrepared`, `deletePicture`, `setCover`, `refreshShelf`, and `picturePlaces` for the delete dialog).                                                                                                                                                                                                                                                                         |
| Server  | `lib/server/art-store.ts` (storage: `uploadTarget`, `inspect`, `remove`, `readPicture`, the stand-in), `lib/server/art.ts` (`startUpload`, `finishUpload`, `deleteArt`, `removeAllArt`, `coversFor`, and for story text `picturesFor`, `ownedPictures`, `pictureUses`).                                                                                                                                                                                                                          |
| API     | `POST /api/art/upload` (start), `GET`/`POST /api/art` (list, finish), `PUT`/`DELETE /api/art/[id]`, `GET /api/art/[id]/uses`, `PUT /api/book/[id]/cover`, and the stand-in's `/api/art/local/[...path]`.                                                                                                                                                                                                                                                                                         |
| Screens | `routes/art` with `components/art/ArtShelf.svelte`; `CoverPicker` (the book page's "Change the cover"), `UseAsCover` (a picture onto books), `UploadButton`, `RoomMeter`; "Save to shelf" in the studio's `StudioBar`; a card's "Draw over it in the studio", and the studio's `ShelfPicker`, which copy a picture into a drawing (see `bb-studio`). The editor's pictures (`rich/picture.ts`, `PictureBox`), which choose through the same `ShelfPicker` with `upload` on (see `bb-rich-text`). |
| Data    | Tables `art` and `art_upload`, and `book.cover_art_id` (migration `0016_art.sql`). `artStore` and `artUploadsOpen` in `$lib/stores`, loaded with the library from `/api/art`.                                                                                                                                                                                                                                                                                                                    |

## Storage

- **Vercel Blob, a public store**, when `BLOB_READ_WRITE_TOKEN` is set. Each picture sits at an
  unguessable path (`art/<24 random characters>.png`, and `-small` for its copy) and readers load
  it straight from Vercel's CDN, with no work on our server.
- **A folder on this computer** when there's no token and the dev server is running (`dev` from
  `$app/environment`): `ART_STORE_DIR`, or `book-builder-art` in the system's temp folder. The
  `/api/art/local` route serves it and takes uploads, checking what Blob's token would.
- **Nothing** on a deployed site without a token: `/api/art` says `uploads: false`, the upload
  buttons hide, and the shelf says uploads aren't available yet.
- **Never list the store.** A listing costs what an upload costs on Blob's Hobby plan (2,000 a
  month). The `art` table is the index. Hobby also allows 1 GB stored in all.

## Uploading: two calls, and the picture never passes through

1. **The browser makes the files** (`prepare`): draws the picture on a canvas at most `LONG_SIDE`
   (2700) a side, saves a JPEG or a PNG, and a small copy at most `SMALL_SIDE` (640). Anything
   see-through stays a PNG; flat colour (the studio, an uploaded PNG) is a PNG unless a JPEG is
   less than half its size; photographs are JPEGs. Re-drawing drops a camera's metadata. Only
   JPEG and PNG are ever stored, because those are what PDFKit draws. No SVG: it can carry script.
   A chosen file with no type is tried anyway (`prepareFile`), since some Android pickers give
   none even for a photograph; one that isn't a picture fails when it's opened.
2. **`POST /api/art/upload`** with each file's type and exact size: the server checks the room
   (under a Postgres advisory lock per writer, so two uploads can't both squeeze in), allows four
   under way at once, records an `art_upload` row holding those bytes, and hands back a Blob client
   token per file that allows that one path, that type, that many bytes, for 15 minutes.
3. **The browser sends each file** straight to Blob with `put` from `@vercel/blob/client`,
   imported only then (it's a 100 KB chunk), or PUTs it to the stand-in.
4. **`POST /api/art`** finishes: the server asks storage what arrived (`head()`), checks the type
   and bytes, then writes the `art` row and drops the `art_upload` one. Blob's `onUploadCompleted`
   isn't used, because it's a call from Vercel that can't reach localhost.

An upload never finished is cleared, files and all, the next time that writer starts one, once
it's 20 minutes old. **Compare those ages in Postgres** (`now() - make_interval(...)`): the
columns are timestamps without a time zone, and against JavaScript's clock they're off by the
database's zone. This bit on the throwaway database, which runs on America/Chicago.

## Replacing, deleting

- **A studio drawing saved again replaces its picture** (`replaces`, found by `draft_key`), so the
  id stays and every cover it's on shows the new one. The old files go after the row is updated.
- **Deleting goes to storage by hand**, files first, while the row still says where they are
  (`deleteArt`). `book.cover_art_id` goes to null with the row, and the cover is drawn again.
- **A picture set in story text** is deleted all the same, after a warning: the shelf's delete
  dialog asks `GET /api/art/[id]/uses` (`pictureUses`, a `like` on the stored text, then each
  match parsed to be sure) and lists each chapter and part, linked, with its book. Delete waits
  until that answer is in. Nothing rewrites the text: readers see nothing where it was
  (`readableBook` takes it out), and the editor shows a box saying it's gone, with Take it out.
- **Deleting an account**: Better Auth's `beforeDelete` hook (in `lib/server/auth.ts`) calls
  `removeAllArt` after the password is checked and before the user row cascades. If the files
  can't be deleted, nor is the account, so nothing is left behind in the store.

## Covers

- **`BookCover`** takes `art` (a `CoverArt`) and shows its small copy, cut to the cover's shape
  with the spine's shadow over it. If the file fails to load, it draws the cover from the title.
- **Owner's pages** find a book's picture with `coverFrom($artStore, book.coverArtId)`. Book rows
  carry only the id: five places replace a whole book row with a server reply, so anything else
  on it would be lost.
- **Public pages** get a `cover` from the server: `readableBook` (reading mode, share links, the
  export), `publicAuthor` and `publicSeries`, through `coversFor`. Nothing else about the shelf
  reaches them.
- **The book view** (`BookView`'s `.cover-face.pictured`) uses the full picture, and takes the
  rounded corners on the image itself: the face turns in 3D, so it mustn't get `overflow`.
- **The PDF** (`cover()` in `export/pdf.ts`) reads the picture with `readPicture`, checks its first
  bytes, and fills the page with it (`cover: [WIDTH, HEIGHT]`). Anything PDFKit can't read falls
  back to the drawn cover. The Word file has no cover, picture or not.
- **Setting a cover** (`PUT /api/book/[id]/cover`) keeps `updatedAt` as it was, like sharing.

## Pictures in the text

How the node works is in the `bb-rich-text` skill, and how the files set them in `bb-export`. What
touches the shelf:

- **The text holds an id, never an address.** Pages are told where the files are by the server:
  `picturesFor(authorId, texts)` looks the ids up **on the author's own shelf only**, so an id
  that's someone else's picture shows nothing. `readableBook` returns them as `pictures`, beside
  `cover`. The owner's own pages use `artStore` (the editor) or `shelfSources($artStore)`
  (version history).
- **On save**, `ownedPictures` takes out another writer's picture and refreshes the width and
  height of the writer's own from the `art` row. It runs inside the save's transaction, after
  `ownedMentions`.
- **Readers' browsers load the files straight from Blob**, choosing the small copy or the whole
  picture by how wide it's drawn (`srcset`), so pictures in the text add no work to our server
  when a book is read. The export reads them on the server (`pictureFiles`, through `readPicture`).
- **Uploading from the text**: files dropped or pasted into the editor, and the shelf picker's
  Upload button, go through the same `uploadFile` and count against the same room.

## The room

`ROOM_BYTES` in `lib/art.ts`, both files of every picture together, plus uploads under way:
**50 MB**, the user's choice at launch (2026-11-10), knowing Blob's Hobby plan holds 1 GB across
everyone. Changing it is theirs to decide. `RoomMeter` shows it on the shelf and in the cover
picker.

## Running and testing it here

- **Start the dev server with `BLOB_READ_WRITE_TOKEN=""`** (and `ART_STORE_DIR` in the scratch
  folder): `.env` has the real key, and no test picture may go to the real store, for the same
  reason no test data goes to Neon. See `bb-verify`.
- **Checked on 2026-11-10**, on the stand-in: saving a studio drawing, putting it on a cover and
  saving it again in place; uploading from the cover picker; the shelf, the dashboard, the book
  page, both reading views, a share link and the author page signed out, and the PDF; deleting a
  picture (its cover drawn again, its files gone); the room full (413), a fifth upload under way
  (429), abandoned uploads cleared; deleting an account (its files gone, a wrong password leaving
  them); and hostile requests (SVG, sizes, another writer's picture, wrong bytes for the type, a
  path not handed out, paths climbing out of the folder). 1440 and 390, both themes.
- **Pictures in the text, checked the same day**: putting one in from the shelf, sizes, captions
  and descriptions; both reading views, a share link signed out, version history, focus mode and
  a phone; the PDF and the Word file (opened in Word); saving with another writer's id, a
  missing one or a wrong size; deleting a picture set in two chapters (the dialog listed both, readers saw
  nothing, the editor's Take it out and its undo worked).
- **Test each button that uploads, not just one.** The shelf's own "Upload a picture" did nothing
  until 2026-11-10 while the cover picker's worked: `UploadButton` called
  `onuploaded?.(await uploadFile(file))`, and with no `onuploaded` (the shelf passes none) `?.`
  skips its argument, upload and all. Pick the file with a tap and `page.waitForFileChooser()` at
  390 with touch, as a phone does; a photo the size a camera takes (4032 × 3024) is worth one run.
- **Not checked against the real store**: the Blob calls themselves (`put`, `head`, `del`, client
  tokens) only run with the key. Try one upload on a preview deployment before relying on it.
- **The studio fetches shelf pictures from the browser** (`fetchPicture` in
  `lib/studio/pictures.ts`), to copy one into a drawing. On the stand-in that's the same site; on
  Blob it's another, and works because a public store's files answer with
  `access-control-allow-origin: *` (a plain `fetch`, no headers, so no preflight). That was read
  from Vercel's community answers, not seen: the Neon query that would have found a real file's
  address was refused, so try putting a shelf picture in a drawing on a preview deployment too.
- After adding to the server side, run a production build (see `bb-stack`). `@vercel/blob` 2.8.2
  is pinned; its `@vercel/oidc` brings an older `jose` that stays nested under it.
