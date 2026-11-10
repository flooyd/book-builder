# Idea 25: the art studio

**Piece (a) shipped on 2026-11-10; (b), (c) and (d) are still a plan,** written 2026-11-09.
"Built" below is the record of what's there; the rest of the file is the plan it came from. How the
code works is the `bb-studio` skill. Check both against the code before leaning on them.

## What the user asked for

"I want the user to be able to upload or create custom art for their book." (2026-11-09)

And, asked what "create" should mean, the same day: "No AI generated art at this time. I want the
art studio to be like a painter/svg/vector creator and to have sophisticated tools so the user
can make their own art."

So this is a real drawing and painting program inside Book Builder: vector shapes and paths with
the tools a designer expects, and pressure-sensitive brushes for painting, in layers. Uploading is
idea 18, and what's made here is saved to the art shelf that idea builds, so it can be a cover, a
portrait, a map, a picture in the page (idea 22) or an ornament (idea 26).

## Decided

- **No generated art** (2026-11-09, "at this time"). Nothing that makes a picture from a
  description. If it ever comes back it's its own idea, with the cautions of idea 16 (cost on a
  free app, and how writers feel about it).
- **The layout is a hybrid** (2026-11-10, asked with sketches): docked panels on a wide screen
  (tools on the left, properties and layers on the right, a slim bar above), turning into a
  floating tool strip and pull-up sheets on tablets and phones.
- **Tuned first for a mouse on a computer** (2026-11-10): that's what the user will try it with.
  So strokes must look good with no pressure at all (tapering from speed), and every tool must
  work without a pen. Pens and touch still have to work.
- **Each writer's storage cap is decided at launch** (2026-11-10): build it as one setting with a
  room-left meter on the shelf, and ask for the number when the Blob store is set up.
- **Say nothing about AI on the site, either way.** On 2026-11-03 the user took "with no AI
  involved" out of the app's own pages. So the shelf card and any homepage copy describe what the
  studio does, and neither promise generated art nor make a point of its absence.

- **The libraries: none.** (Decided 2026-11-10, against the table under "Choosing libraries".) The
  studio draws with its own small Canvas 2D engine: shapes become `Path2D` from SVG path data,
  hit-testing is `isPointInPath` and `isPointInStroke`, and blend modes are
  `globalCompositeOperation`. Paper.js would have brought its own document model to keep in step
  with ours, and Fabric and Konva their own object models; none of them did the point editing or
  the handles the way the plan wanted, so those were ours either way. perfect-freehand is still
  the likely choice for pressure strokes in (b), and path operations in (c) still need a decision.

## Built

### (a), 2026-11-10

- **Pages.** `/studio` lists the drawings kept in this browser (newest first, with a picture of
  each) and starts a new one from a preset (cover, portrait, map, picture for the page,
  ornament) or a size of the writer's own, on a paper, white, night or clear ground.
  `/studio/draft/[key]` is a drawing, and has the whole window. A Studio link sits in the
  signed-in header, and the homepage has a section of its own (04).
- **Tools.** Select (move, resize from any handle, turn from outside a corner, line ends, a box to
  pick several, Alt to copy, Shift to keep proportions or angles, double-click into a group),
  points (drag points and handles, add and remove points, sharp and smooth), pen, pencil (fitted
  to smooth curves, with a smoothing setting), rectangle, ellipse, polygon, star, line and arrow,
  hand and zoom.
- **Panels.** Properties: position, size (with a ratio lock), turn, corner radius, sides, points,
  arrowheads, fill, stroke colour, width, dashes, ends and corners, opacity; with nothing
  selected, the drawing's size and ground and the style of new shapes. Fields take sums and can
  be scrubbed. Layers: show, hide, lock, rename, drag to reorder (or Alt+arrows), shapes listed
  under each layer and picked from there, a layer's opacity and blend mode (sixteen).
- **Colours.** Our own picker: saturation and brightness square, hue and opacity sliders, hex,
  the browser's eyedropper where there is one, recent colours and a palette.
- **Keys.** V A P N R O L Shift+L H Z, Space to pan, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, Ctrl+D,
  Ctrl+G and Ctrl+Shift+G, Ctrl+C X V, Ctrl+A, Delete, arrows (Shift for 10), Ctrl+[ and ] (with
  Shift to the back or front), Ctrl+0 fit, Ctrl+1 100%, Ctrl+2 fit the selection, Ctrl+= and -,
  Shift+H and Shift+V to flip, X to swap fill and stroke, D for the default colours, Esc, Enter.
- **Drafts.** Every change is kept in IndexedDB 0.7 s after it's made, with a small picture for
  the shelf, and flushed when the tab is hidden or the page is left. Drafts belong to the account
  that made them, in that browser only.
- **Download** as PNG at full size, twice the size (when that stays under 4096² pixels) or half.

