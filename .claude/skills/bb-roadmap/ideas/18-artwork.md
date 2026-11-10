# Idea 18: artwork (uploads and the art shelf)

**Covers were built on 2026-11-10; portraits and maps are still to come.** How it works now is the
`bb-art` skill. This file is the record of what was asked, what was decided, and what's left.

## What the user asked for

"I want the user to be able to upload or create custom art for their book." (2026-11-09)

Then, the day the studio shipped: "shouldn't there be a way to assign an image to a book or to a
page? For example, I created cover art, how can I apply it to a book" (2026-11-10).

## What was decided

- **Vercel Blob** (2026-11-09), over Cloudflare R2 (10 GB free and no charge for views, but a
  second account). The key went into `.env` on 2026-11-10.
- **A public store** (2026-11-10). A private one would send every view of every picture through
  one of our functions: server work the user wants to avoid, billed twice.
- **Covers first** (2026-11-10): save a studio drawing or upload a picture, then set it as a
  book's cover. Portraits and maps after, then pictures in chapters (22).
- **No reporting yet** (2026-11-10). A confirmed email and the room limit misuse.
- **The room per writer is 50 MB** (2026-11-10), chosen at launch from 25, 50 and 100: one
  setting, `ROOM_BYTES`. Blob's Hobby plan holds 1 GB across everyone.
- **Migration 0016 ran on Neon** on 2026-11-10, before the push.

## What was built

- **The art shelf** at `/art`, linked from the studio's page: every picture with its size, where
  it came from and which books it's the cover of, with "Use as a cover", name and description,
  delete, and "open the drawing" for one saved from the studio in this browser. A room meter.
- **Uploading** from the shelf or the cover picker. The browser makes a JPEG or PNG at most 2700
  a side and a small copy, and sends both straight to storage; the server hands out the places
  and checks what arrived.
- **Save to shelf** in the studio's bar, which replaces the earlier copy when a drawing is saved
  again, so its covers follow. Then "Use it as a book's cover…".
- **Covers** on the dashboard, the book page ("Change the cover"), series pages, the author page,
  the public series page, reading mode's title page and the book view's cover, share links, and
  the PDF's first page. A missing file draws the old cover instead of a broken image.
- **Deleting** a picture deletes its files first; deleting an account deletes all its files
  before the account goes, and the account deletion dialog counts the pictures.
- **Running here** without the key: a folder on this computer stands in for the store.

## How the server's part stays small

Two small requests a picture (one to hand out the places, one to check and record it), and two
uploads to Blob, which count against its 2,000 a month on Hobby. Showing a picture is Vercel's
CDN, with no function. The library loads the shelf with one more small request (`/api/art`).

## Left out, for now

- **Portraits and maps** on characters, places and systems, where `Monogram` stands in today
  (story bible, connections panel, book aside, insights, word maps). Next.
- **Pictures in the text** (idea 22).
- **A cover in the Word file**: there was no drawn one before either.
- **An image on share links' previews** (`og:image`): a shared book's link could show its cover
  where it's posted.
- **Cropping or moving the picture on a cover**: it's cut to the cover's shape from the middle.
- **Opening a saved picture in the studio** on another device: the drawing itself is still kept
  only in the browser it was made in. Its vector layers could go to Postgres and paint layers to
  the store, as the plan had it.
- **Limits on uploads per month** for each writer, beyond the room. Blob's Hobby plan allows
  2,000 uploads a month across everyone, which is 1,000 pictures.
- **Reporting a picture** on a public page.
- **A check against the real store.** Everything was tested on the stand-in; the Blob calls only
  run with the key. Try one upload on a preview deployment first.

## What it took

- `BookCover` needed its picture passed in rather than kept on the book row, because five places
  replace a whole row with a server reply.
- Timestamps without a time zone compared with JavaScript's clock are off by the database's zone:
  abandoned uploads looked hours old on the throwaway database and were cleared at once. Ages are
  compared in Postgres.
- The `jose` and `zod` that Better Auth uses gained second copies with `@vercel/blob`; the new ones
  stayed nested under `@vercel/oidc` and `@vercel/cli-config`, so nothing moved.
