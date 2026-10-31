// The outline as plain text, for "Import from text" and "Copy as text":
//
//   # Part One — The Drowned Moon   a part that holds chapters ("— synopsis" is optional)
//   > Prologue                      a part that holds its own story text
//   Salvage Rights                  every other line is a chapter of the part above it
//
// List markers ("- ", "* ", "1. ") in front of chapters are dropped, and " -- " works in place
// of " — ". Formatting in synopses doesn't survive the trip: they export as plain text.

import { plainText } from '$lib/rich';

type Draft = { title: string; description: string };

export type ParsedOutline = {
	/** Chapters before the first part line; they go into a part chosen on import. */
	chapters: Draft[];
	parts: (Draft & { hasChapters: boolean; chapters: Draft[] })[];
};

const SYNOPSIS = /\s+(?:—|–|--)\s+/;
const TITLE_MAX = 200;

function draft(text: string): Draft {
	const [title, ...rest] = text.split(SYNOPSIS);
	return { title: title.trim().slice(0, TITLE_MAX), description: rest.join(' — ').trim() };
}

export function parseOutline(text: string): ParsedOutline {
	const parsed: ParsedOutline = { chapters: [], parts: [] };
	// Chapters go into the latest part that holds chapters; a story-text part can't take them.
	let holder: ParsedOutline['parts'][number] | null = null;

	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim();
		const marker = /^(#+|>)\s*/.exec(line);
		if (marker) {
			const item = draft(line.slice(marker[0].length));
			if (!item.title) continue;
			const part = { ...item, hasChapters: marker[1] !== '>', chapters: [] };
			parsed.parts.push(part);
			if (part.hasChapters) holder = part;
		} else {
			const item = draft(line.replace(/^(?:[-*+•]|\d+[.)])\s+/, ''));
			if (!item.title) continue;
			(holder ? holder.chapters : parsed.chapters).push(item);
		}
	}
	return parsed;
}

function line(prefix: string, item: { title: string; description: string }) {
	const synopsis = plainText(item.description, 'description').replace(/\s+/g, ' ').trim();
	return `${prefix}${item.title}${synopsis ? ` — ${synopsis}` : ''}`;
}

/** The outline in the format parseOutline reads. */
export function outlineToText(
	groups: {
		part: { title: string; description: string; holdsChapters: boolean };
		chapters: { title: string; description: string }[];
	}[]
) {
	return groups
		.map(({ part, chapters }) =>
			part.holdsChapters
				? [line('# ', part), ...chapters.map((chapter) => line('', chapter))].join('\n')
				: line('> ', part)
		)
		.join('\n\n');
}
