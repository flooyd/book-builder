import hyphen from 'hyphen/en-gb';
import PDFDocument from 'pdfkit';
import { coverTitleScale, coverVariant } from '$lib/cover';
import type { RichNode } from '$lib/rich';
import { FacePicker, faces, type Style } from './fonts';
import {
	contentsOf,
	descriptionLines,
	plainRun,
	runsOf,
	storyOf,
	type FirstLetter,
	type Inline,
	type Manuscript,
	type Run,
	type Section
} from './manuscript';

/**
 * A manuscript as a finished book: a 6 × 9 inch trade paperback with a cover, a title page,
 * contents, running heads and facing pages. pdfkit draws; the setting is done here, because a book
 * needs what its own text layout doesn't do: hyphenation, a first letter that sits across lines,
 * and no line stranded alone at the top or foot of a page.
 *
 * Pages are numbered as a book is. Front matter has none, the story starts on page 1, and that
 * first page is always a right-hand one. y runs down the page, as it does in pdfkit.
 */

const WIDTH = 432;
const HEIGHT = 648;
const TOP = 68;
const FOOT = HEIGHT - 72;
const INNER = 68;
const OUTER = 52;
const MEASURE = WIDTH - INNER - OUTER;

const SIZE = 11;
const LEADING = 15.5;
const INDENT = SIZE * 1.6;

/** How far a justified line's spaces may close up, and open out, as shares of a space. */
const SHRINK = 0.82;
const STRETCH = 1.3;
/** A line may end in a hyphen this many times running. */
const HYPHENS_RUNNING = 2;

const INK = {
	text: '#24232b',
	strong: '#141c45',
	muted: '#6b6352',
	accent: '#2152d8',
	rule: '#c8bda6',
	night: '#0b1130'
};

const COVER = {
	navy: { ground: '#1d3184', title: '#ffffff', over: '#a9c8ff', line: '#7cb4ff' },
	paper: { ground: '#f5f0e6', title: '#141c45', over: '#2b63f5', line: '#2b63f5' }
};

