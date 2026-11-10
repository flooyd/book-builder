// Colours in the art studio: #rrggbbaa strings, and the hue, saturation and value the picker
// works in. No DOM.

export type Rgba = { r: number; g: number; b: number; a: number };
export type Hsva = { h: number; s: number; v: number; a: number };

export function parseHex(hex: string): Rgba {
	const value = hex.replace('#', '');
	const full = value.length === 6 ? `${value}ff` : value.padEnd(8, 'f');
	return {
		r: parseInt(full.slice(0, 2), 16),
		g: parseInt(full.slice(2, 4), 16),
		b: parseInt(full.slice(4, 6), 16),
		a: parseInt(full.slice(6, 8), 16) / 255
	};
}

const byte = (value: number) =>
	Math.round(Math.max(0, Math.min(255, value)))
		.toString(16)
		.padStart(2, '0');

export const toHex = ({ r, g, b, a }: Rgba) => `#${byte(r)}${byte(g)}${byte(b)}${byte(a * 255)}`;

/** Hue 0–360, saturation and value 0–1. */
export function rgbToHsv({ r, g, b, a }: Rgba): Hsva {
	const red = r / 255;
	const green = g / 255;
	const blue = b / 255;
	const max = Math.max(red, green, blue);
	const min = Math.min(red, green, blue);
	const span = max - min;
	let h = 0;
	if (span) {
		if (max === red) h = ((green - blue) / span) % 6;
		else if (max === green) h = (blue - red) / span + 2;
		else h = (red - green) / span + 4;
		h *= 60;
		if (h < 0) h += 360;
	}
	return { h, s: max ? span / max : 0, v: max, a };
}

export function hsvToRgb({ h, s, v, a }: Hsva): Rgba {
	const chroma = v * s;
	const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = v - chroma;
	const [r, g, b] =
		h < 60
			? [chroma, x, 0]
			: h < 120
				? [x, chroma, 0]
				: h < 180
					? [0, chroma, x]
					: h < 240
						? [0, x, chroma]
						: h < 300
							? [x, 0, chroma]
							: [chroma, 0, x];
	return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255, a };
}

export const hexToHsv = (hex: string) => rgbToHsv(parseHex(hex));
export const hsvToHex = (hsv: Hsva) => toHex(hsvToRgb(hsv));

/** The colour as six digits, for showing and typing. */
export const shortHex = (hex: string) => hex.slice(0, 7).toUpperCase();

/** A colour without its transparency, for a swatch's solid half. */
export const opaque = (hex: string) => `${hex.slice(0, 7)}ff`;

/** Typed text as a colour: three, six or eight digits, with or without #. */
export function readHex(text: string, alpha = 1): string | null {
	const value = text.trim().replace(/^#/, '');
	if (/^[0-9a-f]{3}$/i.test(value)) {
		const [r, g, b] = value;
		return `#${r}${r}${g}${g}${b}${b}${byte(alpha * 255)}`.toLowerCase();
	}
	if (/^[0-9a-f]{6}$/i.test(value)) return `#${value}${byte(alpha * 255)}`.toLowerCase();
	if (/^[0-9a-f]{8}$/i.test(value)) return `#${value}`.toLowerCase();
	return null;
}

/** Colours to start from: inks and greys, then earth, sea, foliage and jewel tones. */
export const PALETTE = [
	'#000000ff',
	'#1d2142ff',
	'#4a4e69ff',
	'#8d8fa3ff',
	'#c9c9d1ff',
	'#ffffffff',
	'#f5f0e6ff',
	'#e8dcc2ff',
	'#5a3b22ff',
	'#a8774aff',
	'#d9a066ff',
	'#e8b04bff',
	'#7a1f1fff',
	'#b4471bff',
	'#e0603aff',
	'#e88fa6ff',
	'#2f5d3aff',
	'#6f9a5bff',
	'#a9c47fff',
	'#1f4e6bff',
	'#2b63f5ff',
	'#7cb4ffff',
	'#5b3f8cff',
	'#b0124fff'
];
