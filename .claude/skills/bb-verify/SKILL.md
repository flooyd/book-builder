---
name: bb-verify
description: Run Book Builder locally against a throwaway Postgres (never the user's Neon database) and check changes in a real headless browser, covering sign-up of a test user, seeding a long sample book, screenshots at desktop and phone widths in both themes, console-error and sideways-overflow checks, checking exported files, running tests on the app's own modules with no test runner in the repo, and cleaning up afterwards. Use this whenever you need to run, start, preview, screenshot or test the app, write or run a test, confirm a UI or behaviour change actually works, test a migration, or reproduce a bug, and before telling the user a visible feature is done.
---

# Book Builder: run it and see it

The user expects features to be shown working, not just to compile. This is the loop that
proves it without touching their real data.

Bundled scripts (in `scripts/` next to this file):

| Script                | What it does                                                                                                                                                                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scratch-db.sh`       | Creates and starts a throwaway Postgres on port 54329, builds the current schema with drizzle-kit, prints the `DATABASE_URL`. Also `stop` and `url`.                                                                                                                    |
| `browser.mjs`         | puppeteer-core helpers: `launch`, `watch` (console errors, failed requests), `shot`, `overflow`, `freeze` (pause CSS animations), `ensureSignedIn` (signs up or signs in the test user; a new one's email is confirmed in the throwaway database by `confirmTestUser`). |
| `seed-long-book.py`   | Prints SQL for "The Long Light", a long sample book (prologue, two parts, five chapters, rich text with a scene break, heading, quote and a three-line drop cap).                                                                                                       |
| `pdf-sheet.mjs`       | Draws pages of a PDF onto a contact sheet to look at. Run it from the scratch folder after `npm i pdfjs-dist`: `node pdf-sheet.mjs out/book.pdf name 1-8 4 340`.                                                                                                        |
| `word-check.ps1`      | Opens a `.docx` in real Word, read-only. Lists its contents and the page each heading really lands on, and can save Word's own PDF.                                                                                                                                     |
| `serve-func.mjs`      | Runs one built Vercel function from a copy outside the repo, the closest thing to Vercel here.                                                                                                                                                                          |
| `measure-ambient.mjs` | Renders every ambient sound offline in real Chrome and prints its loudness, peaks, stereo width, loudest jump and spectrum by octave, with a spectrogram sheet.                                                                                                         |
| `test-lib.mjs`        | Runs test files against the app's own modules (`$lib/rich`, `$lib/bible`, `$lib/diff` and the like) with nothing but what's in `node_modules`. Run it where it is, from the repo root.                                                                                  |

## 1. A throwaway database

Keep the data outside the repo, e.g. in your scratchpad or temp folder:

```bash
bash .claude/skills/bb-verify/scripts/scratch-db.sh start "<scratch>/pgdata"   # from the repo root
```

- **Requirements.** It needs PostgreSQL's binaries (default `C:\Program Files\PostgreSQL\18\bin`; set `PG_BIN` elsewhere). The user's own Postgres service on 5432 is left alone.
- **Re-running.** Running `start` again on the same folder restarts it and re-applies the current schema.
- **Cleanup.** Stop it when you're done with `scratch-db.sh stop "<scratch>/pgdata"`.
- **Never point anything in this workflow at `.env`'s `DATABASE_URL`.** That is the user's Neon database (see the `bb-database` skill).

## 2. The dev server on it

```bash
DATABASE_URL="postgres://bb@localhost:54329/bookbuilder" ORIGIN="http://localhost:5199" \
  RESEND_API_KEY="" BLOB_READ_WRITE_TOKEN="" ART_STORE_DIR="<scratch>/art-store" \n  npx vite dev --port 5199 --strictPort > "<scratch>/dev.log" 2>&1
```

- **Pictures.** The empty `BLOB_READ_WRITE_TOKEN` keeps test pictures out of the real Vercel Blob store (`.env` has the key): the art shelf keeps them in `ART_STORE_DIR` instead (see the `bb-art` skill). The throwaway database runs on America/Chicago time, which shows up any code that compares a `timestamp` column with JavaScript's clock.
- **Email.** The empty `RESEND_API_KEY` keeps test emails away from Resend: the dev server prints each one to its log instead, link and all (`[email] To …`), so a test can read the link and follow it. Sends are limited to one a minute per address, so between runs that send to the same address, clear them with `delete from verification where identifier like 'bb-email:%'`.

- **Start it.** Start it as a background task. Wait for it with `until curl -s -o /dev/null http://localhost:5199/; do sleep 1; done`. The other variables (`BETTER_AUTH_SECRET`) come from `.env`, and the variables given on the command line win.
- **Stop it.** Stopping the background task can leave Vite running on Windows. Kill whatever listens on the port:

  ```powershell
  Get-NetTCPConnection -LocalPort 5199 -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -Confirm:$false }
  ```

## 3. Drive it in a browser

Set up a scratch folder once (outside the repo):

```bash
mkdir -p "<scratch>/tools" && cd "<scratch>/tools"
npm init -y >/dev/null && npm i puppeteer-core
cp "<repo>/.claude/skills/bb-verify/scripts/browser.mjs" .
```

Then write small, task-specific scripts next to it:

```js
import { launch, watch, shot, overflow, ensureSignedIn, BASE, sleep } from './browser.mjs';
const browser = await launch('auth'); // 'anon' for signed-out pages
try {
	const page = await browser.newPage();
	await page.setViewport({ width: 1440, height: 900 });
	await ensureSignedIn(page); // signs up wren@example.test the first time
	const problems = watch(page, 'chapter');
	await page.goto(`${BASE}/chapter/1`, { waitUntil: 'networkidle0' });
	console.log(await shot(page, 'chapter-1440-dark'));
	console.log('overflow', JSON.stringify(await overflow(page)));
	console.log(problems.length ? problems.join('\n') : 'no console problems');
} finally {
	await browser.close();
}
```

Then **look at the screenshots** with the Read tool. A script passing isn't the same as the
page looking right.

### What to check for a visible change

- **Widths.** Check 1440×900 and 390×844 (phone). On the phone, `overflow(page)` must be `null`, which means no sideways scroll.
- **Themes.** Check both. Set the theme cookie before loading: `page.setCookie({ name: 'bb-theme', value: 'light', url: BASE })`, or `'dark'`.
- **Errors.** `watch()` should report no console problems. The Lit dev-mode notice is filtered out because it comes from a dependency.
- **Interactions.** Run them, not just the first paint: click, type, press keys, reload, and check that state survives where it should.
- **Animation.** Use `freeze(page, '.stage', 2.5)` to screenshot an animation at a given moment.
- **Reduced motion.** Use `page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])` when the change animates.
- **Sound.** Nobody here can hear it, so measure it, and say so when reporting back. Copy `measure-ambient.mjs` next to `browser.mjs`, run it with the dev server up, and read the spectrogram sheet as well as the numbers: sea should arc, wind should move, and crackles should show as strikes. Sounds sit at -20 dB A-weighted at full level (night at -22), so after changing a recipe, put new values in `TRIM` in `lib/ambient.ts`. Wait a moment after saving that file, or Vite's reload interrupts the render.

### Gotchas met before

- **View transitions block clicks.** Theme switches and page navigations run view transitions, and the page ignores clicks while one runs. Wait about 1.3s after toggling the theme before clicking anything.
- **Mobile emulation reloads.** `page.setViewport({ isMobile: true, hasTouch: true })` reloads the page in puppeteer. Plain width changes don't, and those are what test resize handling.
- **Saved preferences leak between runs.** Reader preferences (`bb-reader` cookie) and reading positions (`localStorage`) persist in the `auth` profile across runs. Delete them at the start of a test that depends on defaults.
- **Clicking "Log in".** `button:not([formaction])` matches the theme toggle first. Submit the login
  form with Enter in the password field (`ensureSignedIn` does).
- **Starting a second Postgres.** `pg_ctl ... start` run straight from PowerShell hangs on inherited
  streams. Use `scratch-db.sh` (it detaches them), or start `postgres.exe -D <dir> -p <port>` with
  `Start-Process -WindowStyle Hidden`. Stopping the shell that started a server kills it.
- **Old scratch data.** Earlier scratch databases are kept under the Claude scratchpad
  (`%LOCALAPPDATA%\Temp\claude\...\scratchpad\*\pgdata`). The user values them, so copy a folder
  before starting a server on it, and never edit the original.
- **A reload the first time an editor opens.** On a freshly started dev server, the first page that loads Tiptap can make Vite log `optimized dependencies changed. reloading` and reload the page mid-test: the description box is missing, then the page goes blank. It isn't a bug. Run the script again, or open an editor once before testing.
- **Duplicate headlines.** `motion-headline` keeps a hidden copy of its text for screen readers, so `h1.textContent` reads the title twice. That's expected.

## 4. Test data

Sign the test user up first (`ensureSignedIn`), then:

```bash
PYTHONIOENCODING=utf-8 python .claude/skills/bb-verify/scripts/seed-long-book.py > "<scratch>/long.sql"
PGCLIENTENCODING=UTF8 psql -h localhost -p 54329 -U bb -d bookbuilder -q -t -A -f "<scratch>/long.sql"   # prints the new book id
```

For your own seeds, follow the rules in the `bb-database` skill: compact rich-text JSON,
UTF-8, and `"user"` quoted inside a file.

## 5. Checking exports

- **Fetch them signed in.** Call the endpoint from a signed-in page with `fetch`, or click the real buttons with `Browser.setDownloadBehavior`.
- **Look at the pages.** Put them on a sheet with `pdf-sheet.mjs` and read it.
- **Open Word files in Word.** Run `word-check.ps1` inside `Start-Job` with a timeout, since Word can sit waiting on a dialog nobody sees. Every contents number should match where the heading really lands.
- **Check what stays out.** Seed hidden titles and descriptions, then search `pdftotext` output, the raw PDF and every part of the unzipped `.docx`.

## 6. Checking a production build

The dev server resolves packages differently, so a change to server packages isn't proven until
the build has run (see "Adding a package" in the `bb-stack` skill).

1. Build with `DATABASE_URL` on the throwaway database. Stop the dev server first, or restart it after: the build clears `.svelte-kit`, and a change to `vite.config.ts` restarts it.
2. Copy the function out of the repo so it can't reach the project's `node_modules`: `cp -r ".vercel/output/functions/![-]/1.func" "<scratch>/func/export"`. Read each `.vc-config.json` to see which is which: the export has `maxDuration`.
3. From the repo root, run `node .claude/skills/bb-verify/scripts/serve-func.mjs "<scratch>/func/export" 5197` in the background.
4. Call it with the cookies of a signed-in dev server page. It uses the same secret, so the session holds. It serves API routes and pages only: static files come from Vercel's CDN.

Stop those ports when you're done.

## 7. Testing the rules, without a browser

The repo has no test runner, and a good half of the app's rules live in modules that import only
each other, on purpose, so they can be tested alone. Write the test as ordinary TypeScript with
`node:test`, importing from `$lib` as the app does, and keep it in your scratch folder:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanValue } from '$lib/rich';

