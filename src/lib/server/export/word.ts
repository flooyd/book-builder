import {
	AlignmentType,
	Document,
	DropCapType,
	Footer,
	FrameAnchorType,
	FrameWrap,
	Header,
	HeadingLevel,
	LevelFormat,
	LineRuleType,
	Packer,
	PageNumber,
	Paragraph,
	ShadingType,
	TableOfContents,
	TextRun,
	type IParagraphOptions,
	type ParagraphChild
} from 'docx';
import { estimatePageNumbersWith } from 'docx/layout';
import type { RichNode } from '$lib/rich';
import {
	contentsOf,
	descriptionLines,
	runsOf,
	storyOf,
	wordsOf,
	type Family,
	type FirstLetter,
	type Inline,
	type Manuscript,
	type Run,
	type Section
} from './manuscript';

/**
 * A manuscript as a working copy in Word: US Letter with one-inch margins, to edit or send on. It
 * leans on Word's own styles rather than direct formatting, so changing the look of the whole book
 * is one change to Book Text or Heading 2, and the headings fill the Navigation pane and the
 * contents. Cambria and Calibri come with Office on Windows and Mac, and they're fonts the page
 * number estimate can measure, so the contents arrive with their numbers.
 */

const SERIF = 'Cambria';
const SANS = 'Calibri';
const MONO = 'Courier New';

const FONTS: Record<Family, string> = { read: SERIF, display: SERIF, ui: SANS, mono: MONO };

/** Half-points, as Word counts type sizes, and twips (1/20 pt) for everything else. */
const BODY = 23;
const LINE = 320;
const INDENT = 432;
const INCH = 1440;

const INK = {
	text: '24232B',
	strong: '141C45',
	muted: '6B6352',
	accent: '2152D8',
	night: '0B1130'
};

/** #rrggbb as Word writes it. */
const hex = (color: string) => color.slice(1).toUpperCase();

const FIRST = 'BookTextFirst';

function textRun(run: Run, size: number, brokenBefore: boolean) {
	return new TextRun({
		text: run.text,
		...(brokenBefore && { break: 1 }),
		...(run.bold && { bold: true }),
		...(run.italic && { italics: true }),
		...(run.underline && { underline: {} }),
		...(run.strike && { strike: true }),
		...(run.family !== 'read' && run.family !== 'display' && { font: FONTS[run.family] }),
		...(run.scale !== 1 && { size: Math.round(size * run.scale) }),
		...(run.color && { color: hex(run.color) }),
		...(run.highlight && {
			shading: {
				type: ShadingType.CLEAR,
				color: 'auto',
				fill: hex(run.highlight)
			}
		})
	});
}

function childrenOf(inlines: Inline[], size = BODY) {
	const children: ParagraphChild[] = [];
	let broken = false;
	for (const inline of inlines) {
		if (inline === 'break') {
			// Two breaks in a row, or one at the end, have no text of their own to carry them.
			if (broken) children.push(new TextRun({ break: 1 }));
			broken = true;
			continue;
		}
		children.push(textRun(inline, size, broken));
		broken = false;
	}
	if (broken) children.push(new TextRun({ break: 1 }));
	return children;
}

const ALIGNMENTS: Record<string, IParagraphOptions['alignment']> = {
	left: AlignmentType.LEFT,
	center: AlignmentType.CENTER,
	right: AlignmentType.RIGHT,
	justify: AlignmentType.JUSTIFIED
};

const alignmentOf = (node: RichNode) => ALIGNMENTS[String(node.attrs?.textAlign)];

/** Cambria's capitals are about two-thirds of its type size. */
const CAP_HEIGHT = 0.667;

/** A letter raised on the first line is just large text. */
const raisedLetter = (cap: FirstLetter) =>
	new TextRun({
		text: cap.letter,
		size: Math.round(BODY * 2.6),
		color: hex(cap.color),
		font: cap.font === 'ui' ? SANS : SERIF
	});

/** The first letter as Word writes one: a frame beside the lines, the height of the lines. */
function dropCap(cap: FirstLetter): IParagraphOptions {
	const lines = cap.lines;
	const boxed = cap.style === 'boxed';
	const reach = ((lines - 1) * LINE) / 20 + (BODY / 2) * CAP_HEIGHT;
	const size = Math.round((reach / CAP_HEIGHT) * 2);
	return {
		style: FIRST,
		keepNext: true,
		frame: {
			type: 'absolute',
			position: { x: 0, y: 0 },
			dropCap: DropCapType.DROP,
			lines,
			wrap: FrameWrap.AROUND,
			anchor: { horizontal: FrameAnchorType.TEXT, vertical: FrameAnchorType.TEXT },
			space: { horizontal: 72, vertical: 0 }
		},
		spacing: { line: lines * LINE, lineRule: LineRuleType.EXACT, after: 0 },
		children: [
			new TextRun({
				text: boxed ? ` ${cap.letter} ` : cap.letter,
				size: boxed ? Math.round(size * 0.86) : size,
				color: boxed ? INK.night : hex(cap.color),
				font: cap.font === 'ui' ? SANS : SERIF,
				...(boxed && {
					shading: { type: ShadingType.CLEAR, color: 'auto', fill: hex(cap.color) }
				})
			})
		]
	};
}

