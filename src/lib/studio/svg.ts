// A drawing as an SVG file: its shapes stay vectors (paths, lines, text), so they can be opened
// and changed in another drawing program, at any size. Placed pictures and paint layers are pixels,
// so they go in as pictures inside the file.
//
// It's drawn the way the canvas draws it (see render.ts). A shape's opacity is passed down to the
// paint of each shape inside it, as the canvas does, so overlapping shapes in a half-clear group
// show through each other; a layer's opacity and blend apply to the layer as a whole.
//
// `drawingSvg` builds the text from what it's given and needs no browser, so it can be tested
// alone; `svgFile` gathers the pixels in the browser and calls it.

import {
	TEXT_FONTS,
	type Drawing,
	type ImageShape,
	type LineShape,
	type Matrix,
	type Shape,
	type Stroke,
	type TextFont,
	type TextShape
} from '$lib/drawing';
import { outline, pathData } from './geometry';
import { lineParts } from './render';
import { layoutText, lineStart } from './text';

/** Pictures as data URLs: placed pictures by their id, paint layers by the layer's id. */
export type SvgPixels = {
	pictures: ReadonlyMap<string, string>;
	paint: ReadonlyMap<string, string>;
};

/** How each typeface is asked for from Google Fonts, in the weights and styles a text can use. */
const FONT_SPECS: Record<TextFont, string> = {
	gloock: 'Gloock',
	newsreader: 'Newsreader:ital,wght@0,400;0,700;1,400;1,700',
	playfair: 'Playfair+Display:ital,wght@0,400;0,700;1,400;1,700',
	cinzel: 'Cinzel:wght@400;700',
	grotesk: 'Schibsted+Grotesk:ital,wght@0,400;0,700;1,400;1,700',
	bebas: 'Bebas+Neue',
	orbitron: 'Orbitron:wght@400;700',
	caveat: 'Caveat:wght@400;700'
};

const number = (value: number) => {
	const rounded = Math.round(value * 1000) / 1000;
	return Object.is(rounded, -0) ? '0' : String(rounded);
};

