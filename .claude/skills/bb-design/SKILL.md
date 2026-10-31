---
name: bb-design
description: Book Builder's design system and UI rules, covering colour tokens and the light/dark theme, fonts, spacing, the shared UI components (Button, Dialog, Icon, BookCover, Pill), motion, 3D effects, responsive and accessibility checks, and how UI copy should sound. Use this whenever you build or restyle anything visible in this app (a page, component, dialog, button, card, animation, homepage section or empty state), or when the user mentions how something looks, feels, colours, dark mode, light mode, mobile or layout.
---

# Book Builder: design system

The look is "a bookbinder's workshop at night". In dark mode a deep navy ground carries warm
paper, a royal blue accent and a sky-blue highlight. Light mode is built on the paper of the
writing surface. Type does most of the work: a display serif for titles, a reading serif for
story text, a grotesk for UI.

## Colour and theme

All colours are tokens in `src/lib/styles/tokens.css`. Use the tokens and don't hard-code hex,
except for objects that keep their colour in both themes (book covers, paper pages, the 3D
book).

- **Theme switching.** Theme colours are written `light-dark(light, dark)`. `color-scheme` comes from `<html data-theme="light|dark">`, which `hooks.server.ts` renders from the `bb-theme` cookie. With no cookie, the theme follows the OS. `ThemeToggle` switches it with a circular view-transition reveal.
- **Token families.**
  - Grounds: `--bb-night`, `--bb-panel`, `--bb-ink`, `--bb-hover`, `--bb-raised`.
  - Lines: `--bb-line-faint`, `--bb-line-soft`, `--bb-line-mid`, `--bb-line`, `--bb-line-control`, `--bb-line-dashed`.
  - Blues: `--bb-royal` (primary buttons, white text passes AA), `--bb-sky` (accents, links, focus).
  - Text: `--bb-text-strong`, `--bb-text`, `--bb-text-label`, `--bb-text-read`, `--bb-text-desc`, `--bb-text-2`, `--bb-text-3`, `--bb-text-4`.
  - Status: `--bb-coral*`, `--bb-amber`.
  - Formatted-text palettes: `--ink-*`, `--mark-*`.
  - Shadows: `--bb-drop`, `--shadow-card`, `--shadow-modal`, `--focus-ring`.
- **Paper.** `--bb-paper`, `--bb-paper-line`, `--bb-paper-ink`, `--bb-paper-muted` are the same in both themes.

### The production `light-dark()` trap

In the production build, Lightning CSS turns `light-dark()` into
`var(--lightningcss-light, A) var(--lightningcss-dark, B)`. Those variables resolve **where a
custom property is declared**, not where it is used. Consequences:

- The colour tokens are redeclared on `:root, [data-scheme]`.
- To pin a subtree to one theme (paper pages that must stay light, a night-coloured surface in light mode), put `data-scheme="light"` or `data-scheme="dark"` on it. The tokens inside then resolve for that scheme.
- A component custom property declared with `light-dark()` resolves at the element that declares it. If it should follow the app theme while its children are pinned, declare it on an ancestor outside the pinned subtree, as `BookView`'s `--paper` does.
- Dev mode uses native `light-dark()`, so a mistake only shows in production. When this matters, build with `npx vite build` and grep the CSS in `.svelte-kit/output/client/_app/immutable/assets/` for the property. On Windows the build's final Vercel symlink step fails with EPERM. That's harmless: the CSS is already written.

## Type, radii, spacing

| Use                                     | Token            | Family                              |
| --------------------------------------- | ---------------- | ----------------------------------- |
| Titles, numbers, drop caps              | `--font-display` | Gloock                              |
| Story text, descriptions, italic blurbs | `--font-read`    | Newsreader (optical sizes, italics) |
| UI                                      | `--font-ui`      | Schibsted Grotesk                   |

