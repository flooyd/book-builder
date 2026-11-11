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

/** How much of the file goes out at a time. */
const CHUNK = 256 * 1024;

/**
 * A finished file sent a piece at a time. Vercel caps a function's response at 4.5 MB unless it's
 * streamed, and pictures make files bigger than that.
 */
function streamOf(bytes: Uint8Array) {
	let at = 0;
	return new ReadableStream<Uint8Array>({
		pull(controller) {
			if (at >= bytes.length) {
				controller.close();
				return;
			}
			controller.enqueue(bytes.subarray(at, at + CHUNK));
			at += CHUNK;
		}
	});
}

/** The manuscript as a file to download, in this format. */
export async function exportResponse(manuscript: Manuscript, format: ExportFormat) {
	if (!hasStoryText(manuscript)) {
		return json({ error: "There's no story text to export yet." }, { status: 400 });
	}
	const { bytes, missing } = await (format === 'pdf' ? pdfOf(manuscript) : wordOf(manuscript));
	const name = exportFileName(manuscript.part?.name ?? manuscript.title, format);
	return new Response(streamOf(new Uint8Array(bytes)), {
		headers: {
			'Content-Type': EXPORT_FORMATS[format].type,
			'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
			'Cache-Control': 'private, no-store',
			...(missing && { [MISSING_HEADER]: String(missing) })
		}
	});
}