const SOFT_HYPHEN = '\u00ad';
/** Characters that are nothing on a page. */
const INVISIBLE = /[\u200b-\u200d\u2060\ufeff\u00ad]/g;
/** Spaces a line can break at; a no-break space stays part of its word. */
const SPACES = /([ \t\r\n\f\v\u2000-\u200a\u202f\u205f\u3000]+)/;
/** After a dash between words, a line can break with no space. */
const AFTER_DASH = /(?<=[\p{L}\p{N}][-–—]+)(?=[\p{L}\p{N}“‘"'])/u;

type Piece = { text: string; face: string; size: number; width: number; run: Run };
type Word = { pieces: Piece[]; width: number; space: number };

type Line = {
	words: Word[];
	/** Width with its spaces at their natural size. */
	natural: number;
	/** What the line has to fill, and how far in it starts. */
	room: number;
	inset: number;
	height: number;
	ascent: number;
	/** Ends its paragraph or a line break, so it isn't justified. */
	end: boolean;
	marker?: string;
};

/** A title set for the cover, before it's put on the page. */
type CoverBlock = { lines: Line[]; flow: Flow; height: number };

type Flow = {
	size: number;
	leading: number;
	align: 'justify' | 'left' | 'center' | 'right';
	/** Insets from the text block's edges. */
	left: number;
	right: number;
	indent: number;
	hyphenate: boolean;
	color: string;
};

const bodyFlow = (changes: Partial<Flow> = {}): Flow => ({
	size: SIZE,
	leading: LEADING,
	align: 'justify',
	left: 0,
	right: 0,
	indent: 0,
	hyphenate: true,
	color: INK.text,
	...changes
});

/** The line a first letter takes out of its paragraph. */
type Cap = FirstLetter & { face: string; size: number; width: number; box: number };

class Book {
	doc: PDFKit.PDFDocument;
	#picker: FacePicker;
	#widths: Record<string, number> = {};
	#fill = '';
	/** Characters no face could draw. */
	missing = 0;

	/** Set by the pages as they turn. */
	y = TOP;
	#fresh = true;
	/** Pages before page 1. */
	front = 0;
	/** The running head on right-hand pages; left-hand ones carry the book's title. */
	#head = '';
	#title: string;
	/** The part the next chapters sit under in the PDF's bookmarks. */
	#outlinePart: PDFKit.PDFOutline | null = null;
	/** Printed page of each section. */
	pages: Record<string, number> = {};

	constructor(doc: PDFKit.PDFDocument, picker: FacePicker, title: string) {
		this.doc = doc;
		this.#picker = picker;
		this.#title = title;
	}

	// ---- Pages ---------------------------------------------------------------------------------

	get number() {
		return this.doc.bufferedPageRange().count;
	}

	get recto() {
		return this.number % 2 === 1;
	}

	/** Left edge of the text block, which sits towards the spine. */
	get left() {
		return this.recto ? INNER : OUTER;
	}

	addPage() {
		this.doc.addPage();
		this.#fill = '';
		this.y = TOP;
		this.#fresh = true;
	}

	/** A page of the book proper: its number at the foot, and a running head if it wants one. */
	storyPage(running: boolean) {
		this.addPage();
		const number = this.number - this.front;
		this.label(String(number), WIDTH / 2, HEIGHT - 44, {
			family: 'read',
			size: 9.5,
			color: INK.muted,
			tracking: 0
		});
		if (running) {
			const head = this.recto ? this.#head : this.#title;
			this.label(this.#fit(head.toUpperCase(), MEASURE, 7.2, 1.2), WIDTH / 2, 42, {
				family: 'ui',
				size: 7.2,
				color: INK.muted,
				tracking: 1.2
			});
		}
	}

	/** Blank until the next right-hand page. */
	toRecto() {
		if (this.number > 0 && this.recto) this.addPage();
	}

	#room(height: number) {
		return this.y + height <= FOOT + 0.5;
	}

	/** Turn the page unless this much will fit. */
	ensure(height: number) {
		if (!this.#fresh && !this.#room(height)) this.storyPage(true);
	}

	/** Space between blocks, which a new page doesn't need. */
	gap(height: number) {
		if (!this.#fresh) this.y += height;
	}

	// ---- Measuring -----------------------------------------------------------------------------

	#ink(color: string) {
		if (color !== this.#fill) {
			this.doc.fillColor(color);
			this.#fill = color;
		}
	}

	#width(text: string, face: string, size: number) {
		const key = `${face}\0${text}`;
		const known = this.#widths[key];
		if (known !== undefined) return known * size;
		this.doc.font(face).fontSize(1000);
		const width = this.doc.widthOfString(text) / 1000;
		this.#widths[key] = width;
		return width * size;
	}

	#pieces(text: string, run: Run, size: number) {
		const style: Style = run;
		const pieces: Piece[] = [];
		let face = '';
		let buffer = '';
		const flush = () => {
			if (!buffer) return;
			pieces.push({ text: buffer, face, size, run, width: this.#width(buffer, face, size) });
			buffer = '';
		};
		for (const char of text) {
			const next = this.#picker.pick(char, style);
			// A box the font doesn't measure pushes the line out of true; a question mark doesn't.
			const known = next ?? this.#picker.main(style);
			if (!next) this.missing++;
			if (known !== face) flush();
			face = known;
			buffer += next ? char : '?';
		}
		flush();
		return pieces;
	}

	#word(pieces: Piece[], space: number): Word {
		return { pieces, space, width: pieces.reduce((sum, piece) => sum + piece.width, 0) };
	}

	/** Runs as words, split wherever the writer put a line break. */
	#stretches(inlines: Inline[], size: number) {
		const stretches: Word[][] = [[]];
		let pieces: Piece[] = [];
		const finish = (space: number) => {
			const words = stretches[stretches.length - 1];
			if (pieces.length) {
				words.push(this.#word(pieces, space));
				pieces = [];
			} else if (words.length) {
				const last = words[words.length - 1];
				last.space = Math.max(last.space, space);
			}
		};
		for (const inline of inlines) {
			if (inline === 'break') {
				finish(0);
				stretches.push([]);
				continue;
			}
			const pieceSize = size * inline.scale;
			for (const token of inline.text.replace(INVISIBLE, '').split(SPACES)) {
				if (!token) continue;
				if (SPACES.test(token)) {
					finish(this.#width(' ', this.#picker.main(inline), pieceSize));
					continue;
				}
				const parts = token.split(AFTER_DASH);
				parts.forEach((part, index) => {
					pieces.push(...this.#pieces(part, inline, pieceSize));
					if (index < parts.length - 1) finish(0);
				});
			}
		}
		finish(0);
		return stretches;
	}

	// ---- Breaking lines ------------------------------------------------------------------------

	/** Where a word can break, leaving a head that fits in `room`; null if it can't. */
	#hyphenate(word: Word, room: number) {
		const [piece] = word.pieces;
		// Names aren't broken, and neither is anything that isn't a plain word.
		if (word.pieces.length !== 1 || !/^\p{Ll}[\p{L}’'-]{4,}[.,;:!?”’)]*$/u.test(piece.text)) {
			return null;
		}
		const parts = hyphen.hyphenateSync(piece.text).split(SOFT_HYPHEN);
		for (let count = parts.length - 1; count > 0; count--) {
			const head = parts.slice(0, count).join('');
			const text = head.endsWith('-') ? head : `${head}-`;
			const width = this.#width(text, piece.face, piece.size);
			if (width > room) continue;
			const tail = parts.slice(count).join('');
			return {
				head: this.#word([{ ...piece, text, width }], 0),
				tail: this.#word(
					[{ ...piece, text: tail, width: this.#width(tail, piece.face, piece.size) }],
					word.space
				)
			};
		}
		return null;
	}

	/** A word too long for any line: as much of it as fits. */
	#cut(word: Word, room: number) {
		const [piece, ...others] = word.pieces;
		const chars = [...piece.text];
		let count = 0;
		while (count < chars.length - 1) {
			const next = this.#width(chars.slice(0, count + 1).join(''), piece.face, piece.size);
			if (next > room && count > 0) break;
			count++;
		}
		const head = chars.slice(0, count).join('');
		const tail = chars.slice(count).join('');
		return {
			head: this.#word(
				[{ ...piece, text: head, width: this.#width(head, piece.face, piece.size) }],
				0
			),
			tail: this.#word(
				[
					...(tail
						? [{ ...piece, text: tail, width: this.#width(tail, piece.face, piece.size) }]
						: []),
					...others
				],
				word.space
			)
		};
	}

	#lineOf(words: Word[], flow: Flow, room: number, inset: number, end: boolean): Line {
		const natural = words.reduce(
			(sum, word, index) => sum + word.width + (index < words.length - 1 ? word.space : 0),
			0
		);
		let size = 0;
		for (const word of words) for (const piece of word.pieces) size = Math.max(size, piece.size);
		const height = flow.leading * Math.max(1, size / flow.size);
		return { words, natural, room, inset, height, ascent: height - flow.leading * 0.28, end };
	}

	/** Lines for a paragraph; `box` gives each line's indent and width. */
	#lines(inlines: Inline[], flow: Flow, box: (line: number) => { inset: number; room: number }) {
		const lines: Line[] = [];
		const shrink = flow.align === 'justify' ? SHRINK : 1;
		let hyphens = 0;

		for (const stretch of this.#stretches(inlines, flow.size)) {
			const queue = [...stretch];
			let words: Word[] = [];
			let ink = 0;
			let spaces = 0;

			const close = (end: boolean) => {
				const { inset, room } = box(lines.length);
				lines.push(this.#lineOf(words, flow, room, inset, end));
				words = [];
				ink = 0;
				spaces = 0;
			};

			while (queue.length) {
				const word = queue[0];
				const { room } = box(lines.length);
				const gap = words.length ? words[words.length - 1].space : 0;
				const left = room - ink - (spaces + gap) * shrink;
				if (word.width <= left + 0.01) {
					words.push(word);
					ink += word.width;
					spaces += gap;
					queue.shift();
					continue;
				}
				// Only justified text needs it: anything else was set loose on purpose.
				const hyphenates = flow.hyphenate && flow.align === 'justify' && hyphens < HYPHENS_RUNNING;
				const split = hyphenates ? this.#hyphenate(word, left) : null;
				if (split) {
					words.push(split.head);
					queue[0] = split.tail;
					hyphens++;
				} else if (words.length === 0) {
					const { head, tail } = this.#cut(word, room);
					words.push(head);
					if (tail.pieces.length) queue[0] = tail;
					else queue.shift();
				} else {
					hyphens = 0;
				}
				close(false);
			}
			close(true);
		}
		return lines;
	}

	// ---- Drawing -------------------------------------------------------------------------------

	#draw(line: Line, flow: Flow) {
		const { doc } = this;
		const baseline = this.y + line.ascent;
		const left = this.left + flow.left + line.inset;
		const slack = line.room - line.natural;
		const gaps = line.words.slice(0, -1).filter((word) => word.space > 0).length;

		let extra = 0;
		let x = left;
		if (flow.align === 'justify' && !line.end && gaps) {
			const spread = slack / gaps;
			const space = line.words[0].space || flow.size / 4;
			extra = Math.min(spread, space * STRETCH);
		} else if (flow.align === 'center') x += slack / 2;
		else if (flow.align === 'right') x += slack;

		if (line.marker) {
			const width = this.#width(line.marker, this.#picker.main(plainRun('')), flow.size);
			this.#ink(flow.color);
			doc
				.font(this.#picker.main(plainRun('')))
				.fontSize(flow.size)
				.text(line.marker, left - width - flow.size * 0.45, baseline, {
					lineBreak: false,
					baseline: 'alphabetic'
				});
		}

		// Where everything goes first: highlights have to sit under the text.
		const placed: { piece: Piece; x: number; gap: number; spaced: boolean }[] = [];
		line.words.forEach((word, index) => {
			const last = index === line.words.length - 1;
			const gap = !last && word.space > 0 ? word.space + extra : 0;
			word.pieces.forEach((piece, position) => {
				const end = position === word.pieces.length - 1;
				placed.push({ piece, x, gap: end ? gap : 0, spaced: end && gap > 0 });
				x += piece.width + (end ? gap : 0);
			});
		});

		// A mark or a line carries across the space to the next word if that word has it too.
		const across = (index: number, test: (run: Run) => boolean) => {
			const next = placed[index + 1];
			return placed[index].gap > 0 && next && test(next.piece.run) ? placed[index].gap : 0;
		};

		placed.forEach(({ piece, x }, index) => {
			const colour = piece.run.highlight;
			if (!colour) return;
			const width = piece.width + across(index, (run) => run.highlight === colour);
			this.#fill = colour;
			doc
				.fillColor(colour)
				.rect(x, baseline - piece.size * 0.82, width, piece.size * 1.06)
				.fill();
		});

		type Group = { text: string; x: number; face: string; size: number; color: string };
		let group = null as Group | null;
		const paint = () => {
			if (!group) return;
			this.#ink(group.color);
			doc
				.font(group.face)
				.fontSize(group.size)
				.text(group.text, group.x, baseline, {
					lineBreak: false,
					baseline: 'alphabetic',
					...(extra && { wordSpacing: extra })
				});
			group = null;
		};
		let spaced = false;
		for (const { piece, x, spaced: next } of placed) {
			const color = piece.run.color ?? flow.color;
			if (group?.face === piece.face && group.size === piece.size && group.color === color) {
				group.text += `${spaced ? ' ' : ''}${piece.text}`;
			} else {
				paint();
				group = { text: piece.text, x, face: piece.face, size: piece.size, color };
			}
			spaced = next;
		}
		paint();

		placed.forEach(({ piece, x }, index) => {
			const { run } = piece;
			if (!run.underline && !run.strike) return;
			const color = run.color ?? flow.color;
			doc.lineWidth(Math.max(0.4, piece.size * 0.05)).strokeColor(color);
			if (run.underline) {
				const end = x + piece.width + across(index, (other) => other.underline);
				const y = baseline + piece.size * 0.12;
				doc.moveTo(x, y).lineTo(end, y).stroke();
			}
			if (run.strike) {
				const end = x + piece.width + across(index, (other) => other.strike);
				const y = baseline - piece.size * 0.27;
				doc.moveTo(x, y).lineTo(end, y).stroke();
			}
		});
	}

	/** Set lines down the page, keeping two together at the foot and the head of a page. */
	#place(lines: Line[], flow: Flow, before?: (first: Line) => void) {
		let index = 0;
		while (index < lines.length) {
			let fit = 0;
			let used = 0;
			while (index + fit < lines.length && this.#room(used + lines[index + fit].height)) {
				used += lines[index + fit].height;
				fit++;
			}
			if (lines.length - index - fit === 1 && fit > 0) fit--;
			if (index === 0 && fit === 1 && lines.length > 1) fit = 0;
			if (fit === 0 && this.#fresh) fit = 1;

			if (fit > 0 && index === 0) before?.(lines[0]);
			for (const line of lines.slice(index, index + fit)) {
				this.#draw(line, flow);
				this.y += line.height;
				this.#fresh = false;
			}
			index += fit;
			if (index < lines.length) this.storyPage(true);
		}
	}

	/** A plain measure: the same width for every line, the first indented. */
	#setBlock(inlines: Inline[], flow: Flow, marker?: string) {
		const room = MEASURE - flow.left - flow.right;
		const lines = this.#lines(inlines, flow, (line) =>
			line === 0 ? { inset: flow.indent, room: room - flow.indent } : { inset: 0, room }
		);
		if (marker) lines[0].marker = marker;
		this.#place(lines, flow);
	}

	/** Text on one line, centred on x, for labels and page numbers. */
	label(
		text: string,
		x: number,
		y: number,
		style: {
			family: Run['family'];
			size: number;
			color: string;
			tracking: number;
			bold?: boolean;
			start?: boolean;
		}
	) {
		const { family, size, color, tracking, bold = false, start = false } = style;
		const run = plainRun(text, { family, bold });
		const pieces = this.#pieces(text, run, size);
		const width =
			pieces.reduce((sum, piece) => sum + piece.width, 0) +
			tracking * Math.max(0, [...text].length - 1);
		let at = start ? x : x - width / 2;
		this.#ink(color);
		for (const piece of pieces) {
			this.doc.font(piece.face).fontSize(size).text(piece.text, at, y, {
				lineBreak: false,
				baseline: 'alphabetic',
				characterSpacing: tracking
			});
			at += piece.width + tracking * [...piece.text].length;
		}
	}

	/** Cut text with an ellipsis so it fits on a line of labels. */
	#fit(text: string, width: number, size: number, tracking: number) {
		const face = this.#picker.main({ family: 'ui', bold: false, italic: false });
		const fits = (value: string) =>
			this.#width(value, face, size) + tracking * value.length <= width;
		if (fits(text)) return text;
		let cut = text;
		while (cut.length > 1 && !fits(`${cut}…`)) cut = cut.slice(0, -1);
		return `${cut.trimEnd()}…`;
	}

	ornament(x: number, y: number, scale = 1, line = INK.rule, diamond = INK.accent) {
		const { doc } = this;
		this.#fill = diamond;
		doc.lineWidth(0.6 * scale).strokeColor(line);
		doc
			.moveTo(x - 32 * scale, y)
			.lineTo(x - 8 * scale, y)
			.stroke();
		doc
			.moveTo(x + 8 * scale, y)
			.lineTo(x + 32 * scale, y)
			.stroke();
		doc
			.fillColor(diamond)
			.polygon([x, y - 4 * scale], [x + 4 * scale, y], [x, y + 4 * scale], [x - 4 * scale, y])
			.fill();
	}

	// ---- Story text ----------------------------------------------------------------------------

	#capOf(first: FirstLetter): Cap {
		const body = this.#picker.capHeight(this.#picker.main(plainRun('')));
		const face = this.#picker.main({ family: first.font, bold: false, italic: false });
		const reach = (first.lines - 1) * LEADING + body * SIZE;
		if (first.style === 'boxed') {
			const box = reach + SIZE * 0.42;
			const size = (box * 0.62) / this.#picker.capHeight(face);
			return { ...first, face, size, box, width: this.#width(first.letter, face, size) };
		}
		const size = reach / this.#picker.capHeight(face);
		return { ...first, face, size, box: 0, width: this.#width(first.letter, face, size) };
	}

	/** The story's first paragraph, with its letter sunk into the lines or set tall on the first. */
	#opening(inlines: Inline[], first: FirstLetter) {
		const flow = bodyFlow();
		if (first.style === 'raised') {
			const letter = plainRun(first.letter, {
				family: first.font,
				scale: 2.6,
				color: first.color
			});
			this.#setBlock([letter, ...inlines], flow);
			return;
		}

		const cap = this.#capOf(first);
		const step = cap.style === 'boxed' ? cap.width + SIZE * 1.1 : cap.width + SIZE * 0.34;
		const lines = this.#lines(inlines, flow, (line) =>
			line < cap.lines ? { inset: step, room: MEASURE - step } : { inset: 0, room: MEASURE }
		);
		this.ensure(cap.lines * LEADING);
		let bottom = 0;
		this.#place(lines, flow, (line) => {
			const { left, y: top } = this;
			bottom = top + cap.lines * LEADING;
			const baseline = top + line.ascent + (cap.lines - 1) * LEADING;
			if (cap.style === 'boxed') {
				const boxTop = baseline - cap.box + SIZE * 0.21;
				const boxWidth = cap.width + SIZE * 0.72;
				this.#fill = cap.color;
				this.doc.fillColor(cap.color).roundedRect(left, boxTop, boxWidth, cap.box, 1.5).fill();
				const letterBase = boxTop + cap.box / 2 + (cap.size * this.#picker.capHeight(cap.face)) / 2;
				this.#ink(INK.night);
				this.doc
					.font(cap.face)
					.fontSize(cap.size)
					.text(cap.letter, left + SIZE * 0.36, letterBase, {
						lineBreak: false,
						baseline: 'alphabetic'
					});
			} else {
				this.#ink(cap.color);
				this.doc.font(cap.face).fontSize(cap.size).text(cap.letter, left, baseline, {
					lineBreak: false,
					baseline: 'alphabetic'
				});
			}
		});
		// A very short paragraph mustn't leave the letter hanging into the next one.
		if (lines.length < cap.lines) this.y = Math.max(this.y, bottom);
	}

	#heading(node: RichNode, base: Partial<Flow>) {
		const level = Number(node.attrs?.level ?? 1);
		const align = (node.attrs?.textAlign as Flow['align']) ?? 'left';
		const size = level === 1 ? SIZE * 1.6 : level === 2 ? SIZE * 1.3 : SIZE * 0.8;
		const flow = bodyFlow({
			...base,
			size,
			leading: Math.max(size * 1.25, LEADING),
			align,
			hyphenate: false,
			color: level === 3 ? INK.accent : INK.strong
		});
		let runs = runsOf(
			node.content,
			level === 3 ? { family: 'ui', bold: true } : { family: 'display' }
		);
		if (level === 3) {
			runs = runs.map((run) => (run === 'break' ? run : { ...run, text: run.text.toUpperCase() }));
		}
		this.ensure(flow.leading + LEADING * 2 + SIZE * 1.3);
		this.gap(SIZE * 1.3);
		this.#setBlock(runs, flow);
		this.y += SIZE * 0.4;
	}

	#list(node: RichNode, base: Flow, quote: boolean) {
		const ordered = node.type === 'orderedList';
		const inset = SIZE * 1.6;
		let number = Number(node.attrs?.start ?? 1);
		this.gap(SIZE * 0.5);
		(node.content ?? []).forEach((item, index) => {
			if (index) this.y += SIZE * 0.25;
			this.#blocks(item.content ?? [], {
				flow: { ...base, left: base.left + inset, indent: 0 },
				quote,
				list: true,
				marker: ordered ? `${number}.` : '•'
			});
			number++;
		});
		this.gap(SIZE * 0.5);
	}

	#blocks(
		nodes: RichNode[],
		{
			flow = bodyFlow(),
			quote = false,
			list = false,
			marker,
			cap
		}: { flow?: Flow; quote?: boolean; list?: boolean; marker?: string; cap?: FirstLetter | null }
	) {
		let previous = '';
		let pending = cap;
		let mark = marker;
		for (const node of nodes) {
			if (node.type === 'paragraph') {
				const runs = runsOf(node.content, quote ? { italic: true } : {});
				const align = (node.attrs?.textAlign as Flow['align']) ?? flow.align;
				if (pending) {
					this.#opening(runs, pending);
					pending = null;
				} else if (runs.length) {
					const indent = previous === 'paragraph' && !list ? INDENT : 0;
					this.#setBlock(runs, { ...flow, align, indent }, mark);
				} else {
					// A blank line the writer left on purpose.
					this.ensure(flow.leading);
					this.y += flow.leading;
					this.#fresh = false;
				}
				mark = undefined;
			} else if (node.type === 'heading') {
				this.#heading(node, { left: flow.left, right: flow.right });
			} else if (node.type === 'blockquote') {
				this.gap(SIZE * 0.7);
				this.#blocks(node.content ?? [], {
					flow: {
						...flow,
						left: flow.left + SIZE * 1.4,
						right: flow.right + SIZE * 0.6,
						indent: 0,
						color: INK.text
					},
					quote: true,
					list: false
				});
				this.gap(SIZE * 0.7);
			} else if (node.type === 'bulletList' || node.type === 'orderedList') {
				this.#list(node, flow, quote);
			} else if (node.type === 'horizontalRule') {
				this.ensure(SIZE * 2.6 + LEADING * 2);
				this.gap(SIZE * 1.3);
				this.ornament(this.left + MEASURE / 2, this.y + 5);
				this.y += SIZE * 2.3;
				this.#fresh = false;
			}
			previous = node.type;
		}
	}

	// ---- Sections ------------------------------------------------------------------------------

	#mark(section: Section) {
		const { doc } = this;
		this.pages[section.key] = this.number - this.front;
		doc.addNamedDestination(section.key);
		const title = [section.over, section.title].filter(Boolean).join(' · ');
		if (!title) return;
		if (section.depth === 0 || !this.#outlinePart) {
			const item = doc.outline.addItem(title, { expanded: true });
			this.#outlinePart = section.kind === 'part' ? item : null;
		} else this.#outlinePart.addItem(title);
	}

	part(section: Section) {
		this.toRecto();
		this.#head = section.title || this.#title;
		this.addPage();
		this.#mark(section);
		this.y = HEIGHT * 0.34;
		this.#titleBlock(section, 34);
		this.ornament(this.left + MEASURE / 2, this.y + 22);
	}

	/** Label, title and description, centred, as they open a page in reading mode. */
	#titleBlock(
		{ over, title, description }: Pick<Section, 'over' | 'title' | 'description'>,
		size: number
	) {
		const centre = this.left + MEASURE / 2;
		if (over) {
			this.label(over.toUpperCase(), centre, this.y, {
				family: 'ui',
				size: 8.2,
				color: INK.accent,
				tracking: 2,
				bold: true
			});
			this.y += 15;
		}
		if (title) {
			const flow = bodyFlow({
				size,
				leading: size * 1.16,
				align: 'center',
				hyphenate: false,
				color: INK.strong
			});
			this.#setBlock([plainRun(title, { family: 'display' })], flow);
		}
		for (const line of descriptionLines(description)) {
			this.y += 6;
			this.#setBlock(
				line,
				bodyFlow({
					size: 12.5,
					leading: 17,
					align: 'center',
					hyphenate: false,
					color: INK.muted,
					left: 14,
					right: 14
				})
			);
		}
	}

	story(section: Section) {
		const opens = section.title || section.description;
		this.#head = section.title || this.#title;
		this.storyPage(!opens);
		this.#mark(section);
		if (opens) {
			this.y = TOP + 74;
			this.#titleBlock(section, 25);
			this.y += 30;
		}
		const { blocks, cap } = storyOf(section.text);
		this.#blocks(blocks, { cap });
	}

	// ---- Front matter --------------------------------------------------------------------------

	/** The book's generated cover, the same design as BookCover at full size. */
	cover(manuscript: Manuscript) {
		const { doc } = this;
		const variant = coverVariant(manuscript.id);
		const colours = COVER[variant];
		const scale = WIDTH / 196;
		this.addPage();
		this.#fill = '';
		doc.fillColor(colours.ground).rect(0, 0, WIDTH, HEIGHT).fill();
		doc
			.fillColor(variant === 'navy' ? '#000000' : '#3c280a', variant === 'navy' ? 0.25 : 0.14)
			.rect(0, 0, 10 * scale, HEIGHT)
			.fill();
		doc.fillOpacity(1);

		const inset = variant === 'navy' ? 26 * scale : 22 * scale;
		const left = 26 * scale;
		const room = WIDTH - left - 16 * scale;
		const centre = left + room / 2;
		const author = manuscript.author.toUpperCase();
		const authorStyle = {
			family: 'ui' as const,
			size: 9 * scale,
			color: colours.over,
			tracking: 2.8 * scale,
			bold: true
		};
		const setAuthor = (y: number) => {
			if (!author) return;
			const fitted = this.#shrink(author, room, authorStyle);
			this.label(fitted.text, centre, y, fitted.style);
		};

		if (variant === 'navy') {
			doc
				.lineWidth(1.2)
				.strokeColor(colours.line)
				.strokeOpacity(0.45)
				.rect(24 * scale, 12 * scale, WIDTH - 36 * scale, HEIGHT - 24 * scale)
				.stroke();
			doc.strokeOpacity(1);
			setAuthor(inset + 20);
			this.#coverTitle(manuscript.title, left, room, HEIGHT / 2, colours.title);
			this.#fill = '';
			this.ornament(centre, HEIGHT - inset - 12, scale * 0.8, colours.line, colours.line);
		} else {
			const lines = this.#coverLines(manuscript.title, room);
			const emblem = 52 * scale;
			const gap = 18 * scale;
			const height = emblem + gap + lines.height + (author ? gap + 9 * scale : 0);
			let y = (HEIGHT - height) / 2;
			this.#fill = '';
			doc
				.lineWidth(2 * scale)
				.strokeColor(colours.line)
				.circle(centre, y + emblem / 2, emblem / 2 - scale)
				.stroke();
			doc
				.fillColor(colours.line)
				.circle(centre, y + emblem / 2, 10.5 * scale)
				.fill();
			y += emblem + gap;
			this.#setCoverLines(lines, left, y, colours.title);
			y += lines.height + gap + 9 * scale;
			setAuthor(y);
		}
	}

	#shrink<T extends { size: number; tracking: number }>(text: string, room: number, style: T) {
		const face = this.#picker.main({ family: 'ui', bold: true, italic: false });
		const width = this.#width(text, face, style.size) + style.tracking * [...text].length;
		if (width <= room) return { text, style };
		const scale = Math.max(0.55, room / width);
		const next = { ...style, size: style.size * scale, tracking: style.tracking * scale };
		return { text: this.#fit(text, room, next.size, next.tracking), style: next };
	}

	/** The title at the largest size that stays within five lines, as it does on the page. */
	#coverLines(title: string, room: number): CoverBlock {
		let size = 34 * (WIDTH / 196) * coverTitleScale(title);
		for (;;) {
			const flow = bodyFlow({
				size,
				leading: size * 0.98,
				align: 'center',
				hyphenate: false,
				color: INK.strong
			});
			const lines = this.#lines([plainRun(title, { family: 'display' })], flow, () => ({
				inset: 0,
				room
			}));
			for (const line of lines) {
				line.height = flow.leading;
				line.ascent = flow.leading * 0.8;
			}
			const tooWide = lines.some((line) => line.natural > room + 0.5);
			if ((lines.length <= 5 && !tooWide) || size < 14) {
				return { lines, flow, height: lines.length * flow.leading };
			}
			size *= 0.9;
		}
	}

	#setCoverLines(block: CoverBlock, left: number, top: number, color: string) {
		this.y = top;
		for (const line of block.lines) {
			this.#drawAt(line, { ...block.flow, color }, left);
			this.y += line.height;
		}
	}

	#coverTitle(title: string, left: number, room: number, middle: number, color: string) {
		const lines = this.#coverLines(title, room);
		this.#setCoverLines(lines, left, middle - lines.height / 2, color);
	}

	titlePage(manuscript: Manuscript) {
		this.toRecto();
		this.addPage();
		const { part } = manuscript;
		const centre = this.left + MEASURE / 2;
		this.y = HEIGHT * 0.3;
		if (part) {
			this.label(manuscript.title.toUpperCase(), centre, this.y, {
				family: 'ui',
				size: 8.2,
				color: INK.muted,
				tracking: 2,
				bold: true
			});
			this.y += 22;
			this.#titleBlock({ over: part.over, title: part.title, description: '' }, 30);
		} else {
			this.#titleBlock({ over: null, title: manuscript.title, description: '' }, 32);
		}
		this.ornament(centre, this.y + 18);
		this.y += 44;
		if (manuscript.author) {
			this.#setBlock(
				[plainRun(`by ${manuscript.author}`)],
				bodyFlow({ size: 12.5, leading: 17, align: 'center', hyphenate: false, color: INK.muted })
			);
		}
		const blurb = part ? part.description : manuscript.blurb;
		for (const line of descriptionLines(blurb)) {
			this.y += 10;
			this.#setBlock(
				line,
				bodyFlow({
					size: 11.5,
					leading: 16,
					align: 'center',
					hyphenate: false,
					color: INK.muted,
					left: 18,
					right: 18
				})
			);
		}
	}

	// ---- Contents ------------------------------------------------------------------------------

	/** The contents' lines, shared out over pages, without their page numbers yet. */
	contentsPages(sections: Section[]) {
		const numberWidth = 24;
		const rows = sections.map((section) => {
			const inPart = section.depth === 1;
			const titled = inPart ? section.short === null && section.over : section.over;
			const text = inPart && titled ? `${section.over}: ${section.title}` : section.title;
			const size = inPart ? 10.5 : 13;
			const flow = bodyFlow({
				size,
				leading: size * 1.34,
				align: 'left',
				hyphenate: false,
				color: inPart ? INK.text : INK.strong
			});
			const left = inPart ? numberWidth : 0;
			const room = MEASURE - left - 26;
			const run = plainRun(text, inPart ? {} : { family: 'display' });
			const lines = this.#lines([run], flow, () => ({ inset: 0, room }));
			const over = !inPart && section.over ? 11 : 0;
			const before = inPart ? 2.5 : 12;
			const height = before + over + lines.reduce((sum, line) => sum + line.height, 0);
			return { section, lines, flow, left, over, before, height };
		});

		const pages: (typeof rows)[] = [[]];
		const first = TOP + 62;
		let y = first;
		rows.forEach((row, index) => {
			// A part isn't left at the foot of a page without its first chapter.
			const next = rows[index + 1];
			const keep = row.section.depth === 0 && next?.section.depth === 1 ? next.height : 0;
			if (y + row.height + keep > FOOT + 0.5) {
				pages.push([]);
				y = TOP;
			}
			pages[pages.length - 1].push(row);
			y += row.height;
		});
		return pages;
	}

	/** Filled in once the book is set and every section knows its page. */
	drawContents(pages: ReturnType<Book['contentsPages']>, firstPage: number) {
		const { doc } = this;
		const numbers = doc.bufferedPageRange().count;
		pages.forEach((rows, index) => {
			doc.switchToPage(firstPage + index);
			this.#fill = '';
			// Book.left reads the last page; these pages know their own side.
			const left = (firstPage + index + 1) % 2 === 1 ? INNER : OUTER;
			this.y = TOP;
			if (index === 0) {
				this.label('Contents', left + MEASURE / 2, TOP + 26, {
					family: 'display',
					size: 22,
					color: INK.strong,
					tracking: 0
				});
				this.y = TOP + 62;
			}
			for (const row of rows) {
				const { section, lines, flow } = row;
				const top = this.y;
				this.y += row.before;
				if (row.over) {
					this.label(section.over?.toUpperCase() ?? '', left, this.y + 7, {
						family: 'ui',
						size: 6.8,
						color: INK.accent,
						tracking: 1.4,
						bold: true,
						start: true
					});
					this.y += row.over;
				}
				if (section.depth === 1 && section.short) {
					const face = this.#picker.main(plainRun(''));
					this.#ink(INK.muted);
					doc
						.font(face)
						.fontSize(10)
						.text(section.short, left, this.y + lines[0].ascent, {
							lineBreak: false,
							baseline: 'alphabetic'
						});
				}
				for (const line of lines) {
					this.#drawAt(line, flow, left + row.left);
					this.y += line.height;
				}
				const last = lines[lines.length - 1];
				const baseline = this.y - last.height + last.ascent;
				const number = String(this.pages[section.key] ?? '');
				const numberFace = this.#picker.main(plainRun(''));
				const width = this.#width(number, numberFace, 10.5);
				const right = left + MEASURE;
				doc
					.lineWidth(0.8)
					.strokeColor(INK.rule)
					.lineCap('round')
					.dash(0.01, { space: 3.4 })
					.moveTo(left + row.left + last.natural + 6, baseline - 0.5)
					.lineTo(right - width - 6, baseline - 0.5)
					.stroke()
					.undash()
					.lineCap('butt');
				this.#ink(INK.text);
				doc
					.font(numberFace)
					.fontSize(10.5)
					.text(number, right - width, baseline, { lineBreak: false, baseline: 'alphabetic' });
				doc.goTo(left, top, MEASURE, this.y - top, section.key);
			}
		});
		doc.switchToPage(numbers - 1);
	}

	/** One line at a set left edge, for pages that are drawn after the book is set. */
	#drawAt(line: Line, flow: Flow, left: number) {
		this.#draw(line, { ...flow, left: left - this.left });
	}
}

