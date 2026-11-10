// The art studio's state: the drawing, what's selected, the view, the tool, the style new shapes
// get, and undo. Panels read it and call its actions; tools change the drawing through it.
//
// The drawing is never changed in place (see edit.ts): an action makes a new one and `apply`
// keeps the old for undo. A drag shows each step with `live` and keeps one undo step for the
// whole drag with `settle`.

import { SvelteMap } from 'svelte/reactivity';
import {
	BLENDS,
	MAX_LAYERS,
	MAX_PIXELS,
	MAX_SHAPES,
	MAX_SIDE,
	MIN_SIDE,
	allShapes,
	newId,
	newLayer,
	paintLayerLimit,
	shapeCount,
	solid,
	type Blend,
	type Drawing,
	type Layer,
	type Matrix,
	type Paint,
	type Shape,
	type Stroke,
	type TextShape,
	type VectorLayer
} from '$lib/drawing';
import {
	arrangeShapes,
	boundsOf,
	duplicateShapes,
	groupShapes,
	insertShapes,
	locate,
	locateAll,
	mapLayer,
	mapShapes,
	moveToLayer,
	outermost,
	removeShapes,
	transformShapes,
	ungroupShapes,
	withNewIds,
	type Arrange
} from './edit';
import {
	boundsHeight,
	boundsWidth,
	multiply,
	scaling,
	transformShape,
	translation,
	type Bounds
} from './geometry';
import type { View } from './render';
import { surprise as makeSurprise, SURPRISES, type SurpriseKind } from './surprise';

export type ToolId =
	| 'select'
	| 'direct'
	| 'pen'
	| 'pencil'
	| 'rect'
	| 'ellipse'
	| 'polygon'
	| 'star'
	| 'line'
	| 'arrow'
	| 'text'
	| 'hand'
	| 'zoom';

/** What new shapes are drawn with. */
export type Style = {
	fill: string | null;
	stroke: string | null;
	strokeWidth: number;
};

/** A text's settings, for the next text and the inspector. */
export type TextSettings = Pick<
	TextShape,
	'font' | 'size' | 'bold' | 'italic' | 'align' | 'leading' | 'tracking'
>;

/** Text being typed into on the stage. */
export type Typing = {
	id: string;
	/** The drawing and selection before it began: the whole of the typing is one undo step. */
	origin: Drawing;
	selection: string[];
	/** Made for this typing, so it leaves nothing behind if nothing's typed. */
	fresh: boolean;
	/** Where the caret starts: a place in the words, or all of them picked. */
	caret: number | 'all';
};

type Entry = {
	before: Drawing;
	after: Drawing;
	selectionBefore: string[];
	selectionAfter: string[];
	/** Steps with the same key close together (nudges) become one. */
	merge?: string;
	time: number;
};

const HISTORY_LIMIT = 300;
export const ZOOM_MIN = 0.02;
export const ZOOM_MAX = 64;

/** Shapes copied in the studio, kept for pasting into any drawing in this tab. */
let clipboard: Shape[] = [];

export class Studio {
	doc = $state.raw<Drawing>(null!);
	selection = $state.raw<string[]>([]);
	activeLayerId = $state('');
	toolId = $state<ToolId>('select');
	/** The tool to go back to when a held key (Space for the hand) is let go. */
	heldTool = $state<ToolId | null>(null);
	view = $state.raw<View>({ x: 0, y: 0, zoom: 1 });
	/** The stage's size on screen, in CSS pixels. */
	stage = $state.raw({ width: 0, height: 0 });
	style = $state<Style>({ fill: '#e8b04bff', stroke: '#1d2142ff', strokeWidth: 4 });
	/** Colours used lately, newest first. */
	recent = $state<string[]>([]);
	/** The shape under the pointer, outlined to show what a click would pick. */
	hoverId = $state<string | null>(null);
	/** A shape being drawn, shown on the active layer before it's added. */
	sketch = $state.raw<Shape | null>(null);
	/** Text being typed into on the stage, if any. */
	typing = $state.raw<Typing | null>(null);
	/** What the next text is set in. A size of 0 is a twelfth of the drawing's shorter side. */
	textDefaults = $state<TextSettings>({
		font: 'gloock',
		size: 0,
		bold: false,
		italic: false,
		align: 'left',
		leading: 1.2,
		tracking: 0
	});
	/** A paint layer's pixels, by layer id. Kept for a deleted layer too, so undo can bring it back. */
	readonly paint = new SvelteMap<string, HTMLCanvasElement>();
	/** Counts changes to paint layers' pixels, so the stage knows to draw again. */
	paintTick = $state(0);
	/** Counts every change to the drawing, for the draft to be kept. */
	revision = $state(0);

