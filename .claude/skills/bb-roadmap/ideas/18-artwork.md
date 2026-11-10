# Idea 18: artwork (uploads and the art shelf)

**A plan, written 2026-11-09. Nothing here is built.** Check it against the code before leaning on
it, and take the questions under "Still to ask" to the user before starting.

## What the user asked for

"I want the user to be able to upload or create custom art for their book." (2026-11-09)

This idea is the upload half, and the ground the rest stands on: somewhere for a writer's
pictures to live. Pictures inside story text are idea 22, and making art in the app is the art
studio, idea 25, which saves what's made here. Until that day this idea was called Images
(portraits for characters, maps for places, uploaded covers), and those are still its first uses.

## What it is

- **Storage.** The app's first files. Everything so far is text in Postgres.
- **The art shelf.** One page per writer: what they've uploaded, where each picture is used, and
  how much room is left. A picture is chosen from the shelf wherever one is wanted, so a map can
  sit in a chapter and on a place's page without being uploaded twice.
- **First uses.** A cover of the writer's own on a book. A portrait on a character, and a picture
  or map on a place or system, wherever `Monogram` stands in today.

## Decided: Vercel Blob

The user chose Vercel Blob on 2026-11-09 and will put the key in `.env` later. Cloudflare R2 was
the other choice weighed (10 GB free and no charge for views, but a second account). Don't build
anything that only works with a key: the stand-in under "Running it here" is how it's built and
tested until the key arrives, and a production deploy that has no key must say uploads aren't
available yet rather than fail.

**What Blob allows** (from Vercel's pages, updated 2026-09; read them again before relying on
it). Hobby, each month: 1 GB stored, 2,000 advanced operations (an upload, a copy or a listing),
10,000 views that miss its cache, 10 GB sent. Past that the store stops answering until 30 days
have passed, so every picture in every book goes blank. Pro is about $0.023 a GB stored and $0.05
a GB sent. What follows from that:

- **Never list the store** in the app's normal work. A listing is an advanced operation, and so
  is browsing the store in Vercel's dashboard. The `art` table is the index.
- **Count uploads.** A picture is one upload, two with its small copy. At about 300 KB a picture,
  1 GB is some 3,000 pictures across all writers, and 2,000 uploads a month is 1,000 pictures.
- **The art studio uploads only when the writer saves**, never as they work (see idea 25).

**Setting up the store** (the user does this, in the Vercel dashboard under Storage):

- **Access: Public is the one to choose.** Each picture sits at an address with a random part
  nobody could guess, the way a share link does, and a reader's browser fetches it straight from
  Vercel's CDN. A private store sends every view of every picture through one of our functions:
  server work the user wants to avoid, billed twice. The user creates the store, so check which
  they chose before building; a private one changes how every picture is served.
- **Tick "Add a read-write token env var to this connection".** Browser uploads go through
  `handleUpload`, which needs the long-lived `BLOB_READ_WRITE_TOKEN`; the short-lived OIDC
  credentials Vercel sets up by default aren't enough for it. Connecting the store to the project
  puts the token in production and preview; `.env` is only for running it here.
- **Add `BLOB_READ_WRITE_TOKEN` to `.env.example`** with a line on what it's for, in the commit
  that first reads it.
- **The package** is `@vercel/blob` (Apache-2.0; 2.9.0 was published on 2026-11-09). Pin a version
  that's been out a couple of weeks. `upload` runs in the browser, `handleUpload`, `head` and
  `del` on the server.

## Still to ask

1. **How much each writer gets.** A cap by size (a running total of bytes), shown on the shelf,
   counting studio drawings too. Without one, a single account can use the whole allowance. With
   1 GB shared on Hobby it has to be small; ask which plan the site is on, and suggest a number.
2. **Reporting a picture.** A free app that hosts pictures gets used to host pictures. Confirmed
   email is already required and the cap bounds the rest. Ask whether public pages want a way to
   report one.

## How it should work

- **The browser does the work.** Before a picture is sent, the browser draws it to a canvas,
  scales it to a longest side, and saves it again as JPEG (photographs, paintings) or PNG (line
  art, anything with a clear ground). The reasons:
  - The user wants work kept off the server.
  - A Vercel function can't take a request over 4.5 MB, so a file can't pass through one anyway.
    It goes from the browser straight to storage, with a short-lived token from a small endpoint.
  - PDFKit draws JPEG and PNG and nothing else, and `docx` takes both. If those are the only two
    kinds stored, an export never has to convert a picture, and the server never needs `sharp`.
  - Drawing it again drops what a camera writes into a photograph, such as where it was taken.
  - A second, small copy for cards and lists is made the same way, so no image service is needed.
