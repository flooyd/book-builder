// Changes to a drawing, each returning a new one: the studio never changes a drawing in place, so
// undo can keep the one before, and unchanged shapes keep their identity (which the renderer's
// caches lean on). No DOM, so it can be tested alone.

import {
	IDENTITY,
	newId,
	type Drawing,
	type GroupShape,
	type Layer,
	type Matrix,
	type Shape,
	type VectorLayer
} from '$lib/drawing';
import {
	invert,
	localBounds,
	multiply,
	shapeBounds,
	translation,
	union,
	type Bounds
} from './geometry';

/** Where a shape is: its layer, the groups it's inside (outermost first) and its place. */
export type Located = {
	layer: VectorLayer;
	layerIndex: number;
	parents: GroupShape[];
	shape: Shape;
	index: number;
	/** From the shape's parent to the drawing: its groups' transforms, outermost first. */
	matrix: Matrix;
};

function find(
	shapes: Shape[],
	id: string,
	parents: GroupShape[]
): Omit<Located, 'layer' | 'layerIndex' | 'matrix'> | null {
	for (let index = 0; index < shapes.length; index++) {
		const shape = shapes[index];
		if (shape.id === id) return { parents, shape, index };
		if (shape.kind === 'group') {
			const inside = find(shape.children, id, [...parents, shape]);
			if (inside) return inside;
		}
	}
	return null;
}

export function locate(doc: Drawing, id: string): Located | null {
	for (let layerIndex = 0; layerIndex < doc.layers.length; layerIndex++) {
		const layer = doc.layers[layerIndex];
		if (layer.kind !== 'vector') continue;
		const found = find(layer.shapes, id, []);
		if (found) {
			const matrix = found.parents.reduce<Matrix>(
				(m, group) => multiply(m, group.transform),
				IDENTITY
			);
			return { ...found, layer, layerIndex, matrix };
		}
	}
	return null;
}

export function layerOf(doc: Drawing, id: string): Layer | null {
	return doc.layers.find((layer) => layer.id === id) ?? null;
}

/** The drawing with one layer changed. */
export function mapLayer(doc: Drawing, id: string, change: (layer: Layer) => Layer): Drawing {
	let changed = false;
	const layers = doc.layers.map((layer) => {
		if (layer.id !== id) return layer;
		const next = change(layer);
		if (next !== layer) changed = true;
		return next;
	});
	return changed ? { ...doc, layers } : doc;
}

function mapList(
	shapes: Shape[],
	ids: Set<string>,
	change: (shape: Shape) => Shape | null
): Shape[] {
	let changed = false;
	const next: Shape[] = [];
	for (const shape of shapes) {
		let result: Shape | null = shape;
		if (ids.has(shape.id)) result = change(shape);
		else if (shape.kind === 'group') {
			const children = mapList(shape.children, ids, change);
			if (children !== shape.children) result = children.length ? { ...shape, children } : null;
		}
		if (result !== shape) changed = true;
		if (result) next.push(result);
	}
	return changed ? next : shapes;
}

/** The drawing with the shapes of these ids changed (null takes one out), at any depth. */
export function mapShapes(
	doc: Drawing,
	ids: Iterable<string>,
	change: (shape: Shape) => Shape | null
): Drawing {
	const wanted = new Set(ids);
	if (!wanted.size) return doc;
	let changed = false;
	const layers = doc.layers.map((layer) => {
		if (layer.kind !== 'vector') return layer;
		const shapes = mapList(layer.shapes, wanted, change);
		if (shapes === layer.shapes) return layer;
		changed = true;
		return { ...layer, shapes };
	});
	return changed ? { ...doc, layers } : doc;
}

export const removeShapes = (doc: Drawing, ids: Iterable<string>) =>
	mapShapes(doc, ids, () => null);

/** Shapes added to a layer, on top unless a place is given. */
export function insertShapes(
	doc: Drawing,
	layerId: string,
	shapes: Shape[],
	index?: number
): Drawing {
	return mapLayer(doc, layerId, (layer) => {
		if (layer.kind !== 'vector') return layer;
		const list = [...layer.shapes];
		list.splice(index ?? list.length, 0, ...shapes);
		return { ...layer, shapes: list };
	});
}