	#undo: Entry[] = $state.raw([]);
	#redo: Entry[] = $state.raw([]);
	/**
	 * The pictures "Surprise me" made, by their lists of shapes. Edits replace a layer's list, so a
	 * layer still holding one of these is a picture nobody has drawn on.
	 */
	readonly #made = new WeakSet<Shape[]>();
	#lastKind: SurpriseKind | null = null;

	canUndo = $derived(this.#undo.length > 0);
	canRedo = $derived(this.#redo.length > 0);
	activeLayer = $derived(this.doc.layers.find((layer) => layer.id === this.activeLayerId) ?? null);
	/** Whether "Surprise me" now rolls the active layer's picture again, in its place. */
	rerolls = $derived.by(() => {
		const layer = this.activeLayer;
		return (
			layer?.kind === 'vector' && !layer.hidden && !layer.locked && this.#made.has(layer.shapes)
		);
	});
	selected = $derived(locateAll(this.doc, this.selection));
	selectionBounds = $derived(boundsOf(this.doc, this.selection));
	tool = $derived(this.heldTool ?? this.toolId);

	constructor(doc: Drawing) {
		this.doc = doc;
		const top =
			[...doc.layers].reverse().find((layer) => layer.kind === 'vector') ?? doc.layers.at(-1);
		this.activeLayerId = top?.id ?? '';
	}

	// ---- Changing the drawing -------------------------------------------------------------------------

	/** A change, kept for undo. */
	apply(next: Drawing, selection = this.selection, merge?: string) {
		if (next === this.doc && selection === this.selection) return;
		const last = this.#undo.at(-1);
		const now = Date.now();
		if (merge && last?.merge === merge && now - last.time < 1200) {
			this.#undo = [
				...this.#undo.slice(0, -1),
				{ ...last, after: next, selectionAfter: selection, time: now }
			];
		} else {
			const entry: Entry = {
				before: this.doc,
				after: next,
				selectionBefore: this.selection,
				selectionAfter: selection,
				merge,
				time: now
			};
			this.#undo = [...this.#undo, entry].slice(-HISTORY_LIMIT);
		}
		this.#redo = [];
		this.doc = next;
		this.selection = selection;
		this.#keepActiveLayer();
		this.revision++;
	}

	/** A step of a drag, shown but not yet kept. */
	live(next: Drawing, selection = this.selection) {
		this.doc = next;
		this.selection = selection;
	}

	/** The end of a drag: one undo step from where it began. */
	settle(before: Drawing, selectionBefore: string[]) {
		if (before === this.doc) return;
		const after = this.doc;
		const selection = this.selection;
		this.doc = before;
		this.selection = selectionBefore;
		this.apply(after, selection);
	}

	undo() {
		// Undo while typing takes back the typing (or, if nothing was typed, the empty text).
		if (this.endTyping() === 'dropped') return;
		const entry = this.#undo.at(-1);
		if (!entry) return;
		this.#undo = this.#undo.slice(0, -1);
		this.#redo = [...this.#redo, entry];
		this.doc = entry.before;
		this.selection = entry.selectionBefore.filter((id) => locate(entry.before, id));
		this.#keepActiveLayer();
		this.revision++;
	}

	redo() {
		this.endTyping();
		const entry = this.#redo.at(-1);
		if (!entry) return;
		this.#redo = this.#redo.slice(0, -1);
		this.#undo = [...this.#undo, entry];
		this.doc = entry.after;
		this.selection = entry.selectionAfter.filter((id) => locate(entry.after, id));
		this.#keepActiveLayer();
		this.revision++;
	}

	/** Keeps the active layer one that exists, preferring the selection's. */
	#keepActiveLayer() {
		const first = this.selection.length ? locate(this.doc, this.selection[0]) : null;
		if (first) this.activeLayerId = first.layer.id;
		else if (!this.doc.layers.some((layer) => layer.id === this.activeLayerId)) {
			this.activeLayerId = this.doc.layers.at(-1)?.id ?? '';
		}
	}