/** The manuscript as a PDF, and how many characters no typeface could draw. */
export async function pdfOf(manuscript: Manuscript) {
	const loaded = await faces();
	const name = manuscript.part ? `${manuscript.part.name} · ${manuscript.title}` : manuscript.title;
	// font: null leaves out pdfkit's built-in Helvetica, whose files aren't there once deployed.
	const doc = new PDFDocument({
		autoFirstPage: false,
		bufferPages: true,
		size: [WIDTH, HEIGHT],
		margin: 0,
		font: null as unknown as string,
		displayTitle: true,
		lang: 'en',
		info: { Title: name, Author: manuscript.author, Creator: 'Book Builder' }
	});
	for (const face of Object.values(loaded)) doc.registerFont(face.id, face.bytes);

	const chunks: Buffer[] = [];
	const done = new Promise<Buffer>((resolve, reject) => {
		doc.on('data', (chunk: Buffer) => chunks.push(chunk));
		doc.on('end', () => resolve(Buffer.concat(chunks)));
		doc.on('error', reject);
	});

	const book = new Book(doc, new FacePicker(loaded), manuscript.part?.name ?? manuscript.title);

	if (!manuscript.part) {
		book.cover(manuscript);
		book.addPage();
	}
	book.titlePage(manuscript);
	book.addPage();

	const entries = contentsOf(manuscript);
	const contents = entries.length > 1 ? book.contentsPages(entries) : [];
	const contentsStart = book.number;
	contents.forEach(() => book.addPage());
	// Page 1 is a right-hand page.
	if (book.number % 2 === 1) book.addPage();
	book.front = book.number;

	for (const section of manuscript.sections) {
		if (section.kind === 'part') book.part(section);
		else book.story(section);
	}
	if (contents.length) book.drawContents(contents, contentsStart);

	doc.end();
	return { bytes: await done, missing: book.missing };
}
