---
name: bb-stack
description: Book Builder's tech stack, project layout and code conventions (SvelteKit 2 + Svelte 5 runes, Drizzle on Neon Postgres, Better Auth, Tiptap, Vercel, Yarn 1). Use this before writing or changing any code in this repo, whether it's a new feature, a bug fix, a refactor, a new route or API endpoint, a component, or a question about how something here is built, so the code matches the house style and passes `yarn run check` and `yarn lint` on the first try.
---

# Book Builder: stack and conventions

Book Builder is a free, open-source workshop for long-form stories: books hold parts, parts
hold chapters (or their own story text), and characters and systems (magic, politics, trade)
can belong to several books. It's deployed on Vercel from `main`.

## The stack

| Piece           | What's used                                                                    | Notes                                                                              |
| --------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Framework       | SvelteKit 2, Svelte 5                                                          | Runes everywhere (forced in `vite.config.ts`). No `export let`, no `$:`.           |
| Database        | Drizzle ORM on `postgres` (postgres-js), Neon in production                    | Schema in `src/lib/server/db/schema.ts`. See the `bb-database` skill.              |
| Auth            | Better Auth with the SvelteKit cookies plugin                                  | `src/lib/server/auth.ts`; `hooks.server.ts` puts `locals.user` / `locals.session`. |
| Rich text       | Tiptap **3.32.0, pinned exactly** (every `@tiptap/*` package the same version) | See the `bb-rich-text` skill.                                                      |
| Motion          | `motion-components` custom elements                                            | Registered in `$lib/motion.ts` after hydration.                                    |
| Deploy          | `@sveltejs/adapter-vercel` 6.x, runtime `nodejs24.x`                           | Stay on adapter 6.x: 7.x needs SvelteKit 3.                                        |
| Package manager | **Yarn 1** (`yarn.lock`)                                                       | Don't add a `package-lock.json`.                                                   |
| Node            | 24.x                                                                           |                                                                                    |

Commands (all from the repo root):

- `yarn run check` runs svelte-check (types). Use `yarn run check`, not `yarn check`, which is a different yarn builtin.
- `yarn lint` runs `prettier --check .` and then eslint. If Prettier fails, run `npx prettier --write <files>` on the files you touched, then lint again.
- `yarn dev` starts the dev server. To run against a throwaway database instead of Neon, see the `bb-verify` skill.

Run both check and lint before calling a change done. They're fast and the user expects them to pass.

## Layout

```
src/
  hooks.server.ts          theme cookie → <html data-theme>, Better Auth session → locals
  app.html                 Google Fonts link, %bb.theme%
  routes/                  thin route files; pages hand off to components in $lib/components
    api/...                JSON endpoints (+server.ts) used by the client
  lib/
    components/<area>/     book, chapter, part, library, outline, reader, rich, story,
                           profile, marketing, ui
    server/                db/, auth, ownership checks, per-feature server helpers
    styles/                tokens.css (design tokens), global.css, prose.css (story text)
    *.ts / *.svelte.ts     shared client logic; .svelte.ts when it uses runes
drizzle/manual/            hand-written SQL migrations, 0001_... upwards
```

The `bb-feature-map` skill says which files own which feature.

### Route pattern

Route files stay thin. A `+page.server.ts` loads and checks access, and the `+page.svelte`
renders one component from `$lib/components/...`, often inside `{#key id}` so the component
re-mounts per record:

```svelte
<!-- Re-mount per chapter so the story text and edit state belong to one chapter. -->
{#key id}
	<ChapterPage {id} />
{/key}
```

### API pattern

Endpoints live in `src/routes/api/**/+server.ts`, return `json(...)`, and always check
ownership. The pattern looks like this:

```ts
export const PUT = async (event: RequestEvent) => {
	const user = requireUser(event); // 401 if signed out
	const id = Number(event.params.id);
	if (!Number.isInteger(id)) return json({ error: 'Invalid chapter id' }, { status: 400 });
	if (!(await findOwnedChapter(user.id, id))) {
		return json({ error: 'Chapter not found' }, { status: 404 }); // never reveal others' rows
	}
	// ...
};
```

Errors are `{ error: string }`, and the message is written to be shown to the user. On the
client, `sendJSON` / `putJSON` in `$lib/library.ts` throw an `Error` carrying that message.

### Client state

- **Library stores.** `$lib/stores` holds books, parts, chapters, characters and systems. `loadLibrary()` fills them, and after a save the client updates the stores rather than refetching everything (e.g. `touchLibrary`).
- **Per-request state.** Theme and app header state are classes with `$state` fields (`ThemeState`, `AppHeaderState`), provided through Svelte context so each server request gets its own.
- **Header crumbs.** Pages set the signed-in header's crumbs with `useAppHeader` from `$lib/app-header.svelte.ts`.

## Code style

The code reads like a careful book: plain words, comments that explain _why_. Match it.

- **Formatting.** Prettier formats with tabs, single quotes, no trailing commas and 100-column lines.
- **Comments.** A short paragraph at the top of a component or module says what it is and any non-obvious rule. Inline comments explain intent, not mechanics. JSDoc `/** ... */` goes on exported functions and on props that need a word.
- **Naming.** Use whole words (`chapter`, not `ch`; `position`, not `pos`). Booleans read as states (`closed`, `turning`, `owner`).
- **Props.** Write `let { a, b = 1 }: { a: string; b?: number } = $props();` with an inline type, documenting a prop with `/** */` where it needs it.
- **Derived values.** Use `$derived` and `$derived.by`. Only use `$effect` for real side effects, and use `untrack` inside one when it should only react to a few inputs.
- **Exported functions.** A component can export functions (`export function step() {}`), and the parent reaches them through `bind:this` typed as `ReturnType<typeof Component>`.
- **Domain words.** User-facing copy and comments use the app's words: book, part, chapter, story text, description, outline, cast, character, system.

## Lint rules that bite

- `svelte/prefer-svelte-reactivity` flags `new Map()` / `new Set()` even when a local one isn't meant to be reactive. Use a plain object or array, or `SvelteMap` if it really must be reactive.
- `svelte/no-navigation-without-resolve` wants internal hrefs built with `resolve()` from `$app/paths`, e.g. `resolve('/chapter/[id]', { id: String(id) })`. When a variable already holds a resolved href, add `<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- <why> -->`.
- `svelte/no-at-html-tags` covers `{@html}`, which is only allowed for HTML produced by `toHTML` in `$lib/rich.ts`, with a disable comment saying so.
- `svelte/no-unused-svelte-ignore` flags a `<!-- svelte-ignore ... -->` comment that no longer suppresses anything. Remove it.

## Git working-copy quirks

- **`package.json`.** Tooling sometimes rewrites it with CRLF line endings and no real change. If `git diff package.json` shows nothing meaningful, leave it out of the commit (`git reset -q package.json`).
- **Handoff files.** `book-builder-redesign-handoff/` and `.zip` are the user's untracked files. Never commit or delete them.

For committing and pushing, see the `bb-shipping` skill.
