---
name: bb-studio
description: How Book Builder's art studio works (idea 25), covering the drawing format and its cleaner in lib/drawing.ts, the Canvas 2D engine in lib/studio (geometry, curve fitting, immutable edits and undo, rendering, hit-testing), the tools and their shared interface, the stage's pointer, wheel, pinch and keyboard handling, the panels, colours and number fields, drafts kept in IndexedDB, downloads, the limits on size and layers, and how to test drawing in a headless browser. Use this whenever a task touches the studio, /studio, drawing, painting, shapes, the pen or pencil, layers, brushes, the colour picker, art or artwork made in the app, or adds a tool or a kind of shape.
---

# Book Builder: the art studio

A vector drawing program that runs entirely in the browser. Drawings are kept in IndexedDB as
they're made; **Save to shelf** in the bar sends the picture as it looks to the art shelf (idea
18, the `bb-art` skill), replacing its earlier copy so the covers it's on follow. That's the only
time the studio reaches the server. What's built, what's left and why are in `bb-roadmap`'s
`ideas/25-art-studio.md`.

## Where the code is

| Layer    | Files                                                                                                                                                                                                                                                    |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Format   | `lib/drawing.ts`: types, limits, `newDrawing`, `PRESETS`, `cleanDrawing` (the allow-list). Imports nothing.                                                                                                                                              |
| Engine   | `lib/studio/`: `geometry.ts` (matrices, bounds, outlines, `normalize`), `fit.ts` (pencil curve fitting), `edit.ts` (immutable changes), `render.ts`, `color.ts`, `numbers.ts` (sums in fields), `draft.ts` (IndexedDB), `surprise.ts` (random pictures). |
| State    | `lib/studio/studio.svelte.ts`: the `Studio` class (drawing, selection, view, tool, style, undo).                                                                                                                                                         |
| Tools    | `lib/studio/tools/`: `tool.ts` (the interface, cursors), `marks.ts`, `path-edit.ts`, one file per tool, `index.ts` (names, keys, icons, `makeTools`).                                                                                                    |
| Screen   | `lib/components/studio/`: `StudioApp` (root, keys, drafts), `Stage` (canvas and pointer), `Overlay` (the tool's marks), `ToolRail`, `StudioBar`, `Inspector`, `LayersPanel`, `ColorPicker`, `ColorWell`, `NumberField`.                                  |
| Pages    | `routes/studio` (`Shelf`, `NewDrawing`) and `routes/studio/draft/[key]` (`StudioApp`). The root layout treats the drawing page like reading mode: no app header, no dock.                                                                                |
| Homepage | `marketing/StudioShowcase.svelte`, section 04 (see `bb-homepage`).                                                                                                                                                                                       |

## The drawing

- **Our own JSON**, versioned (`DRAWING_VERSION`). Layers bottom to top, vector or paint. A paint
  layer is only its settings: its pixels live beside the document, by layer id (`Studio.paint`,
  and the `pixels` store in IndexedDB), so a drawing holds no addresses.
- **Shapes**: rect, ellipse, polygon, star (each a box from 0,0 to width,height), line (two ends
  and arrowheads), path (subpaths of anchors), group. Every shape has a `transform` matrix,
  `opacity`, `hidden`, `locked`, `name`. Paths' anchors are tuples
  `[x, y, inX, inY, outX, outY, kind]`, kind 0 corner, 1 smooth, 2 symmetric.
- **Colours** are `#rrggbbaa` strings, always eight digits, lower case.
- **Scaling is baked in, like Figma.** `normalize` turns a transform's scale into the geometry
  (width and height, anchors, line ends, a group's children), keeping only turn, move and a
  mirror. So a resized rectangle still says its real width, and its stroke doesn't stretch.
- **`cleanDrawing` is the allow-list.** Every draft read goes through it, and so must anything
  that comes from the server once saving exists. It clamps sizes and counts (`MAX_SIDE`,
  `MAX_LAYERS`, `MAX_SHAPES`, `MAX_ANCHORS`, `MAX_DEPTH`, paint layers by `paintLayerLimit`),
  rounds coordinates, drops what it doesn't know, and makes ids unique. Add a field there or it
  disappears on the next load. It's testable with `test-lib.mjs` (see `bb-verify`).

## Changing it: immutable, with undo

- **Never change a drawing in place.** `edit.ts` returns a new one and keeps every untouched
  shape and layer the same object, which is what makes undo cheap (snapshots) and what the
  renderer's `Path2D` cache (a `WeakMap` keyed by shape) relies on.
- **`studio.apply(next, selection, merge?)`** keeps an undo step. A `merge` key folds steps with
  the same key within 1.2 s into one (nudges, scrubbing a field, dragging a colour).
- **Drags:** `studio.live(next)` on each move, then `studio.settle(origin, selectionBefore)` at
  the end for one undo step from where the drag began. A tool that changes the drawing at the
  start of a drag (Alt-copy, turning a rectangle into a path to edit its points) must settle from
  the drawing _before_ that, or undo lands halfway.
- **Positions in panels** are in drawing pixels. `transformShapes` takes a matrix in the drawing's
  space and converts it into each shape's parent's space, so shapes inside groups move right.

## Drawing it

- **`drawScene`** draws the ground and layers clipped to the artboard. It's shared by the screen
  (`Renderer`), the shelf's picture (`thumbnail`) and downloads (`flatten`), so what's saved is
  what was seen. A layer with opacity below 1 or a blend mode is drawn on a scratch canvas first
  and laid on as one (so its own shapes don't show through each other).
- **The stage redraws at most once a frame**, in an effect that reads `doc`, `view`, `sketch`,
  `paintTick`, `activeLayerId` and `stage`. Something new that changes the picture must be read
  there too.
- **`sketch`** is a shape being drawn, shown on the active layer before it's added.
- **Hit-testing** (`shapeAt`, `hitShape`) uses a 1×1 canvas's `isPointInPath` and
  `isPointInStroke`, with a slack in drawing pixels (`5 / zoom`, so 5 screen pixels).
- **The artboard's shadow** colour comes from a hidden span's computed `color`
  (`--studio-shadow`), because a canvas can't read `light-dark()`.

## Tools

- **The interface** (`tool.ts`): `cursor` and `chrome` (getters over `$state`, so they're
  reactive), `down`, `move(press, pressed, steps)`, `up`, and optional `double`, `cancel` (Esc,
  returns whether there was anything), `finish` (Enter), `key` (sees keys before the studio's
  own), `leave` (put down). A `Press` has drawing and screen coordinates, pressure, tilt, the
  pointer type and the modifiers.
- **Chrome** is drawn by `Overlay.svelte` in screen pixels: outlines, a selection box with
  handles, anchors and handles, a marquee, a label. Keep the select tool's handle logic
  (`#gripAt`) and the overlay's in step: they decide the same handles.
- **Adding a tool:** a class in `tools/`, an entry in `TOOL_INFO` (label, key, icon) and
  `makeTools`, a place in `RAIL` or `SHAPE_TOOLS`, a tip in the inspector's `TIPS`, and its keys
  checked against the list in StudioApp's `keydown`.
- **Class fields that read `this.#studio`** must be `$derived.by(() => ...)`, not
  `$derived(...)`: the field is set up before the constructor assigns `#studio`, and svelte-check
  says "used before its initialization".

## Input

- **The stage** sends a press to the tool that took it, until it's let go (`driving`), even if
  the tool changes mid-drag (Space let go). Coalesced events become `steps`, which the pencil
  needs for a smooth line.
- **Middle button** pans; **wheel** pans (Shift for sideways); **Ctrl, Cmd or Alt with the
  wheel**, and a trackpad pinch, zoom round the pointer; **two fingers** pinch and pan and cancel
  what one finger began. The wheel listener is added by hand as non-passive.
- **Keys** live in `StudioApp.keydown`. They're ignored in fields, selects, popovers and
  dialogs. A modifier going down or up re-sends the last move (`stage.modifiers`), so cursors and
  drags follow Shift and Alt at once. Space holds the hand (`heldTool`).
- **Buttons don't take focus from a mouse** (`onmousedown` prevents it) in the rail and the bar,
  or Space would press the last one clicked instead of panning. Keyboard focus still works.

## Panels and fields

- **`NumberField`** takes sums (`calculate` in `numbers.ts`: `120+24`, `*2`, brackets, no
  eval), steps with the arrow keys and scrubs from its label. Its `onchange(value, live)` says
  whether the change is part of a gesture, and callers turn `live` into a `merge` key.
- **`ColorWell`** opens `ColorPicker` in a popover beside it. Colours are reported as they
  change; `onclose` reports the final one, which is when it joins the recent colours (not on
  every step of a drag).
- **The inspector** works on the selection's frame (`selectionFrame`): one shape's own box,
  turned with it, or the box round several. Resizing scales about the frame's top left in the
  frame's own space.

## Surprise me

- **`surprise.ts`** makes a random picture the size of a drawing: `surprise(width, height, options)`
  with an optional `kind`, `seed` and `avoid`. Seven kinds in `SURPRISES`, each a `Maker` that composes shapes from a
  seeded random (`Roll`, mulberry32), so the same seed and size make the same picture. Colours come
  from `PALETTES`, sorted dark to light. It imports only `drawing`, `color` and `geometry`.
- **Its output is what the cleaner would keep**: coordinates rounded to two places, matrix
  entries to six, opacity to three, every colour eight digits. A scratch test runs every kind at
  every preset size (and 16 × 16 and 4096 × 16) through `cleanDrawing` and expects it back
  unchanged; do the same after changing a maker. Counts are capped (`scatter`, about 150 tiles)
  so a long thin drawing doesn't make thousands of shapes.
- **No gradients yet**, so a sky's glow is 18 faint bands stacked towards the horizon (`glow`).
  Fewer, stronger bands show as stripes.
- **`Studio.surprise(kind)`** puts a new picture on a new layer at the top, or, while the active
  layer still holds a list of shapes it made (`#made`, a `WeakSet` of the lists; any edit replaces
  a layer's list), rolls again in that layer's place. `rerolls` says which, for the bar's tooltip.
  A layer's name changes with the picture only while it's still a kind's name.
- **Judging the look**: the scratch test can also write contact sheets (each shape as SVG through
  `outline` and `pathData`), quicker to look at than the studio for dozens of seeds.

## Drafts

- **`draft.ts`**: database `bb-studio`, stores `drafts` (by key, with an `owner` index) and
  `pixels` (by `[draft, layer]`). A draft belongs to the account that made it.
- **StudioApp keeps it** 0.7 s after a change (`revision`, `paintTick` or the title), with a
  WebP picture for the shelf, and at once when the tab is hidden or the page is left. Only paint
  layers whose pixels changed are written again.
- **Paint layers** are loaded back onto canvases with `createImageBitmap`. Their canvases live in
  `Studio.paint`, kept for a deleted layer too so undo can bring it back.

## Limits

`MAX_SIDE` 4096 a side and `MAX_PIXELS` 4096² in all (Safari on iPhone limits a canvas to about
16.7 million pixels), `MAX_LAYERS` 32, paint layers by `paintLayerLimit` against a pixel budget,
`MAX_SHAPES` 5000, `MAX_ANCHORS` 60,000. The layers panel lists at most 200 shapes a layer.
Downloading at twice the size is offered only while that stays inside `MAX_PIXELS`.

## Testing

- **The rules**: `drawing`, `geometry`, `fit`, `edit`, `color` and `numbers` import nothing from
  SvelteKit, so `test-lib.mjs` runs them (see `bb-verify`). Test the cleaner with hostile input.
- **In a browser**: sign in, clear IndexedDB first
  (`indexedDB.deleteDatabase('bb-studio')`), make a drawing through the New drawing dialog, then
  drive the stage with `page.mouse` (move, down, several moves, up: a single move is one step,
  and the pencil wants many) and `page.keyboard` for tools. Read results from the panels (the
  inspector's fields, `.shape-row` in the layers list) and look at screenshots. Wait for the
  bar to say "Kept" before reloading to check the draft. For a download, set
  `Browser.setDownloadBehavior` through a CDP session and read the PNG's size from its header.
- **Checked on 2026-11-10**: 1440 and 390 wide in both themes; drawing every shape tool, the
  pen and the pencil; select, move, undo, typed sums, turning; the colour picker; a reload
  keeping everything; Alt-drag copies; a full-size PNG. Surprise me: every kind from the menu,
  rolling in place, undo and redo through rolls, rolling in place after the layer moved to the
  bottom, a new layer once drawn on, Start with a surprise, the bar at 1024 and 390.

## Things that tripped it up

- **The Set and Map lint** (`svelte/prefer-svelte-reactivity`) covers `.svelte.ts` files. Working
  sets in tools come from `pointSet` and `unique` in `path-edit.ts`; `Studio.paint` is a
  `SvelteMap`.
- **An SVG filter shifts colour** in the homepage picture: `feDropShadow` on the sky made it a
  shade off the "sky-coloured" disc that cuts the crescent moon. The shadow is on a rect of its
  own.
- **Popovers and keys**: the keyboard handler leaves `[popover]` alone, so Delete in the colour
  picker's hex field doesn't delete the selection.
