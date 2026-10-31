---
name: bb-homepage
description: Book Builder's signed-out homepage and marketing content, covering the numbered showcase sections, the Coming soon shelf (soon.ts), the animated 3D hero book and its story text (hero-book.ts), and the sample universe "The Glass Armada" that all mock data, demos and seeds must use. Use this whenever a task touches the homepage, landing or marketing copy, adds a feature the user may want showcased, updates the Coming soon list, edits sample or mock content, or needs example book, character or chapter names anywhere in the app.
---

# Book Builder: homepage and sample story

## Homepage structure (`lib/components/marketing/Home.svelte`)

1. **Hero**: the headline, calls to action, and `AnimatedBook.svelte` (the decorative 3D book with floating tags).
2. **Marquee**, then numbered sections, each a `<section id=...>` with a `<p class="overline">0N — Name</p>` label:
   - `#features` **01 — How it's organized**: books, parts, chapters, characters, systems, with a sample tree card.
   - `#example` **02 — The editor**: a sample page of story text with formatting and a first letter.
   - `#outline` **03 — The outline**: a corkboard picture from the `board` array, with statuses in the outline's colours.
   - `#focus` **04 — Focus, goals and share**: three cards: focus mode, the author page (the "Oriel Vance" picture, with a "See the demo author" link to the real Demo Author page) and writing goals (a picture of today's progress, a streak and two weeks of bars).
   - `#soon` **05 — On the shelf next**: the Coming soon shelf, rendered from `SOON`, and hidden (with its header link) when the list is empty.
3. **Closing** call to action, then the footer.

### How the user wants it

- **Lean.** "Keep it lean like it is now". When a feature ships, the user usually wants it showcased. Prefer adding a card or a line to an existing section over a new section. Add a section only for something big, and renumber the labels if you do.
- **Coming soon.** `SOON` in `marketing/soon.ts` holds the user's planned features (currently Export to PDF and Word, and Mentions). Remove an entry when it ships. Only add entries the user asks for: it's their roadmap. While it's empty, the section and its nav link disappear on their own.
- **Real product.** Showcases depict the real product, so mirror the real UI's look (paper surface, statuses, covers) rather than inventing features that don't exist.
- **Breakpoints.** Check it at 1440 and 390 in both themes (see the `bb-verify` skill). The hero book scales down on phones (`scale(0.56)`, then `0.5` under 420px).

## The animated hero book

- **Pages.** `AnimatedBook.svelte` has a base spread (pages 2 and 11) and four leaves (3/4, 5/6, 7/8, 9/10) that turn on a 14s loop and riffle back. Keep the keyframes as designed.
- **Story text.** The text lives in `hero-book.ts` as **flows**: the teaser on page 2, the Prologue on pages 3–4, and Part One's chapter "Salvage Rights" on pages 5–11. After the fonts load the component measures the real page bodies and pours each flow in: pages fill to the bottom, a paragraph that doesn't fit carries over, and the server render uses a word-count estimate that overfills.
- **Short pages.** A chapter's last page may stop partway, as the Prologue does on page 4. The user asked for that: every page full _except_ chapter ends.
- **Editing the text.** Change the paragraphs in `hero-book.ts`, then measure: every page should read 21/21 lines, page 5 (the Part One opener) about 11, and page 4 should stop about halfway. A flow with too little text leaves its last page short, and one with too much simply drops the end.

## The sample universe: The Glass Armada

All mock data (homepage, demos, screenshots, seeds, examples in copy) uses this original
space-opera / science-fantasy series. The user had the earlier sample ("The War of Nine",
"Maren Toll") removed everywhere, so don't bring it back, and don't invent unrelated sample
books when this one fits.

**Books.** _The Glass Armada_, the main sample, by author **Oriel Vance**, plus a second book, _Lanterns of Vesper_.
The live demo account in Neon (see the `bb-database` skill) is named **Demo Author** instead,
because the user asked for that name. It holds _The Long Light_, a long sample in this same universe.

**Outline of _The Glass Armada_:**

- Prologue, a story-text part.
- **Part One: The Drowned Moon**:
  1. Salvage Rights
  2. A Map of Dead Stars
  3. Burn Through
- **Part Two: The Hollow Sun**: 4. Ghostlight 5. The Lantern Gate
- Epilogue: Last Light.

**People.**

- **Juno Halley**: captain of the salvage ship _Meridian_, and a character in two books.
- **Ade**: her scanner and signals man, with an ear for dying engines.
- **Pell**: the engineer who sings to the engines.
- **Tamsin**: lost before the story starts. Juno wrote her crew's rules in the years after.

**Places and things.**

- **Kesh**, a drowned moon under a frozen sea.
- The **Lantern Gate**, sealed for three centuries.
- **Vesper Station**.
- The **Glass Armada**, a fleet of glass ships that vanished past the gate three hundred years ago.
- A beacon under the ice repeating **seven notes**.
- A map of dead stars marked "sing me home".

**System.** **Starsinging** (System · Magic): pilots sing their ships from star to star. Its
rule is "a song that is answered must be finished."

**Voice.** Quiet, literary, a little eerie; British spelling ("centre", "kilometres"); curly
quotes in prose.