	// ---- The view --------------------------------------------------------------------------------------

	toDrawing(x: number, y: number) {
		return { x: (x - this.view.x) / this.view.zoom, y: (y - this.view.y) / this.view.zoom };
	}

	toScreen(x: number, y: number) {
		return { x: x * this.view.zoom + this.view.x, y: y * this.view.zoom + this.view.y };
	}

	/** Drawing coordinates to the stage's CSS pixels, as a matrix. */
	viewMatrix(): Matrix {
		const { x, y, zoom } = this.view;
		return [zoom, 0, 0, zoom, x, y];
	}

	/** Zooms to a level, keeping the point (x, y) on the stage where it is. */
	zoomTo(zoom: number, x = this.stage.width / 2, y = this.stage.height / 2) {
		const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
		const point = this.toDrawing(x, y);
		this.view = { zoom: next, x: x - point.x * next, y: y - point.y * next };
	}

	zoomBy(factor: number, x?: number, y?: number) {
		this.zoomTo(this.view.zoom * factor, x, y);
	}

	/** The next level up or down from the usual steps (25%, 50%, 100%…). */
	zoomStep(direction: 1 | -1) {
		const steps = [
			0.02, 0.05, 0.1, 0.125, 0.25, 0.333, 0.5, 0.667, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32, 64
		];
		const now = this.view.zoom;
		const next =
			direction > 0
				? (steps.find((step) => step > now * 1.01) ?? ZOOM_MAX)
				: ([...steps].reverse().find((step) => step < now * 0.99) ?? ZOOM_MIN);
		this.zoomTo(next);
	}

	pan(dx: number, dy: number) {
		this.view = { ...this.view, x: this.view.x + dx, y: this.view.y + dy };
	}

