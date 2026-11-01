/**
 * Headings: what a reader sees at the top of a part or chapter. A book sets the style of its
 * automatic labels ("Part One", "Chapter 3"), and each part or chapter can take a label of its
 * own, go without one, or hide its title. Only those on an automatic label take a number, so an
 * interlude between chapters 3 and 4 leaves no gap.
 */

/** How a book writes its automatic labels. */
export type LabelStyle = 'words' | 'roman' | 'numeral' | 'bare' | 'none';
export type Noun = 'Part' | 'Chapter';

export const LABEL_STYLES: LabelStyle[] = ['words', 'roman', 'numeral', 'bare', 'none'];

export const isLabelStyle = (value: unknown): value is LabelStyle =>
	LABEL_STYLES.includes(value as LabelStyle);

/** The longest label a part or chapter can have of its own. */
export const HEADING_LABEL_LENGTH = 60;

const ONES = [
	'One',
	'Two',
	'Three',
	'Four',
	'Five',
	'Six',
	'Seven',
	'Eight',
	'Nine',
	'Ten',
	'Eleven',
	'Twelve',
	'Thirteen',
	'Fourteen',
	'Fifteen',
	'Sixteen',
	'Seventeen',
	'Eighteen',
	'Nineteen'
];
const TENS = ['Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

/** "Seven", "Twenty-One", "One Hundred and Four"; digits from a thousand on. */
export function numberWords(n: number): string {
	if (n < 1 || n >= 1000) return String(n);
	if (n < 20) return ONES[n - 1];
	if (n < 100) {
		const units = n % 10;
		return TENS[Math.floor(n / 10) - 2] + (units ? `-${ONES[units - 1]}` : '');
	}
	const rest = n % 100;
	return `${ONES[Math.floor(n / 100) - 1]} Hundred${rest ? ` and ${numberWords(rest)}` : ''}`;
}

const NUMERALS: [number, string][] = [
	[1000, 'M'],
	[900, 'CM'],
	[500, 'D'],
	[400, 'CD'],
	[100, 'C'],
	[90, 'XC'],
	[50, 'L'],
	[40, 'XL'],
	[10, 'X'],
	[9, 'IX'],
	[5, 'V'],
	[4, 'IV'],
	[1, 'I']
];

/** "XIV"; digits from four thousand on, past where numerals are written. */
export function romanNumeral(n: number) {
	if (n < 1 || n >= 4000) return String(n);
	let left = n;
	let written = '';
	for (const [value, numeral] of NUMERALS) {
		while (left >= value) {
			written += numeral;
			left -= value;
		}
	}
	return written;
}

/** The automatic label of the nth part or chapter; null for the style with no label. */
export function styledLabel(noun: Noun, number: number, style: LabelStyle) {
	if (style === 'none') return null;
	if (style === 'bare') return String(number);
	if (style === 'words') return `${noun} ${numberWords(number)}`;
	return `${noun} ${style === 'roman' ? romanNumeral(number) : number}`;
}

/** What a reader sees of a part or chapter. */
export type Heading = {
	/** The small line above the title; null when there isn't one. */
	over: string | null;
	/** The large line: the title, or the label when the title is hidden. Blank if neither shows. */
	title: string;
	/** In the contents, an automatic chapter label comes down to this number. */
	short: string | null;
};

/**
 * A heading from its parts. `own` is the writer's label (null follows the book, '' hides it),
 * `number` is what it takes on its automatic label, and a blank `title` is a hidden one. With no
 * title the label takes its place, so a chapter known only by its number still opens properly.
 */
export function headingOf(
	own: string | null,
	noun: Noun,
	number: number | null,
	style: LabelStyle,
	title: string
): Heading {
	const label =
		own !== null ? own || null : number === null ? null : styledLabel(noun, number, style);
	if (!title) return { over: null, title: label ?? '', short: null };
	const automatic = noun === 'Chapter' && own === null && label !== null && number !== null;
	return {
		over: label,
		title,
		short: automatic ? (style === 'roman' ? romanNumeral(number) : String(number)) : null
	};
}

/** The styles a book sets for its headings. */
export type HeadingStyles = { partLabels: LabelStyle; chapterLabels: LabelStyle };

export const partHeading = (
	entry: { part: { headingLabel: string | null; title: string }; number: number | null },
	styles: HeadingStyles
) => headingOf(entry.part.headingLabel, 'Part', entry.number, styles.partLabels, entry.part.title);

export const chapterHeading = (
	item: { chapter: { headingLabel: string | null; title: string }; number: number | null },
	styles: HeadingStyles
) =>
	headingOf(
		item.chapter.headingLabel,
		'Chapter',
		item.number,
		styles.chapterLabels,
		item.chapter.title
	);