/** Of these ids, the ones not inside another of them: what moves when they're dragged. */
export function outermost(doc: Drawing, ids: string[]): string[] {
	const wanted = new Set(ids);
	return ids.filter((id) => {
		const found = locate(doc, id);
		return !!found && !found.parents.some((group) => wanted.has(group.id));
	});
}

/** The shapes of these ids, in drawing order (bottom first), with where each is. */
export function locateAll(doc: Drawing, ids: string[]): Located[] {
	return ids
		.map((id) => locate(doc, id))
		.filter((found): found is Located => !!found)
		.sort((a, b) => a.layerIndex - b.layerIndex || order(a, b));
}

function order(a: Located, b: Located) {
	// Compare their paths through the groups; a shorter one that's a prefix is the group itself.
	const pathOf = (found: Located) => [
		...found.parents.map((group, depth) => {
			const list = depth === 0 ? found.layer.shapes : found.parents[depth - 1].children;
			return list.indexOf(group);
		}),
		found.index
	];
	const left = pathOf(a);
	const right = pathOf(b);
	for (let index = 0; index < Math.min(left.length, right.length); index++) {
		if (left[index] !== right[index]) return left[index] - right[index];
	}
	return left.length - right.length;
}

/** The bounds of these shapes on the page. */
export function boundsOf(doc: Drawing, ids: string[]): Bounds | null {
	let bounds: Bounds | null = null;
	for (const found of locateAll(doc, ids))
		bounds = union(bounds, shapeBounds(found.shape, found.matrix));
	return bounds;
}

/** A copy of a shape with new ids all through it. */
export function withNewIds(shape: Shape): Shape {
	if (shape.kind === 'group')
		return { ...shape, id: newId(), children: shape.children.map(withNewIds) };
	return { ...shape, id: newId() };
}

/**
 * Moves shapes by m in the drawing's coordinates, whatever groups they're in: each one's own
 * transform is changed as its groups see it.
 */
export function transformShapes(
	doc: Drawing,
	ids: string[],
	m: Matrix,
	place: (shape: Shape, m: Matrix) => Shape
): Drawing {
	const moving = outermost(doc, ids);
	const local = new Map<string, Matrix>();
	for (const id of moving) {
		const found = locate(doc, id);
		if (!found) continue;
		const back = invert(found.matrix);
		local.set(id, back ? multiply(back, multiply(m, found.matrix)) : m);
	}
	return mapShapes(doc, moving, (shape) => place(shape, local.get(shape.id) ?? m));
}

/** Copies of the shapes, each just above its original, moved by (dx, dy). */
export function duplicateShapes(doc: Drawing, ids: string[], dx: number, dy: number) {
	const copies: string[] = [];
	let next = doc;
	for (const found of locateAll(doc, outermost(doc, ids)).reverse()) {
		const copy = withNewIds(found.shape);
		const moved = { ...copy, transform: multiply(translation(dx, dy), copy.transform) } as Shape;
		copies.unshift(moved.id);
		next = insertBeside(next, found.shape.id, moved);
	}
	return { doc: next, ids: copies };
}

/** A shape put just above another, in the same list. */
function insertBeside(doc: Drawing, besideId: string, shape: Shape): Drawing {
	const put = (shapes: Shape[]): Shape[] | null => {
		const index = shapes.findIndex((item) => item.id === besideId);
		if (index >= 0) {
			const list = [...shapes];
			list.splice(index + 1, 0, shape);
			return list;
		}
		for (let at = 0; at < shapes.length; at++) {
			const item = shapes[at];
			if (item.kind !== 'group') continue;
			const children = put(item.children);
			if (children) {
				const list = [...shapes];
				list[at] = { ...item, children };
				return list;
			}
		}
		return null;
	};
	let done = false;
	const layers = doc.layers.map((layer) => {
		if (done || layer.kind !== 'vector') return layer;
		const shapes = put(layer.shapes);
		if (!shapes) return layer;
		done = true;
		return { ...layer, shapes };
	});
	return done ? { ...doc, layers } : doc;
}

/**
 * Puts shapes in a new group, where the topmost of them was. Shapes inside other groups come out
 * of them first, keeping their place on the page.
 */