	/** Shows the whole drawing (or a part of it) as large as fits, with a margin. */
	fit(bounds?: Bounds | null, margin = 48) {
		const box = bounds ?? { minX: 0, minY: 0, maxX: this.doc.width, maxY: this.doc.height };
		const width = Math.max(1, boundsWidth(box));
		const height = Math.max(1, boundsHeight(box));
		const room = {
			width: Math.max(80, this.stage.width - margin * 2),
			height: Math.max(80, this.stage.height - margin * 2)
		};
		const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, room.width / width, room.height / height));
		this.view = {
			zoom,
			x: (this.stage.width - width * zoom) / 2 - box.minX * zoom,
			y: (this.stage.height - height * zoom) / 2 - box.minY * zoom
		};
	}

	// ---- Selection ---------------------------------------------------------------------------------------

	select(ids: string[]) {
		this.selection = ids;
		this.#keepActiveLayer();
	}

	selectAll() {
		const layer = this.activeLayer;
		const shapes =
			layer?.kind === 'vector' && !layer.locked && !layer.hidden
				? layer.shapes.filter((shape) => !shape.locked && !shape.hidden)
				: [];
		this.select(shapes.map((shape) => shape.id));
	}

	// ---- Shapes ------------------------------------------------------------------------------------------

	/** The vector layer new shapes go on: the active one, or a new one above it if that's paint. */
	vectorLayerForDrawing(): { doc: Drawing; layerId: string } {
		const layer = this.activeLayer;
		if (layer?.kind === 'vector' && !layer.locked) return { doc: this.doc, layerId: layer.id };
		const added = newLayer('vector', this.#nextLayerName('vector'));
		const index = layer ? this.doc.layers.indexOf(layer) + 1 : this.doc.layers.length;
		const layers = [...this.doc.layers];
		layers.splice(index, 0, added);
		return { doc: { ...this.doc, layers }, layerId: added.id };
	}

	/** Adds a finished shape, on top of the active vector layer, and selects it. */
	addShape(shape: Shape) {
		const { doc, layerId } = this.vectorLayerForDrawing();
		this.activeLayerId = layerId;
		this.apply(insertShapes(doc, layerId, [shape]), [shape.id]);
	}

	// ---- Text --------------------------------------------------------------------------------------------

	/** The size a new text is set in. */
	textSize() {
		return (
			this.textDefaults.size ||
			Math.max(8, Math.round(Math.min(this.doc.width, this.doc.height) / 12))
		);
	}

	/**
	 * A new, empty text with the middle of its first line at (x, y), typed into at once. It's
	 * coloured with the fill for new shapes (or the stroke's colour, with no fill), and no outline.
	 */
	addText(x: number, y: number) {
		this.endTyping();
		const origin = this.doc;
		const selection = this.selection;
		const settings = { ...this.textDefaults, size: this.textSize() };
		const color = this.style.fill ?? this.style.stroke ?? '#1d2142ff';
		const shape: TextShape = {
			id: newId(),
			name: '',
			transform: translation(x, y - (settings.size * settings.leading) / 2),
			opacity: 1,
			hidden: false,
			locked: false,
			fill: solid(color),
			stroke: null,
			kind: 'text',
			text: '',
			...settings
		};
		const { doc, layerId } = this.vectorLayerForDrawing();
		this.activeLayerId = layerId;
		this.live(insertShapes(doc, layerId, [shape]), [shape.id]);
		this.typing = { id: shape.id, origin, selection, fresh: true, caret: 0 };
	}

	/** Starts typing into a text that's there already. */
	editText(id: string, caret: Typing['caret'] = 'all') {
		const found = locate(this.doc, id);
		if (found?.shape.kind !== 'text' || found.shape.locked || found.layer.locked) return;
		if (this.typing?.id === id) return;
		this.endTyping();
		this.select([id]);
		this.typing = { id, origin: this.doc, selection: this.selection, fresh: false, caret };
	}

	/** The words of the text being typed into, as they change. Kept as a draft, but not yet a step. */
	type(text: string) {
		const typing = this.typing;
		if (!typing) return;
		this.live(
			mapShapes(this.doc, [typing.id], (shape) =>
				shape.kind === 'text' ? { ...shape, text } : shape
			)
		);
		this.revision++;
	}

	/**
	 * Stops typing: what was typed becomes one undo step. A text left empty goes, and one made for
	 * this typing then leaves no step at all ('dropped').
	 */
	endTyping(): 'kept' | 'dropped' | null {
		const typing = this.typing;
		if (!typing) return null;
		this.typing = null;
		const found = locate(this.doc, typing.id);
		const empty = found?.shape.kind === 'text' && !found.shape.text.trim();
		if (empty && typing.fresh) {
			this.live(typing.origin, typing.selection);
			this.select(typing.selection.filter((id) => locate(typing.origin, id)));
			this.revision++;
			return 'dropped';
		}
		if (empty) this.live(removeShapes(this.doc, [typing.id]), []);
		this.settle(typing.origin, typing.selection);
		return 'kept';
	}

	/** Changes the selected texts' settings, and the next text's. */
	changeText(change: Partial<TextSettings>, merge?: string) {
		Object.assign(this.textDefaults, change);
		this.changeSelected(
			(shape) => (shape.kind === 'text' ? { ...shape, ...change } : shape),
			merge
		);
	}

	/** A typeface arrived: texts are measured again, so their boxes and the picture follow. */
	refreshText() {
		this.doc = { ...this.doc };
	}

	/** The fill and stroke a new shape gets, from the style. */
	newPaint(): { fill: Paint | null; stroke: Stroke | null } {
		return {
			fill: this.style.fill ? solid(this.style.fill) : null,
			stroke: this.style.stroke ? this.strokeOf(this.style.stroke, this.style.strokeWidth) : null
		};
	}

	strokeOf(color: string, width: number): Stroke {
		return { paint: solid(color), width, cap: 'round', join: 'round', dash: [] };
	}

	/** Moves, scales or turns the selection by m, in the drawing's coordinates. */
	transformSelection(m: Matrix, merge?: string) {
		this.apply(transformShapes(this.doc, this.selection, m, transformShape), this.selection, merge);
	}

	nudge(dx: number, dy: number) {
		if (!this.selection.length) return;
		this.transformSelection(translation(dx, dy), 'nudge');
	}

	flip(horizontal: boolean) {
		const bounds = this.selectionBounds;
		if (!bounds) return;
		const cx = (bounds.minX + bounds.maxX) / 2;
		const cy = (bounds.minY + bounds.maxY) / 2;
		this.transformSelection(horizontal ? scaling(-1, 1, cx, cy) : scaling(1, -1, cx, cy));
	}

	deleteSelection() {
		if (!this.selection.length) return;
		this.apply(removeShapes(this.doc, this.selection), []);
	}

	duplicateSelection() {
		if (!this.selection.length) return;
		const offset = 20 / this.view.zoom;
		const result = duplicateShapes(this.doc, this.selection, offset, offset);
		this.apply(result.doc, result.ids);
	}

	group() {
		if (!this.selection.length) return;
		const result = groupShapes(this.doc, this.selection);
		if (result) this.apply(result.doc, [result.id]);
	}

	ungroup() {
		const groups = this.selection.filter((id) => locate(this.doc, id)?.shape.kind === 'group');
		if (!groups.length) return;
		const result = ungroupShapes(this.doc, groups);
		const others = this.selection.filter((id) => !groups.includes(id));
		this.apply(result.doc, [...others, ...result.ids]);
	}

	arrange(how: Arrange) {
		if (!this.selection.length) return;
		this.apply(arrangeShapes(this.doc, this.selection, how));
	}

	/** Changes each selected shape (any depth), for the inspector. */
	changeSelected(change: (shape: Shape) => Shape, merge?: string) {
		if (!this.selection.length) return;
		this.apply(mapShapes(this.doc, this.selection, change), this.selection, merge);
	}

	/** Changes one shape (its name, whether it's hidden or locked), wherever it is. */
	changeShape(
		id: string,
		change: Partial<Pick<Shape, 'name' | 'hidden' | 'locked' | 'opacity'>>,
		merge?: string
	) {
		const next = mapShapes(this.doc, [id], (shape) => ({ ...shape, ...change }) as Shape);
		const selection =
			change.hidden || change.locked
				? this.selection.filter((item) => item !== id)
				: this.selection;
		this.apply(next, selection, merge);
	}

	/** Sets the fill of the selection and of shapes to come. null takes it away. */
	setFill(color: string | null, merge?: string) {
		this.style.fill = color;
		this.changeSelected((shape) => {
			if (shape.kind === 'line' || shape.kind === 'group') return shape;
			return { ...shape, fill: color ? solid(color) : null };
		}, merge);
	}

	/** Sets the stroke colour of the selection and of shapes to come. null takes it away. */
	setStroke(color: string | null, merge?: string) {
		this.style.stroke = color;
		this.changeSelected((shape) => {
			if (shape.kind === 'group') return shape;
			if (!color) return shape.kind === 'line' ? shape : { ...shape, stroke: null };
			const stroke = shape.stroke
				? { ...shape.stroke, paint: solid(color) }
				: this.strokeOf(color, this.style.strokeWidth);
			return { ...shape, stroke };
		}, merge);
	}

	/** Changes the selection's strokes (width, dashes, ends). */
	changeStroke(change: (stroke: Stroke) => Stroke, merge?: string) {
		this.changeSelected((shape) => {
			if (shape.kind === 'group' || !shape.stroke) return shape;
			return { ...shape, stroke: change(shape.stroke) };
		}, merge);
	}

	remember(color: string) {
		this.recent = [color, ...this.recent.filter((item) => item !== color)].slice(0, 12);
	}

	copy() {
		// Each keeps its place on the page: the transforms of the groups it was in go into its own.
		clipboard = locateAll(this.doc, outermost(this.doc, this.selection)).map(
			(item) => ({ ...item.shape, transform: multiply(item.matrix, item.shape.transform) }) as Shape
		);
		return clipboard.length;
	}

	cut() {
		if (this.copy()) this.deleteSelection();
	}

	paste() {
		if (!clipboard.length) return;
		const { doc, layerId } = this.vectorLayerForDrawing();
		const copies = clipboard.map(withNewIds);
		this.activeLayerId = layerId;
		this.apply(
			insertShapes(doc, layerId, copies),
			copies.map((shape) => shape.id)
		);
	}

	moveSelectionToLayer(layerId: string) {
		if (!this.selection.length) return;
		this.apply(moveToLayer(this.doc, this.selection, layerId));
		this.activeLayerId = layerId;
	}

	// ---- Layers ------------------------------------------------------------------------------------------

	#nextLayerName(kind: 'vector' | 'paint') {
		const base = kind === 'vector' ? 'Layer' : 'Paint';
		const taken = this.doc.layers.map((layer) => layer.name);
		let number = this.doc.layers.filter((layer) => layer.kind === kind).length + 1;
		while (taken.includes(`${base} ${number}`)) number++;
		return `${base} ${number}`;
	}

	paintLayerRoom() {
		const used = this.doc.layers.filter((layer) => layer.kind === 'paint').length;
		return paintLayerLimit(this.doc.width, this.doc.height) - used;
	}

	/** Adds a layer above the active one and makes it active. */
	addLayer(kind: 'vector' | 'paint') {
		if (kind === 'paint' && this.paintLayerRoom() <= 0) return null;
		const layer = newLayer(kind, this.#nextLayerName(kind));
		if (layer.kind === 'paint') this.ensurePaint(layer.id);
		const active = this.activeLayer;
		const index = active ? this.doc.layers.indexOf(active) + 1 : this.doc.layers.length;
		const layers = [...this.doc.layers];
		layers.splice(index, 0, layer);
		this.apply({ ...this.doc, layers }, []);
		this.activeLayerId = layer.id;
		return layer;
	}

	/** A paint layer's canvas, made empty at the drawing's size if it has none yet. */
	ensurePaint(layerId: string) {
		let canvas = this.paint.get(layerId);
		if (!canvas) {
			canvas = document.createElement('canvas');
			canvas.width = this.doc.width;
			canvas.height = this.doc.height;
			this.paint.set(layerId, canvas);
		}
		return canvas;
	}

	removeLayer(id: string) {
		if (this.doc.layers.length <= 1) return;
		const index = this.doc.layers.findIndex((layer) => layer.id === id);
		if (index < 0) return;
		const layers = this.doc.layers.filter((layer) => layer.id !== id);
		const selection = this.selection.filter(
			(shapeId) => locate(this.doc, shapeId)?.layer.id !== id
		);
		this.apply({ ...this.doc, layers }, selection);
		this.activeLayerId = layers[Math.max(0, index - 1)].id;
	}

	changeLayer(
		id: string,
		change: Partial<Pick<Layer, 'name' | 'hidden' | 'locked' | 'opacity' | 'blend'>>,
		merge?: string
	) {
		const next = mapLayer(this.doc, id, (layer) => ({ ...layer, ...change }) as Layer);
		// A hidden or locked layer's shapes can't stay selected.
		const selection =
			change.hidden || change.locked
				? this.selection.filter((shapeId) => locate(next, shapeId)?.layer.id !== id)
				: this.selection;
		this.apply(next, selection, merge);
	}

	setBlend(id: string, blend: string) {
		if ((BLENDS as readonly string[]).includes(blend))
			this.changeLayer(id, { blend: blend as Blend });
	}

	/** Moves a layer up (towards the top) or down by places. */
	moveLayer(id: string, by: number) {
		const index = this.doc.layers.findIndex((layer) => layer.id === id);
		const to = Math.max(0, Math.min(this.doc.layers.length - 1, index + by));
		if (index < 0 || to === index) return;
		const layers = [...this.doc.layers];
		const [layer] = layers.splice(index, 1);
		layers.splice(to, 0, layer);
		this.apply({ ...this.doc, layers });
	}

	/** Puts a layer at a place in the list, bottom first. */
	placeLayer(id: string, to: number) {
		const index = this.doc.layers.findIndex((layer) => layer.id === id);
		if (index < 0) return;
		this.moveLayer(id, to - index);
	}

	duplicateLayer(id: string) {
		const layer = this.doc.layers.find((item) => item.id === id);
		if (!layer) return;
		if (layer.kind === 'paint' && this.paintLayerRoom() <= 0) return;
		const fresh = { id: newLayer(layer.kind, '').id, name: `${layer.name} copy` };
		const copy: Layer =
			layer.kind === 'vector'
				? { ...layer, ...fresh, shapes: layer.shapes.map(withNewIds) }
				: { ...layer, ...fresh };
		if (copy.kind === 'paint') {
			const source = this.paint.get(layer.id);
			const canvas = this.ensurePaint(copy.id);
			if (source) canvas.getContext('2d')!.drawImage(source, 0, 0);
		}
		const index = this.doc.layers.indexOf(layer) + 1;
		const layers = [...this.doc.layers];
		layers.splice(index, 0, copy);
		this.apply({ ...this.doc, layers }, []);
		this.activeLayerId = copy.id;
	}

	/**
	 * A random picture (see surprise.ts) on a new layer at the top, where it's sure to be seen,
	 * which becomes the active layer. While the active layer holds a picture nobody has drawn on,
	 * it rolls again in its place instead, keeping the layer where it is, so a picture moved down
	 * behind a drawing can still be swapped. Each roll is a step of its own, so undo goes back
	 * through them. False when the drawing has no room for it.
	 */
	surprise(kind: SurpriseKind | 'any') {
		const active = this.activeLayer;
		const old = this.rerolls && active?.kind === 'vector' ? active : null;
		const art = makeSurprise(this.doc.width, this.doc.height, { kind, avoid: this.#lastKind });
		const replacing = old ? [...allShapes(old.shapes)].length : 0;
		if (shapeCount(this.doc) - replacing + [...allShapes(art.shapes)].length > MAX_SHAPES) {
			return false;
		}
		let next: Drawing;
		let layerId: string;
		if (old) {
			// A name the writer gave it stays; the name of the kind changes with the picture.
			const named = !SURPRISES.some((item) => item.label === old.name);
			layerId = old.id;
			next = mapLayer(this.doc, layerId, () => ({
				...old,
				name: named ? old.name : art.label,
				shapes: art.shapes
			}));
		} else {
			if (this.doc.layers.length >= MAX_LAYERS) return false;
			const layer: VectorLayer = {
				...(newLayer('vector', art.label) as VectorLayer),
				shapes: art.shapes
			};
			layerId = layer.id;
			next = { ...this.doc, layers: [...this.doc.layers, layer] };
		}
		this.#made.add(art.shapes);
		this.#lastKind = art.kind;
		this.apply(next, []);
		this.activeLayerId = layerId;
		return true;
	}

	setBackground(color: string | null, merge?: string) {
		this.apply({ ...this.doc, background: color }, this.selection, merge);
	}

	/**
	 * Changes the artboard's size. Shapes stay where they are (a smaller board crops them, and
	 * they're still there if it grows again); paint layers keep their pixels from the top left.
	 */
	resizeDrawing(width: number, height: number, merge?: string) {
		const w = Math.round(Math.max(MIN_SIDE, Math.min(MAX_SIDE, width)));
		const h = Math.round(Math.max(MIN_SIDE, Math.min(MAX_SIDE, height)));
		if ((w === this.doc.width && h === this.doc.height) || w * h > MAX_PIXELS) return;
		for (const [id, canvas] of this.paint) {
			const next = document.createElement('canvas');
			next.width = w;
			next.height = h;
			next.getContext('2d')!.drawImage(canvas, 0, 0);
			this.paint.set(id, next);
		}
		this.apply({ ...this.doc, width: w, height: h }, this.selection, merge);
		this.paintTick++;
	}
}