type Context = {
	quote: number;
	/** Where it sits in a list, if it does. */
	list?: { reference: string; level: number; instance: number };
	cap?: FirstLetter | null;
};

class Blocks {
	/** Each list counts from its own start, so each is numbered separately. */
	#lists = 0;
	/** The numbers ordered lists start from, each needing its own definition in the document. */
	starts: Record<number, true> = { 1: true };

	#paragraph(node: RichNode, context: Context, indented: boolean): IParagraphOptions {
		const { quote, list } = context;
		const runs = runsOf(node.content, quote ? { italic: true } : {});
		return {
			style: quote ? 'BookQuote' : indented ? 'BookText' : FIRST,
			alignment: alignmentOf(node),
			...(quote > 1 && { indent: { left: INDENT * quote } }),
			...(list && { numbering: list }),
			children: childrenOf(runs)
		};
	}

	#heading(node: RichNode): IParagraphOptions {
		const level = Number(node.attrs?.level ?? 1);
		const style = level === 1 ? 'Heading3' : level === 2 ? 'Heading4' : 'Heading5';
		return {
			heading:
				level === 1
					? HeadingLevel.HEADING_3
					: level === 2
						? HeadingLevel.HEADING_4
						: HeadingLevel.HEADING_5,
			style,
			alignment: alignmentOf(node),
			children: childrenOf(runsOf(node.content), level === 1 ? 35 : level === 2 ? 30 : 19)
		};
	}

	#listBlocks(node: RichNode, context: Context) {
		const ordered = node.type === 'orderedList';
		const start = Number(node.attrs?.start ?? 1);
		if (ordered) this.starts[start] = true;
		const level = context.list ? context.list.level + 1 : 0;
		const list = {
			reference: ordered ? `numbers-${start}` : 'bullets',
			level: Math.min(level, 3),
			instance: ordered ? ++this.#lists : 0
		};
		return (node.content ?? []).flatMap((item) =>
			this.of(item.content ?? [], { quote: context.quote, list })
		);
	}

	of(nodes: RichNode[], context: Context): IParagraphOptions[] {
		const blocks: IParagraphOptions[] = [];
		let previous = '';
		let cap = context.cap;
		for (const node of nodes) {
			if (node.type === 'paragraph') {
				const indented = previous === 'paragraph' && !context.list;
				const paragraph = this.#paragraph(node, context, indented);
				if (cap?.style === 'raised') {
					blocks.push({
						...paragraph,
						children: [raisedLetter(cap), ...(paragraph.children ?? [])]
					});
				} else {
					if (cap) blocks.push(dropCap(cap));
					blocks.push(paragraph);
				}
				cap = null;
			} else if (node.type === 'heading') {
				blocks.push(this.#heading(node));
			} else if (node.type === 'blockquote') {
				blocks.push(...this.of(node.content ?? [], { quote: context.quote + 1 }));
			} else if (node.type === 'bulletList' || node.type === 'orderedList') {
				blocks.push(...this.#listBlocks(node, context));
			} else if (node.type === 'horizontalRule') {
				blocks.push({ style: 'SceneBreak', children: [new TextRun('* * *')] });
			}
			previous = node.type;
		}
		return blocks;
	}
}

/** The label and title in one heading, so both reach the contents and the Navigation pane. */
function headingOf(section: Section, level: 'HEADING_1' | 'HEADING_2'): IParagraphOptions {
	const label = section.over
		? [
				new TextRun({
					text: section.over,
					font: SANS,
					size: 18,
					bold: true,
					allCaps: true,
					characterSpacing: 40,
					color: INK.accent
				})
			]
		: [];
	return {
		heading: HeadingLevel[level],
		children: [
			...label,
			...(section.title ? [new TextRun({ text: section.title, break: label.length })] : [])
		]
	};
}

function sectionBlocks(section: Section, blocks: Blocks): IParagraphOptions[] {
	const opens = section.title || section.description;
	const heading = opens
		? [
				{ style: section.kind === 'part' ? 'PartDrop' : 'ChapterDrop', pageBreakBefore: true },
				headingOf(section, section.depth === 0 ? 'HEADING_1' : 'HEADING_2'),
				...descriptionLines(section.description).map((line) => ({
					style: 'Description',
					children: childrenOf(line, 26)
				}))
			]
		: [];
	if (section.kind === 'part') return heading;

	const { blocks: story, cap } = storyOf(section.text);
	const text = blocks.of(story, { quote: 0, cap });
	// With no heading the text still starts its own page, as it does in reading mode's book view.
	if (!opens && text[0]) text[0] = { ...text[0], pageBreakBefore: true };
	return [...heading, ...text];
}

function titlePage(manuscript: Manuscript): IParagraphOptions[] {
	const { part } = manuscript;
	const blurb = part ? part.description : manuscript.blurb;
	return [
		...(part
			? [
					{
						style: 'BookName',
						children: [new TextRun(manuscript.title)]
					}
				]
			: []),
		...(part?.over
			? [
					{
						style: 'TitleLabel',
						children: [new TextRun(part.over)]
					}
				]
			: []),
		{
			heading: HeadingLevel.TITLE,
			children: [new TextRun(part ? part.title : manuscript.title)]
		},
		...(manuscript.author
			? [{ style: 'Byline', children: [new TextRun(`by ${manuscript.author}`)] }]
			: []),
		...descriptionLines(blurb).map((line) => ({
			style: 'Description',
			children: childrenOf(line, 26)
		}))
	];
}

const HEADING_BASE = {
	basedOn: 'Normal',
	next: 'Normal',
	quickFormat: true,
	run: { font: SERIF, color: INK.strong, bold: false }
};

function styles() {
	return {
		default: {
			document: {
				run: { font: SERIF, size: BODY, color: INK.text },
				paragraph: { spacing: { line: LINE, lineRule: LineRuleType.AT_LEAST, after: 0 } }
			},
			title: {
				run: { font: SERIF, size: 80, color: INK.strong, bold: false },
				paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 2400, after: 360 } }
			},
			heading1: {
				run: { ...HEADING_BASE.run, size: 60 },
				paragraph: {
					alignment: AlignmentType.CENTER,
					keepNext: true,
					spacing: { after: 360 }
				}
			},
			heading2: {
				run: { ...HEADING_BASE.run, size: 48 },
				paragraph: {
					alignment: AlignmentType.CENTER,
					keepNext: true,
					spacing: { after: 480 }
				}
			},
			heading3: {
				run: { ...HEADING_BASE.run, size: 35 },
				paragraph: { keepNext: true, spacing: { before: 300, after: 120 } }
			},
			heading4: {
				run: { ...HEADING_BASE.run, size: 30 },
				paragraph: { keepNext: true, spacing: { before: 300, after: 120 } }
			},
			heading5: {
				run: {
					font: SANS,
					size: 19,
					bold: true,
					allCaps: true,
					characterSpacing: 30,
					color: INK.accent
				},
				paragraph: { keepNext: true, spacing: { before: 300, after: 120 } }
			}
		},
		paragraphStyles: [
			// The empty space above a heading. Word ignores space before at the top of a page, so
			// these are paragraphs: changing the height of one moves every part or chapter.
			{
				id: 'ChapterDrop',
				name: 'Chapter Drop',
				basedOn: 'Normal',
				next: 'Normal',
				paragraph: { keepNext: true, spacing: { line: 1000, lineRule: LineRuleType.EXACT } }
			},
			{
				id: 'PartDrop',
				name: 'Part Drop',
				basedOn: 'Normal',
				next: 'Normal',
				paragraph: { keepNext: true, spacing: { line: 3600, lineRule: LineRuleType.EXACT } }
			},
			{
				id: 'BookText',
				name: 'Book Text',
				basedOn: 'Normal',
				quickFormat: true,
				paragraph: { indent: { firstLine: INDENT } }
			},
			{
				id: FIRST,
				name: 'Book Text First',
				basedOn: 'Normal',
				next: 'BookText',
				quickFormat: true
			},
			{
				id: 'BookQuote',
				name: 'Book Quote',
				basedOn: 'Normal',
				quickFormat: true,
				paragraph: { indent: { left: INDENT, right: 288 }, spacing: { before: 120, after: 120 } }
			},
			{
				id: 'SceneBreak',
				name: 'Scene Break',
				basedOn: 'Normal',
				next: FIRST,
				quickFormat: true,
				run: { color: INK.muted },
				paragraph: {
					alignment: AlignmentType.CENTER,
					keepNext: true,
					spacing: { before: 240, after: 240 }
				}
			},
			{
				id: 'Description',
				name: 'Book Description',
				basedOn: 'Normal',
				quickFormat: true,
				run: { size: 26, color: INK.muted },
				paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 240 } }
			},
			{
				id: 'Byline',
				name: 'Byline',
				basedOn: 'Normal',
				quickFormat: true,
				run: { size: 28, color: INK.muted },
				paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 480 } }
			},
			{
				id: 'BookName',
				name: 'Book Name',
				basedOn: 'Normal',
				quickFormat: true,
				run: { font: SANS, size: 20, bold: true, allCaps: true, characterSpacing: 40 },
				paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 2000, after: 480 } }
			},
			{
				id: 'TitleLabel',
				name: 'Title Label',
				basedOn: 'Normal',
				quickFormat: true,
				run: {
					font: SANS,
					size: 20,
					bold: true,
					allCaps: true,
					characterSpacing: 40,
					color: INK.accent
				},
				paragraph: { alignment: AlignmentType.CENTER }
			},
			{
				id: 'ContentsTitle',
				name: 'Contents Title',
				basedOn: 'Normal',
				next: 'Normal',
				quickFormat: true,
				run: { size: 48, color: INK.strong },
				paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 480 } }
			},
			{
				id: 'Header',
				name: 'header',
				basedOn: 'Normal',
				run: { font: SANS, size: 16, color: INK.muted, characterSpacing: 30, allCaps: true },
				paragraph: { alignment: AlignmentType.CENTER }
			},
			{
				id: 'Footer',
				name: 'footer',
				basedOn: 'Normal',
				run: { size: 19, color: INK.muted },
				paragraph: { alignment: AlignmentType.CENTER }
			}
		]
	};
}

