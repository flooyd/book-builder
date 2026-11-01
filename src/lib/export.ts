/** Exporting a book or a part: the two formats, and what a downloaded file is called. */

export type ExportFormat = 'pdf' | 'docx';

export const EXPORT_FORMATS: Record<
	ExportFormat,
	{ name: string; extension: string; type: string }
> = {
	pdf: { name: 'PDF', extension: 'pdf', type: 'application/pdf' },
	docx: {
		name: 'Word',
		extension: 'docx',
		type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
	}
};

export const isExportFormat = (value: unknown): value is ExportFormat =>
	value === 'pdf' || value === 'docx';

/**
 * Set by the server when a PDF has characters none of its typefaces can draw, with how many there
 * are. Word doesn't need it: it finds a font of its own for them.
 */
export const MISSING_HEADER = 'X-Export-Missing';

/** A file name that's safe everywhere: the title without what systems refuse in a name. */
export function exportFileName(title: string, format: ExportFormat) {
	const safe = title
		// eslint-disable-next-line no-control-regex -- control characters are what's being removed
		.replace(/[\u0000-\u001f<>:"/\\|?*]+/g, ' ')
		.replace(/\s+/g, ' ')
		.replace(/^[\s.]+|[\s.]+$/g, '')
		.slice(0, 120)
		.trim();
	return `${safe || 'Book'}.${EXPORT_FORMATS[format].extension}`;
}