test('a node the allow-list does not know is dropped on save', () => {
	const value = '{"type":"doc","content":[{"type":"figure","attrs":{"src":"https://x.example"}}]}';
	assert.equal(cleanValue(value, 'story'), '');
});
```

```bash
node .claude/skills/bb-verify/scripts/test-lib.mjs "<scratch>/tests/rich.test.ts"   # from the repo root; takes several files
```

- **What it can load.** `rich`, `bible`, `diff`, `story-versions`, `insights`, `speakers`,
  `word-map`, `word-cloud`, `connections`, `goals`, `headings`, `cover`, `confirm`, `status`,
  `export`, `profile` and `outline-text`, and `countWords` and `storyWords` from `reading`
  (checked 2026-11-09).
- **What it can't.** Anything that reaches `$app/...`, `$env/...` or a `.svelte` file. That's
  `library.ts`, `series.ts` and everything under `lib/server`, the export's `manuscript.ts`
  included. The error is `Cannot find package '$app'` (or `'$env'`). Test those through the dev
  server.
- **When to bother.** Whenever a rule decides what's kept, counted or shown: the cleaner in
  `rich.ts` above all, since it's what stands between a request and a public page. Try the
  hostile cases, not only the happy one.
- **The tests aren't kept.** They live in the scratch folder and go with it, so say in the
  wrap-up what was tested and how many passed. If the user wants them kept in the repo, that's
  theirs to decide.

## 8. Before saying it's done

- Run `yarn run check` and `yarn lint`, and make sure both pass.
- Look at the screenshots, and say what you checked and anything you couldn't.
- When styles use `light-dark()` in new places, check the production CSS (see the `bb-design` skill).
- Stop the dev server (kill the port) and the throwaway database.