/** Characters XML can't hold at all: control characters other than tab and the line breaks. */
const unholdable = (code: number) =>
	(code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 0xfffe || code === 0xffff;

/** Text for XML, in content or in a double-quoted attribute. */
export function escapeXml(text: string) {
	let kept = '';
	for (const letter of text) if (!unholdable(letter.charCodeAt(0))) kept += letter;
	return kept
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/** "#rrggbbaa" as an SVG colour and its opacity (older programs don't read eight-digit colours). */
function colour(value: string) {
	const rgb = value.slice(0, 7);
	const alpha = value.length === 9 ? parseInt(value.slice(7), 16) / 255 : 1;
	return { rgb, alpha };
}

const isIdentity = (m: Matrix) =>
	m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 && m[4] === 0 && m[5] === 0;

function transformOf(m: Matrix) {
	return isIdentity(m) ? '' : ` transform="matrix(${m.map(number).join(' ')})"`;
}

function fillOf(color: string | null | undefined, alpha: number, rule?: 'nonzero' | 'evenodd') {
	if (!color) return ' fill="none"';
	const { rgb, alpha: own } = colour(color);
	const opacity = own * alpha;
	return (
		` fill="${rgb}"` +
		(opacity < 1 ? ` fill-opacity="${number(opacity)}"` : '') +
		(rule === 'evenodd' ? ' fill-rule="evenodd"' : '')
	);
}

function strokeOf(stroke: Stroke | null, alpha: number) {
	if (!stroke || stroke.width <= 0) return '';
	const { rgb, alpha: own } = colour(stroke.paint.color);
	const opacity = own * alpha;
	let out = ` stroke="${rgb}" stroke-width="${number(stroke.width)}"`;
	if (opacity < 1) out += ` stroke-opacity="${number(opacity)}"`;
	if (stroke.cap !== 'butt') out += ` stroke-linecap="${stroke.cap}"`;
	if (stroke.join !== 'miter') out += ` stroke-linejoin="${stroke.join}"`;
	else out += ' stroke-miterlimit="10"';
	if (stroke.dash.length) {
		out += ` stroke-dasharray="${stroke.dash.map((part) => number(part * stroke.width)).join(' ')}"`;
	}
	return out;
}

function lineSvg(shape: LineShape, alpha: number, at: string) {
	if (!shape.stroke) return '';
	const { x1, y1, x2, y2, heads } = lineParts(shape);
	let out = `<path${at} d="M${number(x1)} ${number(y1)}L${number(x2)} ${number(y2)}" fill="none"${strokeOf(shape.stroke, alpha)}/>`;
	for (const head of heads) {
		const points = head.map(([x, y]) => `${number(x)},${number(y)}`).join(' ');
		out += `<polygon${at} points="${points}"${fillOf(shape.stroke.paint.color, alpha)}/>`;
	}
	return out;
}

/**
 * A text, a line to an element, set from the top left as the canvas sets it. Lines are placed by
 * the text's alignment rather than by measured widths, so they still line up where the file is
 * opened in a different typeface. The outline goes under the letters, as on the canvas.
 */
function textSvg(shape: TextShape, alpha: number, at: string, fonts: Set<TextFont>) {
	if (!shape.fill && !shape.stroke) return '';
	fonts.add(shape.font);
	const layout = layoutText(shape);
	const family = TEXT_FONTS.find((font) => font.key === shape.font)?.family ?? TEXT_FONTS[0].family;
	const spacing = shape.tracking * shape.size;
	const anchor = shape.align === 'center' ? 'middle' : shape.align === 'right' ? 'end' : 'start';
	let style =
		` font-family="${escapeXml(family)}" font-size="${number(shape.size)}"` +
		(shape.bold ? ' font-weight="700"' : '') +
		(shape.italic ? ' font-style="italic"' : '') +
		(spacing ? ` letter-spacing="${number(spacing)}"` : '') +
		(anchor === 'start' ? '' : ` text-anchor="${anchor}"`) +
		' dominant-baseline="central"' +
		fillOf(shape.fill?.color, alpha) +
		strokeOf(shape.stroke, alpha) +
		(shape.stroke && shape.fill ? ' paint-order="stroke"' : '');
	// Spaces kept as typed, the old way and the new.
	style += ' xml:space="preserve" style="white-space:pre"';
	let lines = '';
	layout.lines.forEach((line, index) => {
		if (!line.text) return;
		// The letters' spacing comes after the last letter too, so it's allowed for when the line
		// is set from its middle or its end.
		const x =
			anchor === 'start'
				? lineStart(shape, layout, line)
				: anchor === 'middle'
					? layout.width / 2 + spacing / 2
					: layout.width + spacing;
		const y = (index + 0.5) * layout.lineHeight;
		lines += `<text x="${number(x)}" y="${number(y)}">${escapeXml(line.text)}</text>`;
	});
	return lines ? `<g${at}${style}>${lines}</g>` : '';
}

function imageSvg(shape: ImageShape, alpha: number, at: string, pixels: SvgPixels) {
	const url = pixels.pictures.get(shape.picture);
	const { width, height } = shape;
	const fade = alpha < 1 ? ` opacity="${number(alpha)}"` : '';
	if (url) {
		return `<image${at}${fade} width="${number(width)}" height="${number(height)}" preserveAspectRatio="none" href="${url}"/>`;
	}
	// The picture's pixels are missing: the pale frame with a cross the studio shows.
	const line = number(Math.max(1, Math.min(width, height) / 200));
	return (
		`<g${at}${fade}><rect width="${number(width)}" height="${number(height)}" fill="#ddd8cc"/>` +
		`<path d="M0 0H${number(width)}V${number(height)}H0ZM0 0L${number(width)} ${number(height)}M${number(width)} 0L0 ${number(height)}" fill="none" stroke="#9d9585" stroke-width="${line}"/></g>`
	);
}

function shapesSvg(shapes: Shape[], alpha: number, pixels: SvgPixels, fonts: Set<TextFont>) {
	let out = '';
	for (const shape of shapes) {
		if (shape.hidden) continue;
		const opacity = alpha * shape.opacity;
		if (opacity <= 0) continue;
		const at = transformOf(shape.transform);
		switch (shape.kind) {
			case 'group': {
				const inner = shapesSvg(shape.children, opacity, pixels, fonts);
				if (inner) out += at ? `<g${at}>${inner}</g>` : inner;
				break;
			}
			case 'line':
				out += lineSvg(shape, opacity, at);
				break;
			case 'text':
				out += textSvg(shape, opacity, at, fonts);
				break;
			case 'image':
				out += imageSvg(shape, opacity, at, pixels);
				break;
			default: {
				if (!shape.fill && !shape.stroke) break;
				const rule = shape.kind === 'path' ? shape.fillRule : 'nonzero';
				const d = pathData(outline(shape));
				if (!d) break;
				out += `<path${at} d="${d}"${fillOf(shape.fill?.color, opacity, rule)}${strokeOf(shape.stroke, opacity)}/>`;
			}
		}
	}
	return out;
}

/** The whole drawing as the text of an SVG file, the drawing's size, its layers as groups. */
export function drawingSvg(doc: Drawing, pixels: SvgPixels, title = '') {
	const { width, height } = doc;
	const fonts = new Set<TextFont>();
	let body = '';
	if (doc.background) {
		body += `<rect width="${width}" height="${height}"${fillOf(doc.background, 1)}/>`;
	}
	for (const layer of doc.layers) {
		if (layer.hidden || layer.opacity <= 0) continue;
		let inner = '';
		if (layer.kind === 'paint') {
			const url = pixels.paint.get(layer.id);
			if (url) inner = `<image width="${width}" height="${height}" href="${url}"/>`;
		} else {
			inner = shapesSvg(layer.shapes, 1, pixels, fonts);
		}
		if (!inner) continue;
		const look =
			(layer.opacity < 1 ? ` opacity="${number(layer.opacity)}"` : '') +
			(layer.blend !== 'normal' ? ` style="mix-blend-mode:${layer.blend}"` : '');
		// Inkscape reads these as its own layers, with their names; other programs pass over them.
		body += `<g inkscape:groupmode="layer" inkscape:label="${escapeXml(layer.name)}"${look}>${inner}</g>`;
	}
	const used = TEXT_FONTS.map((font) => font.key).filter((key) => fonts.has(key));
	const sheet = used.length
		? `<style>@import url("https://fonts.googleapis.com/css2?${used
				.map((key) => `family=${FONT_SPECS[key]}`)
				.join('&amp;')}&amp;display=swap");</style>`
		: '';
	return (
		'<?xml version="1.0" encoding="UTF-8"?>\n' +
		`<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
		(title.trim() ? `<title>${escapeXml(title.trim())}</title>` : '') +
		sheet +
		body +
		'</svg>\n'
	);
}

// ---- In the browser ---------------------------------------------------------------------------

function dataUrl(blob: Blob) {
	return new Promise<string>((done, fail) => {
		const reader = new FileReader();
		reader.onload = () => done(String(reader.result));
		reader.onerror = () => fail(reader.error);
		reader.readAsDataURL(blob);
	});
}

/** The drawing as an SVG file, with its pictures and paint layers inside it. */
export async function svgFile(
	doc: Drawing,
	sources: {
		pictures: ReadonlyMap<string, { blob: Blob }>;
		paint: ReadonlyMap<string, HTMLCanvasElement>;
	},
	title = ''
) {
	const pictures: Record<string, string> = {};
	const paint: Record<string, string> = {};
	const shown = new Set<string>();
	const visit = (shapes: Shape[]) => {
		for (const shape of shapes) {
			if (shape.hidden) continue;
			if (shape.kind === 'group') visit(shape.children);
			else if (shape.kind === 'image') shown.add(shape.picture);
		}
	};
	for (const layer of doc.layers) {
		if (layer.hidden) continue;
		if (layer.kind === 'vector') visit(layer.shapes);
		else {
			const canvas = sources.paint.get(layer.id);
			if (canvas) paint[layer.id] = canvas.toDataURL('image/png');
		}
	}
	for (const id of shown) {
		const picture = sources.pictures.get(id);
		if (picture) pictures[id] = await dataUrl(picture.blob);
	}
	const text = drawingSvg(
		doc,
		{ pictures: new Map(Object.entries(pictures)), paint: new Map(Object.entries(paint)) },
		title
	);
	return new Blob([text], { type: 'image/svg+xml' });
}