export function groupShapes(doc: Drawing, ids: string[]) {
	const found = locateAll(doc, outermost(doc, ids));
	if (!found.length) return null;
	const top = found[found.length - 1];
	const placed = found.map(
		(item) => ({ ...item.shape, transform: multiply(item.matrix, item.shape.transform) }) as Shape
	);
	const group: GroupShape = {
		id: newId(),
		name: '',
		kind: 'group',
		transform: [...IDENTITY],
		opacity: 1,
		hidden: false,
		locked: false,
		children: placed
	};
	// The group takes the topmost shape's place, among the shapes left once they're out.
	const layer = top.layer;
	const rest = removeShapes(
		doc,
		found.map((item) => item.shape.id)
	);
	const after = rest.layers.find((item) => item.id === layer.id) as VectorLayer;
	const below = layer.shapes.slice(
		0,
		top.parents.length ? layer.shapes.indexOf(top.parents[0]) + 1 : top.index
	);
	const index = after.shapes.filter((shape) => below.some((item) => item.id === shape.id)).length;
	return { doc: insertShapes(rest, layer.id, [group], index), id: group.id };
}

/** Takes the shapes out of these groups, keeping their place on the page. */
export function ungroupShapes(doc: Drawing, ids: string[]) {
	const released: string[] = [];
	let next = doc;
	for (const found of locateAll(doc, ids).reverse()) {
		const group = found.shape;
		if (group.kind !== 'group') continue;
		const children = group.children.map(
			(child) => ({ ...child, transform: multiply(group.transform, child.transform) }) as Shape
		);
		released.push(...children.map((child) => child.id));
		const swap = (shapes: Shape[]): Shape[] =>
			shapes.flatMap((shape) =>
				shape.id === group.id
					? children
					: shape.kind === 'group'
						? [{ ...shape, children: swap(shape.children) }]
						: [shape]
			);
		next = mapLayer(next, found.layer.id, (layer) =>
			layer.kind === 'vector' ? { ...layer, shapes: swap(layer.shapes) } : layer
		);
	}
	return { doc: next, ids: released };
}

export type Arrange = 'forward' | 'backward' | 'front' | 'back';

/** Moves shapes up or down among the shapes beside them. */
export function arrangeShapes(doc: Drawing, ids: string[], how: Arrange): Drawing {
	const wanted = new Set(ids);
	const arrange = (shapes: Shape[]): Shape[] => {
		let list = shapes.map((shape) =>
			shape.kind === 'group' && !wanted.has(shape.id)
				? { ...shape, children: arrange(shape.children) }
				: shape
		);
		const picked = list.filter((shape) => wanted.has(shape.id));
		if (!picked.length) return list;
		if (how === 'front') return [...list.filter((shape) => !wanted.has(shape.id)), ...picked];
		if (how === 'back') return [...picked, ...list.filter((shape) => !wanted.has(shape.id))];
		list = [...list];
		if (how === 'forward') {
			for (let index = list.length - 2; index >= 0; index--) {
				if (wanted.has(list[index].id) && !wanted.has(list[index + 1].id)) {
					[list[index], list[index + 1]] = [list[index + 1], list[index]];
				}
			}
		} else {
			for (let index = 1; index < list.length; index++) {
				if (wanted.has(list[index].id) && !wanted.has(list[index - 1].id)) {
					[list[index], list[index - 1]] = [list[index - 1], list[index]];
				}
			}
		}
		return list;
	};
	return {
		...doc,
		layers: doc.layers.map((layer) =>
			layer.kind === 'vector' ? { ...layer, shapes: arrange(layer.shapes) } : layer
		)
	};
}

/** Moves shapes, groups and all, to the top of another layer, keeping their place on the page. */
export function moveToLayer(doc: Drawing, ids: string[], layerId: string): Drawing {
	const target = layerOf(doc, layerId);
	if (!target || target.kind !== 'vector') return doc;
	const found = locateAll(doc, outermost(doc, ids));
	const placed = found.map(
		(item) => ({ ...item.shape, transform: multiply(item.matrix, item.shape.transform) }) as Shape
	);
	return insertShapes(
		removeShapes(
			doc,
			found.map((item) => item.shape.id)
		),
		layerId,
		placed
	);
}

/** The box a single shape's handles are drawn round, in its own coordinates, and where it sits. */
export function frameOf(doc: Drawing, id: string) {
	const found = locate(doc, id);
	if (!found) return null;
	const bounds = localBounds(found.shape);
	if (!bounds) return null;
	return { bounds, matrix: multiply(found.matrix, found.shape.transform) };
}
