import { json } from '@sveltejs/kit';
import {
	EXPORT_FORMATS,
	MISSING_HEADER,
	exportFileName,
	isExportFormat,
	type ExportFormat
} from '$lib/export';
import { hasStoryText, type Manuscript } from './manuscript';
import { pdfOf } from './pdf';
import { wordOf } from './word';

export { bookManuscript, partManuscript } from './manuscript';

/** The format asked for in a request's query string, or an error to send back. */
export function requestedFormat(url: URL): ExportFormat | Response {
	const format = url.searchParams.get('format');
	if (isExportFormat(format)) return format;
	return json({ error: 'Choose PDF or Word.' }, { status: 400 });
}

/** The manuscript as a file to download, in this format. */
export async function exportResponse(manuscript: Manuscript, format: ExportFormat) {
	if (!hasStoryText(manuscript)) {
		return json({ error: "There's no story text to export yet." }, { status: 400 });
	}
	const { bytes, missing } = await (format === 'pdf' ? pdfOf(manuscript) : wordOf(manuscript));
	const name = exportFileName(manuscript.part?.name ?? manuscript.title, format);
	return new Response(new Uint8Array(bytes), {
		headers: {
			'Content-Type': EXPORT_FORMATS[format].type,
			'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
			'Cache-Control': 'private, no-store',
			...(missing && { [MISSING_HEADER]: String(missing) })
		}
	});
}