### Surprise me, 2026-11-10

The user asked for it the day (a) shipped: "a random button that will randomly create art". It's
procedural, not generated art in the sense ruled out above: seven kinds of composition (night sky,
mountains, waves, tiles, cut paper, orbits, rosette), each with rules of its own, coloured from
sixteen palettes picked to go together, made of the studio's own shapes in named groups that can
be picked apart and changed. Nothing is learned or fetched.

- **In the bar**, "Surprise me" puts a picture on a new layer at the top, where it's sure to be
  seen (every kind has its own ground, so a picture under another would show nothing). While its
  layer is the active one and nobody has drawn on it, pressing again rolls another in its place,
  wherever the layer has been moved, so a picture slid behind a drawing can still be swapped. Each
  roll is an undo step. The arrow beside it picks a kind ("Any kind" doesn't repeat the last),
  remembered in this browser.
- **In New drawing**, "Start with a surprise" puts a picture on the bottom layer with an empty one
  above it to draw on.
- **On the homepage**, it's one of the studio section's four points, and the picture of the
  studio's bar shows the button.

Left out: rolling again in place after a reload (the studio only knows the pictures it made in
this visit), a seed to share or type in, and a picture made to fit a book (its title, its mood).

Left out of (a), for now:

- **Saving to the art shelf** (with a description for screen readers), which needs 18. Until
  then a drawing lives only in the browser it was made in, which the shelf page says.
- **Ways in from where art is wanted** ("Make a cover", "Draw a portrait"), which want 18 too.
- **A finger only pans once a pen is seen** (palm rejection). One finger draws; two pinch.
- **Paint layers** work in the engine, the renderer and the drafts, but the button to add one is
  hidden until (b) gives them brushes.

## What it has

Each piece can ship on its own, and the user can ask for one by letter ("25b"). (a) is the first
version worth showing; it needs idea 18 to save.

### a. The studio and its vector tools

- **An artboard** at a size that suits what it's for: a cover (1,800 × 2,700, the PDF's 6 × 9
  inch page at 300 to the inch), a portrait (square), a map (landscape), a picture for the page
  (1,300 across, the PDF's text width), or a size of the writer's own. Transparency shows as a
  checkerboard.
- **Getting around:** zoom and pan with the wheel, a pinch, or Space and drag; fit to the screen;
  100%.
- **Select and transform:** move, scale, rotate and flip with handles; select several, group and
  ungroup, duplicate, nudge with the arrow keys; exact position, size and angle in number fields.
- **Shapes:** rectangle (with rounded corners), ellipse, polygon, star, line and arrow, each
  editable after it's drawn.
- **The pen:** Bézier paths, click for a corner and drag for a curve, open or closed. **Editing
  points:** move an anchor or its handles, add and remove points, turn a corner smooth and back.
- **The pencil:** a freehand line, smoothed into a path that can be edited like any other.
- **Fill and stroke:** any colour with transparency, stroke width, dashes, caps and joins.
- **Layers:** add, reorder, hide, lock, rename, and set a layer's opacity. Bring a shape forward
  or send it back within its layer.
- **Undo and redo**, as far back as the drawing goes, and the keys designers expect (V select,
  A points, P pen, R rectangle, O ellipse, B brush, E eraser, T text, I eyedropper, Ctrl+Z,
  Ctrl+Shift+Z, Ctrl+D, Ctrl+G, [ and ] for brush size). They're off while a text field has
  focus.
- **Save** to the art shelf, with a description for screen readers. **Download** as PNG.

### b. Paint

- **Paint layers** beside the vector ones.
- **Brushes** that answer a pen's pressure (and tilt, where the device reports it): round, pencil,
  ink, marker, airbrush and chalk, with size, opacity, hardness, spacing and smoothing (a
  stabiliser for steady lines). A mouse or a finger gets the same brushes without pressure.
- **Eraser**, **fill** (a paint bucket with a tolerance), and an **eyedropper** that picks from the
  artboard.
- **Blend modes** for a layer (multiply, screen, overlay and the usual others).

### c. Finishing tools

- **Text** in the app's own typefaces, for labels on a map or words in a sigil. A cover's title
  isn't set here: idea 26 sets it over the art, so it stays sharp, and follows the book's title
  when that changes.
- **Gradients**, linear and radial, as a fill or a stroke.
- **Path operations:** unite, subtract, intersect and exclude.
- **Align and distribute**, **snapping** (to a grid, to guides, to other shapes' edges and
  centres), rulers and guides.
- **Clipping masks**, and **mirror drawing** (one, two or more axes), which makes sigils, crests
  and ornaments.

### d. Working from pictures

- **Place a picture** from the art shelf as a layer, to trace over a sketch or paint over a photo.
- **Open an uploaded picture** to paint on it.
- **Download as SVG** (the vector layers) as well as PNG, at a size the writer picks.

## How it should work

- **All of it runs in the browser.** Drawing, painting, undo and rendering never touch the server,
  which only stores what's saved. That's the user's standing preference, and the only way a
  painting program could feel right anyway.
- **Keep a draft on the device, save to the server when the writer saves.** The drawing is kept in
  IndexedDB as it's made, so a reload or a crash loses nothing, and it's sent to the server when
  the writer presses Save (and offered when they leave with unsaved work). Never on every stroke:
  each paint layer is an upload, and Blob's Hobby plan allows 2,000 a month across the whole site
  (see idea 18).
- **What a save sends.** A PNG of the drawing at its full size and a small copy, made in the
  browser, which are what the shelf, every page, the PDF and the Word file use (PDFKit draws PNG,
  so the export needs nothing new). Then what's needed to open it again: the vector layers as JSON
  in Postgres, and each paint layer that changed as a PNG in the store. Only changed layers are
  sent again.
- **Our own format for a drawing**, not a library's. A small JSON document (layers; shapes with
  SVG path data, fills, strokes and transforms; paint layers pointing at their PNGs) with a
  `version` field. It's cleaned on the server against an allow-list on every save, the way story
  text is (see `bb-rich-text`), so nothing but known shapes and values is kept. That also means
  changing library later doesn't strand anyone's drawings. Put the format and its cleaner in a
  module that imports nothing, so `test-lib.mjs` in `bb-verify` can test them.
