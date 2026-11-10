// The studio's tools, with the names, keys and icons the tool rail shows.

import type { IconName } from '$lib/components/ui/Icon.svelte';
import type { Studio, ToolId } from '../studio.svelte';
import { DirectTool } from './direct.svelte';
import { PencilTool } from './pencil.svelte';
import { PenTool } from './pen.svelte';
import { SelectTool } from './select.svelte';
import { ShapeTool } from './shape.svelte';
import { TextTool } from './text.svelte';
import type { Tool } from './tool';
import { HandTool, ZoomTool } from './view.svelte';

export type ToolInfo = { id: ToolId; label: string; key: string; icon: IconName };

export const TOOL_INFO: Record<ToolId, ToolInfo> = {
	select: { id: 'select', label: 'Select', key: 'V', icon: 'cursor' },
	direct: { id: 'direct', label: 'Edit points', key: 'A', icon: 'points' },
	pen: { id: 'pen', label: 'Pen', key: 'P', icon: 'pen-nib' },
	pencil: { id: 'pencil', label: 'Pencil', key: 'N', icon: 'pencil' },
	rect: { id: 'rect', label: 'Rectangle', key: 'R', icon: 'square' },
	ellipse: { id: 'ellipse', label: 'Ellipse', key: 'O', icon: 'circle' },
	polygon: { id: 'polygon', label: 'Polygon', key: '', icon: 'hexagon' },
	star: { id: 'star', label: 'Star', key: '', icon: 'star' },
	line: { id: 'line', label: 'Line', key: 'L', icon: 'slash' },
	arrow: { id: 'arrow', label: 'Arrow', key: 'Shift+L', icon: 'arrow-up-right' },
	text: { id: 'text', label: 'Text', key: 'T', icon: 'type' },
	hand: { id: 'hand', label: 'Hand', key: 'H', icon: 'hand' },
	zoom: { id: 'zoom', label: 'Zoom', key: 'Z', icon: 'search' }
};

/** The tools drawn in one slot of the rail, the last used showing. */
export const SHAPE_TOOLS: ToolId[] = ['rect', 'ellipse', 'polygon', 'star', 'line', 'arrow'];

/** The rail, top to bottom: single tools, and the shapes' slot. */
export const RAIL: (ToolId | 'shapes')[] = [
	'select',
	'direct',
	'pen',
	'pencil',
	'shapes',
	'text',
	'hand',
	'zoom'
];

export function makeTools(studio: Studio): Record<ToolId, Tool> {
	return {
		select: new SelectTool(studio),
		direct: new DirectTool(studio),
		pen: new PenTool(studio),
		pencil: new PencilTool(studio),
		rect: new ShapeTool(studio, 'rect'),
		ellipse: new ShapeTool(studio, 'ellipse'),
		polygon: new ShapeTool(studio, 'polygon'),
		star: new ShapeTool(studio, 'star'),
		line: new ShapeTool(studio, 'line'),
		arrow: new ShapeTool(studio, 'arrow'),
		text: new TextTool(studio),
		hand: new HandTool(studio),
		zoom: new ZoomTool(studio)
	};
}

/** The tool a key picks, if any (no Ctrl or Cmd). */
export function toolForKey(key: string, shift: boolean): ToolId | null {
	const upper = key.toUpperCase();
	if (shift) return upper === 'L' ? 'arrow' : null;
	const found = Object.values(TOOL_INFO).find((info) => info.key === upper);
	return found?.id ?? null;
}