- **Sizes worth keeping.** The PDF's text block is 312 pt wide (`MEASURE` in `pdf.ts`), which is
  4.33 inches, so 1,300 pixels across is 300 to the inch for a picture in the text. A whole 6 × 9
  inch page is 1,800 × 2,700.
- **An `art` table.** One row a picture: its owner (cascading from the user), where it is in
  storage, width, height, bytes, kind, a description for screen readers, and when. Width and
  height let every page keep the right space for a picture before it loads, which the book view
  depends on (see idea 22). Bytes add up to the cap.
- **Pointed at by id.** `book.cover_art_id`, a portrait column on each kind of entry: nullable,
  and set to null when the picture goes. Never an address somebody typed or pasted.
- **Never trust the browser.** The token endpoint checks `requireUser`, the cap, the kind and the
  size (`allowedContentTypes` and `maximumSizeInBytes`, if it's Blob). After the upload the browser
  tells the server, and the server asks storage what really arrived (`head()`) before writing the
  row. Don't lean on Blob's `onUploadCompleted`: it's a call from Vercel to the site, and it can't
  reach localhost.
- **Deleting has to reach storage by hand.** Postgres cascades stop at the database. Taking a
  picture off the shelf, and above all deleting an account (`DELETE /api/account`, which calls
  Better Auth's `deleteUser`, where today everything simply cascades from the user row), must
  delete the files first, while the rows that say where they are still exist.
- **A picture that's gone.** An older version of a chapter may still point at it. The shelf says
  where a picture is used before it's deleted, and anything pointing at a missing one draws a
  quiet placeholder, never a broken image.
- **No uploaded SVG.** An SVG can carry script. Photographs and drawings as JPEG or PNG only. The
  art studio's vector drawings are kept as its own cleaned format, not as SVG files (see idea 25).
- **Room for the studio.** A drawing made in the studio is a picture on the shelf like any other,
  plus what's needed to open it again: its vector layers as JSON in Postgres, and each paint layer
  as a PNG in the store. Plan the `art` table so a row can say it came from the studio and point
  at that.

## Running it here

- **No test pictures in the real store**, for the same reason no test data goes to Neon (see the
  `bb-database` skill). The throwaway-database loop in `bb-verify` has no storage at all.
- So build storage behind one small module (say `lib/server/art-store.ts`: a token or a put, a
  head, a delete) with a stand-in that keeps files in a scratch folder when no storage key is
  set, the way email prints to the terminal without `RESEND_API_KEY`.
- **Once the key is in `.env`**, the dev server would upload to the real store. Start it for
  testing with `BLOB_READ_WRITE_TOKEN=""`, as `bb-verify` already does with `RESEND_API_KEY`, and
  add that to its dev-server command when this ships.
- It adds a server package, so run a production build and read the log (see "Adding a package" in
  the `bb-stack` skill).

## What it touches

- **Covers.** A cover is drawn in three places today, and all three must learn to show a picture:
  `ui/BookCover.svelte`, the cover face in `reader/BookView.svelte` (`.cover-face`), and `cover()`
  in `server/export/pdf.ts`. `lib/cover.ts` says "books have no image field". `BookCover` is used
  on the dashboard, the book page, series pages, the author page, the public series page and the
  reader. Its small size shows initials only.
- **Public pages.** `readableBook` and the author and series loaders decide what a visitor gets,
  so a cover's address has to come through them.
- **Portraits.** `Monogram` is used in the story bible, the connections panel, the book aside,
  insights and word maps.
- **The database.** A migration for the table and the columns (see the `bb-database` skill).
- **Account deletion** and the dialog that says what goes (`profile/DeleteAccount.svelte`).

## Leave out at first

Cropping and other editing (the art studio can open an uploaded picture to paint on, later),
more than one picture on an entry, an author photograph, and private files.

## When it ships

Give it a skill of its own (where files live, the cap, how to run it locally, how to delete), and
turn this file into the record of what was built.
