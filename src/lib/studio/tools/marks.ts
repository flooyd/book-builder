// Shared helpers for tools' marks: shapes' outlines on screen, and the frame a selection's
// handles are drawn round.

import { IDENTITY, type Drawing, type Matrix, type Shape } from '$lib/drawing';
import { frameOf, locate, boundsOf } from '../edit';
import { multiply, outline, pathData, transformSubpaths, type Bounds } from '../geometry';

/** The outline of a shape (each piece of a group) through m, as SVG path data. */
export function outlineData(shape: Shape, m: Matrix): string {
	const placed = multiply(m, shape.transform);
	if (shape.kind === 'group')
		return shape.children.map((child) => outlineData(child, placed)).join('');
	return pathData(transformSubpaths(outline(shape), placed));
}

/** A shape's outline on screen, wherever it is in the drawing. */
export function screenOutline(doc: Drawing, id: string, view: Matrix): string | null {
	const found = locate(doc, id);
	if (!found) return null;
	return outlineData(found.shape, multiply(view, found.matrix));
}

/** The box a selection's handles go round: a shape's own (turned with it), or all of theirs. */
export type Frame = { bounds: Bounds; matrix: Matrix };

export function selectionFrame(doc: Drawing, ids: string[]): Frame | null {
	if (ids.length === 1) return frameOf(doc, ids[0]);
	const bounds = boundsOf(doc, ids);
	return bounds ? { bounds, matrix: [...IDENTITY] } : null;
}

/** The handles of a box, clockwise from the top left: corners and the middles of the sides. */
export function handlePoints(bounds: Bounds) {
	const cx = (bounds.minX + bounds.maxX) / 2;
	const cy = (bounds.minY + bounds.maxY) / 2;
	return [
		{ x: bounds.minX, y: bounds.minY },
		{ x: cx, y: bounds.minY },
		{ x: bounds.maxX, y: bounds.minY },
		{ x: bounds.maxX, y: cy },
		{ x: bounds.maxX, y: bounds.maxY },
		{ x: cx, y: bounds.maxY },
		{ x: bounds.minX, y: bounds.maxY },
		{ x: bounds.minX, y: cy }
	];
}