- **Pen and touch input.**
  - Pointer events, with `pressure`, `tiltX` and `tiltY`, and `getCoalescedEvents()` so fast
    strokes stay smooth.
  - `touch-action: none` on the artboard, or the browser scrolls and zooms instead.
  - Once a pen is seen, a finger only pans and zooms, so a resting palm doesn't draw.
- **Size and memory.** Each paint layer is a canvas, and a 1,800 × 2,700 one holds about 19 MB.
  Safari on iPhone and iPad limits a canvas to about 16.7 million pixels and limits what all the
  canvases on a page may use together. So cap the artboard's size and the number of paint layers,
  and measure on an iPad before promising more.
- **Undo for paint** keeps the pixels a stroke covered, not a copy of the whole layer.
- **Lazy-loaded.** Like Tiptap in `RichEditor`, the studio and its libraries are imported when it
  opens, so no other page downloads them.

## Choosing libraries

Decide with a short trial at the start, against what the tools above need: Bézier editing, path
operations, transform handles, pen pressure, SVG out, speed with a few hundred shapes, and the
size of the download. What was on npm on 2026-11-09, all MIT:

| Package            | Version | What it's good for                                                                                                                     |
| ------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `paper`            | 0.17.0  | Vector work: Bézier paths and their points, hit-testing, path operations, layers, SVG in and out. Tools and handles are ours.          |
| `fabric`           | 7.4.0   | A finished object model: shapes, text, groups, transform handles, free drawing and SVG out. Path operations and point editing less so. |
| `konva`            | 10.9.1  | Fast canvas shapes and transforms. No SVG out.                                                                                         |
| `perfect-freehand` | 1.2.3   | Turns a pen's points and pressure into the outline of a stroke. Small, no dependencies. Suits ink and the pencil on vector layers.     |

The likely mix is Paper.js for the vector layers, perfect-freehand for pressure strokes, and our
own brush engine on canvas for paint (stamping the brush along the stroke), but the trial decides.
Whatever is chosen is drawn into the format above, never stored in its own. Excalidraw is a
whiteboard with a sketched look rather than a painter, and tldraw has its own licence rather than
MIT, so read it before considering it. Run a production build after adding any of them (see
"Adding a package" in `bb-stack`).

## Where it lives

- **Pages.** `/studio` is the writer's art shelf with "New drawing", and `/studio/[id]` a drawing.
  It's a big workspace, so it gets the whole window under a slim header, as focus mode does for
  writing.
- **The way in** is wherever art is wanted: "Make a cover" by a book's cover, "Draw a portrait" on
  a character, "Draw a map" on a place, and Picture in the editor's Insert menu (idea 24a).
- **Look.** The studio's panels follow the app's theme (see `bb-design`). The artboard shows the
  drawing's true colours in both themes, so pin it (`data-scheme`) and don't use `light-dark()`
  colours in a drawing.
- **Phones.** It has to work at 390 px with no sideways scroll, with the panels in sheets. It's
  made first for computers and tablets with a pen.
- **Accessibility.** Every tool is a labelled button with its key shown, the layers panel is a
  list that the keyboard can reorder, and a selected shape can be moved with the arrow keys and
  set in number fields. The drawing itself is pictures, so a saved one asks for a description.

## When it ships

Give it a skill of its own (the format, the tools, how saving and drafts work, the memory limits,
how to test drawing in a headless browser), and turn this file into the record of what was built.
