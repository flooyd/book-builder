# Idea 19: the connections map

**Shipped 2026-11-06.** This is the record of how the map is drawn. What was left out is in its
row on the list.

The rules are in `lib/connections.ts` (type imports only, so it can be tested on its own), and
the page is `lib/components/bible/ConnectionsPage.svelte` with `ConnectionsMap`,
`ConnectionsPanel` and `ConnectionsList`.

- **What the server does.** One query per page load (`connectionsIn` in `lib/server/bible.ts`):
  every connection touching an entry in the book or series, found through the link tables and the
  `entry_link` indexes. Everything else happens in the browser, as the user prefers.
- **Kinds.** A line's colour comes from its label, by word lists in `relationKind`: family, then
  rivals, then allies, first match wins, so "Estranged sister of" is family and "Sworn enemy of" a
  rival. Anything else ("Captain of", "Owes") is other. The colours are the `--bb-tie-*` tokens.
- **Layout.** A force layout with no randomness, so a web always comes out the same. Lines pull
  towards a length that leaves room for their label, entries push apart (more sideways than up and
  down, for their names), and entries keep off lines that aren't theirs. Webs up to 60 entries are
  laid out from five starts and the one with the fewest crossings and hidden names wins. On random
  test webs: 25 entries in about 15 ms, 250 in about 200 ms.
- **Arrangement.** Entries the writer drags (or moves with the arrow keys) stay where they're put,
  in `localStorage` under `bb-connections-book-<id>` or `-series-<id>`. New entries find a place
  among them without moving anything. Tidy up lays the whole web out afresh, with an Undo.
- **Visiting entries.** A connection to an entry outside the book or series brings that entry in
  with a dashed outline, "From another book".
- **Phones.** A chosen entry opens in a sheet over the page. The panel under the map stays in the
  flow, so opening the sheet never changes the page's height or scrolls it.
