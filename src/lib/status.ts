// Writing status of a chapter, or of a part that holds its own story text. Shared by the server
// (validation) and the outline.

export const STATUSES = [
	{ id: 'idea', label: 'Idea' },
	{ id: 'outlined', label: 'Outlined' },
	{ id: 'drafting', label: 'Drafting' },
	{ id: 'revising', label: 'Revising' },
	{ id: 'done', label: 'Done' }
] as const;

export type Status = (typeof STATUSES)[number]['id'];

export const isStatus = (value: unknown): value is Status =>
	STATUSES.some((status) => status.id === value);

export const statusLabel = (status: string) =>
	STATUSES.find((s) => s.id === status)?.label ?? 'Idea';