- **Font loading.** Fonts load from Google Fonts in `src/app.html`. A new weight or family has to be added to that URL.
- **Overlines.** Small uppercase labels ("PART ONE", "CHAPTER 2") use `--font-ui`, weight 700, size around 0.62–0.7em, letter-spacing 0.18–0.3em, colour `--bb-sky` or `--bb-text-3`.
- **Radii.** `--r-chip` 8, `--r-control` 12 (buttons, inputs), `--r-row` 14, `--r-card` 20, `--r-modal` 24, `--r-pill`.
- **Story text.** It's styled once in `prose.css` (`.bb-prose`) and shared by the editor, reading mode and focus mode. Don't restyle paragraphs locally. See the `bb-rich-text` skill.

## Shared components (`src/lib/components/ui`)

- **`Button`**
  - Variants: `primary`, `ghost` (default), `danger`, `quiet`.
  - Sizes: `md` (44px, the touch target), `lg` (48), `xl` (54).
  - Other props: `block` and `glow`. Passing `href` renders a link.
  - Wraps `motion-press` for the tactile press.
- **`Dialog`**: a native modal `<dialog>`. Mount it to open and unmount it to close. Takes `labelledby` (required), `onclose`, `width`. Focus is trapped and Esc closes.
- **`Icon`**: 24×24 stroke icons in the `ICONS` map (a string is a path, a tuple is a circle). To add an icon, add its paths to the map. `IconName` types the names.
- **Others**:
  - `BookCover`: a generated cover from the title (navy or paper variant by id hash; `sm`, `md`, `lg`; optional `tilt`).
  - `Pill`, `Kbd`, `Wordmark`, `ThemeToggle`.
  - `AppHeader`: crumbs come from `useAppHeader`.
  - `CommandDock`, `CreateModal`.

Reach for these before writing new ones, and match their look when you must write new ones.

## Motion

- **Library.** `motion-components` elements (`motion-headline`, `motion-reveal`, `motion-stagger`, `motion-press`, `motion-tilt`, `motion-spotlight`, ...) are registered in `$lib/motion.ts` and only after hydration. Content inside them must still make sense before they upgrade.
- **Reduced motion.** Respect `prefers-reduced-motion: reduce`: turn animation off or make it instant.
- **Page transitions** use view transitions. The page can't be clicked while one runs, so keep them around 300ms.
- **3D (the hero book, the reading-mode book):**
  - Put `perspective` on the direct parent of what rotates.
  - Nothing on a `preserve-3d` element may use `filter`, `opacity < 1` or `overflow` other than visible, because each of those flattens it.
  - Faces use `backface-visibility: hidden`.
  - Put shading on a child overlay, not on the rotating element.

## Responsive and accessible by default

- Check every visible change at **1440px and 390px wide, in both themes**. On phones, keep a 16px side gutter and no sideways scroll (`document.documentElement.scrollWidth <= innerWidth`).
- Interactive targets are at least 44px. Focus shows the global `:focus-visible` ring, so don't remove it without an equivalent. The one exception is the editor's writing area, which is itself the focus.
- Hide text visually with the `.sr-only` utility in `global.css`.
- Icons that are the only content of a button need an `aria-label`. Decorative SVGs get `aria-hidden="true"`.
- The `bb-verify` skill has the screenshot workflow.

## UI copy

- **Voice.** Plain, warm and short, in sentence case. Say what happens ("Saved", "Turn the page", "Back to the book"), not system words ("Success", "Submit", "Execute").
- **Nouns.** Use the app's nouns: book, part, chapter, story text, description, outline, cast, character, system.
- **Empty states** say what's missing and offer the next step ("No story text yet. Write it").
- **Errors** are sentences a writer would understand.
- **Spelling.** Comments and sample prose lean British ("colour", "centre", "kilometres"). Match the file you're in.

## Things the user has reacted to

- **The paper look.** They liked the paper colour of the writing surface, and the light theme was built from it.
- **Disappearing UI.** They don't like controls that vanish while typing. Focus mode's bar was made to stay visible after they asked.
- **Unexpected scrolling.** Interactions that fight the user (scrolling while they select text to copy) are bugs, not features.
- **The hero book.** They loved the 3D animated book and asked for pages that fill properly. A chapter's last page may stop partway, as in a real book.
