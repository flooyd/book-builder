# Idea 1: version history

**Shipped 2026-11-04.** This is the record of how it works. What was left out is in its row on the
list.

The rules are in `lib/story-versions.ts` (no imports), the server side in
`lib/server/story-versions.ts`, and the window in `lib/components/story/VersionHistory.svelte`.

- **When.** A save keeps the text it replaces when the newest version is ten minutes old or more,
  and always before a cut of 100 words or more, so a slip costs ten minutes of work at worst. A
  restore always keeps the text it replaces, which is what its Undo puts back.
- **Thinning.** Every version from the last two days, then the last of each day for a month, then
  the last of each week, counted in UTC. One the writer keeps (a `label`, even an empty one) never
  goes.
- **What it costs.** One indexed read per save. A copy and the thinning happen only when a version
  is kept. Each version is a whole copy of the text, which Postgres compresses. The comparison runs
  in the browser (`lib/diff.ts`, Myers' algorithm, paragraphs then words), so the server only ever
  sends the text.
- **Goals.** A restore counts toward today's words only when the version was kept today: then it
  undoes today's edits. An older one would count old words as new.

## What new kinds of text mean for it

Anything the comparison doesn't read can change without the window showing a change. Footnotes
(23) settled it for themselves: the window compares `textWithNotes`, which puts each number where
it sits and the notes after the story, since `plainText` leaves notes out. Pictures (22) still
have to settle it. A version is cleaned again when it's restored, so a kind of node that's taken
off the allow-list later disappears from old versions too.