const levels = (format: (typeof LevelFormat)[keyof typeof LevelFormat], start: number) =>
	[0, 1, 2, 3].map((level) => ({
		level,
		format,
		start,
		text: format === LevelFormat.BULLET ? '•' : `%${level + 1}.`,
		alignment: AlignmentType.LEFT,
		style: { paragraph: { indent: { left: INDENT * (level + 1), hanging: 288 } } }
	}));

/**
 * Working out the page numbers takes about 8 seconds per 100,000 words, where the rest of the file
 * takes a fraction of one. Past this length that would risk the server's time limit, so the
 * contents go out unnumbered and Word offers to fill them in when the file opens.
 */
const MOST_WORDS_TO_NUMBER = 250_000;

/** The manuscript as a .docx file. */
export async function wordOf(manuscript: Manuscript) {
	const blocks = new Blocks();
	const body = manuscript.sections.flatMap((section) => sectionBlocks(section, blocks));
	const contents = contentsOf(manuscript);
	const name = manuscript.part ? `${manuscript.part.name} · ${manuscript.title}` : manuscript.title;

	const document = new Document({
		title: name,
		creator: manuscript.author,
		lastModifiedBy: manuscript.author,
		styles: styles(),
		// Without the guess, one frame (a first letter) would leave every later page number blank.
		pageNumbers:
			wordsOf(manuscript) > MOST_WORDS_TO_NUMBER
				? undefined
				: estimatePageNumbersWith({ guess: true }),
		numbering: {
			config: [
				{ reference: 'bullets', levels: levels(LevelFormat.BULLET, 1) },
				...Object.keys(blocks.starts).map((start) => ({
					reference: `numbers-${start}`,
					levels: levels(LevelFormat.DECIMAL, Number(start))
				}))
			]
		},
		sections: [
			{
				properties: {
					// The title page goes without the header and page number.
					titlePage: true,
					page: {
						size: { width: 12240, height: 15840 },
						margin: { top: INCH, bottom: INCH, left: INCH, right: INCH }
					}
				},
				headers: {
					default: new Header({
						children: [new Paragraph({ style: 'Header', children: [new TextRun(name)] })]
					})
				},
				footers: {
					default: new Footer({
						children: [
							new Paragraph({
								style: 'Footer',
								children: [new TextRun({ children: [PageNumber.CURRENT] })]
							})
						]
					})
				},
				children: [
					...titlePage(manuscript).map((options) => new Paragraph(options)),
					...(contents.length > 1
						? [
								new Paragraph({
									style: 'ContentsTitle',
									pageBreakBefore: true,
									children: [new TextRun('Contents')]
								}),
								new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-2' })
							]
						: []),
					...body.map((options) => new Paragraph(options))
				]
			}
		]
	});

	return { bytes: await Packer.toBuffer(document), missing: 0 };
}
