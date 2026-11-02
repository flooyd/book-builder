import { resolve } from '$app/paths';
import type { SectionInsight } from '$lib/insights';

/** Where a chapter or story-text part is written. */
export const sectionHref = (section: Pick<SectionInsight, 'target' | 'id'>) =>
	section.target === 'chapter'
		? resolve('/chapter/[id]', { id: String(section.id) })
		: resolve('/part/[id]', { id: String(section.id) });

/** Its label and title, or the one name a story-text part goes by. */
export const nameOf = (section: Pick<SectionInsight, 'label' | 'title'>) =>
	section.label === section.title ? section.title : `${section.label}: ${section.title}`;

/** Sections with their reading-order index, gathered by part, for charts that space parts apart. */
export function byPart(sections: SectionInsight[]) {
	const groups: { group: number; rows: { section: SectionInsight; index: number }[] }[] = [];
	sections.forEach((section, index) => {
		const last = groups[groups.length - 1];
		if (last?.group === section.group) last.rows.push({ section, index });
		else groups.push({ group: section.group, rows: [{ section, index }] });
	});
	return groups;
}
