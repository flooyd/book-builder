# Idea 17: word maps, and telling who's speaking

**Shipped 2026-11-02.** This is the record of how it works. What was left out is in its row on the
list.

The user asked for two maps: the whole book with no AI, and the whole book split by character.
They expected the second to need AI, so that it wouldn't take a huge list of words to look for,
"unless you think it's not necessary". Decided on 2026-11-02: it isn't, for a first version, and
that version shipped the same day. The rules are in `lib/speakers.ts`.

- **No list of speech verbs.** The names are already in the story bible. In
  `"How are you doing?" Will inquired.`, a known name or alias next to the quotation marks says who
  it is, whatever the verb is.
- **In order of trust** (`How` in the code):
  1. `named`: a name beside the words, with the article or title it comes with (`said the Hatter`,
     `Captain Halley asked`), or `I said` for the narrator. A paragraph ending in a colon, comma or
     dash goes by who its last sentence is about.
  2. `nearby`: the subject of the sentence next to the line, or the one person the paragraph's
     narration mentions, if they're also its subject. Across a paragraph break it needs a he or she
     tag that fits. A pronoun that clashes overrules it, and nobody can address themselves.
  3. `turns`: unbroken talk between exactly two people, followed from lines it's sure of, names
     used in address and he or she. It only runs if the sure lines either side agree, and stops
     for a third person within four paragraphs or a tag it can't place.
- **Never guess.** Anything still uncertain goes under "Not sure who", where the writer can read
  it. A character's map with a stranger's words in it is worse than a smaller map.
- **He and she** aren't in the story bible, so `pronounsOf` reads them from the book: narration
  about one person, counting he, she, himself, herself and titles. His and her were too noisy.
- **Names beside lines that aren't in the bible** are collected and offered as ones to add. A tag
  with an unknown name also stops the guessing around it.
- **Names are not words.** The user's rule, from 2026-11-02: if a character is in the bible or
  linked with an @, they should be on the cloud without anyone adding them. So people are tallied
  by name, apart from ordinary words, and keep a place on the book's cloud however rarely they're
  named. A character who never appears in the text isn't drawn: there's nothing to size them by.
  A name that's an everyday word (Hope) also picks up that word where it opens a sentence, since a
  capital proves nothing there. Questions are the one case told apart: "Will she come?", "May I?"
- **Tried and dropped.** Giving an untagged line to the one person the paragraph before was about
  scored 0 of 10 in the blind test, because that line is usually the other person answering.
- **How it was measured.** Hiding the tags of known lines in four public-domain novels and seeing
  if the rules put them back: `named` 55 of 55, `turns` 65 of 68. That's on lines where the answer
  is known, so it's a good sign and not a promise. Share of spoken words placed: Alice in
  Wonderland 70%, The Secret Adversary 41%, The Adventures of Sherlock Holmes 33%, Pride and
  Prejudice 32%. The low ones are long stretches of untagged talk, and clients nobody has listed.
- **Known limits.** Quoted thoughts count as speech. Scene breaks don't reach `plainText`, so an
  exchange can run across one. Someone speaking two paragraphs in a row can flip the turns that
  follow. A first-person narrator is "The narrator", not their entry.
- **The tests** aren't in the repo, which has no test runner. There were 47 on the rules and 45 on
  the maps and cloud, run from a scratch folder. The `bb-verify` skill's `test-lib.mjs` runs tests
  like them in one command, so write them again when these rules change.
- **AI, if ever.** Only for what's left, opt-in, on the writer's own key, for the same reasons as 16. Don't promise it, or its absence, on the public shelf.
