---
name: bb-shipping
description: How work on Book Builder gets finished, committed and shipped, and how this user likes to work, covering when to commit and push (and when not to), staging only the right files, commit message style and attribution, production migrations needing approval, wrapping up a feature with what was built and tested, and the user's standing preferences. Use this whenever the user says commit, push, ship, deploy, "push to main", "run the migration", or when you're wrapping up a feature or deciding what to report back.
---

# Book Builder: finishing and shipping

## How this user works

- **The asks.** They ask for features in a sentence or two and expect good judgment to fill in the rest. "As feature rich as you can think of" is a typical brief. Ask only when a decision is truly theirs, and otherwise choose well and say what you chose.
- **Mid-turn messages.** They often add requirements while you work ("Also, …", "Even if not logged in"). Fold them into the current task. They aren't a new task and they don't cancel it.
- **Verification.** They notice details: how an animation feels, whether pages fill, a bar that disappears, text that scrolls away while selecting. Check visible work in a browser (see the `bb-verify` skill) before saying it's done.
- **Homepage.** After a feature lands they often want the homepage to show it, kept lean (see the `bb-homepage` skill).
- **Tone.** Friendly and brief ("commit and push :D"). Match it. Don't pad.

## Committing and pushing

- **Only when asked.** Commit and push only when the user asks in that message or the current request ("…then commit and push"). Finishing a feature isn't permission; end by asking "Want me to commit and push?".
- **Straight to `main`.** They push straight to `main`, not via branches or pull requests, unless they say otherwise. Vercel deploys from `main`.
- **Before committing**:
  1. `yarn run check` and `yarn lint` pass.
  2. `git status --short` to see everything.
  3. Stage **named files only** (`git add src/... drizzle/manual/...`), never `git add -A` or `git add .`. The user may keep their own untracked files in the repo, and those must not be committed or deleted.
  4. If `package.json` shows as modified with no real change (CRLF), leave it out: `git reset -q package.json`.
- **After pushing**, report the short hash (`git log --oneline -1`) and mention anything you deliberately left uncommitted.

### Commit messages

Match the history (`git log --format=%s -20`):

- **Subject.** A plain-English subject in the imperative, sentence case, no prefix like `feat:`, about 60 characters at most. Examples:
  - "Add focus mode and author profiles"
  - "Fill the hero book's pages to the foot"
  - "Date edits by their text; show the editor and outline on the home page"
- **Body.** Short paragraphs that say what the user can now do and see, feature by feature, in the same voice as the UI. Mention fixes in an "Also:" paragraph. If the change has a migration, add a line like "Migration: drizzle/manual/0006_profiles.sql (already applied to Neon)." or "(not yet applied)".
- **Attribution.** End with the attribution lines the session's system instructions give for commits. They name the model and the current session URL, so take them from this session's instructions rather than copying lines from older commits.
- **Passing the message.** Write it with a quoted heredoc (`git commit -q -F - <<'EOF' … EOF`) so quotes and `$` survive.

## Production database changes

- **Neon.** Migrations against the user's Neon database need an explicit yes from the user for that migration. Prepare and test it on a throwaway database first (see the `bb-database` skill), then ask "Run it on Neon?". If the user said "run the migration and push", do both.
- **Secrets.** Never print `.env` values. Show only the database host when confirming where a command runs.

## Wrapping up a feature

End with a short report the user can scan:

1. **What it does**, in their words, as a few bullets or short paragraphs, including how to find it ("tap Book in the reader's top bar").
2. **What you checked**: widths, themes, flows, and that check and lint pass. Say plainly if something couldn't be verified or a test failed.
3. **Anything that needs them**: a migration to approve, a choice you made that they might want different, files you left alone.
4. **The question**, if they haven't already asked you to commit: "Want me to commit and push?"

Don't claim things you didn't run, and don't bury a failure in the middle of a success list.
