<script lang="ts" module>
	// 24x24 stroke icons used across the mockups. A string is a <path d>, a tuple is a <circle>.
	type Shape = string | [cx: number, cy: number, r: number];

	const ICONS = {
		book: ['M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20'],
		layers: ['m12 2 10 5-10 5L2 7z', 'm2 17 10 5 10-5', 'm2 12 10 5 10-5'],
		'file-text': [
			'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
			'M14 2v6h6',
			'M16 13H8M16 17H8'
		],
		users: [
			'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
			[9, 7, 4],
			'M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75'
		],
		'share-2': [[18, 5, 3], [6, 12, 3], [18, 19, 3], 'm8.6 13.5 6.8 4M15.4 6.5l-6.8 4'],
		plus: ['M5 12h14M12 5v14'],
		'arrow-right': ['M5 12h14M12 5l7 7-7 7'],
		pen: ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z'],
		x: ['M18 6 6 18M6 6l12 12'],
		check: ['M20 6 9 17l-5-5'],
		'check-circle': [[12, 12, 9], 'm8.5 12 2.5 2.5 4.5-5'],
		'chevron-down': ['m6 9 6 6 6-6'],
		'chevron-right': ['m9 18 6-6-6-6'],
		save: [
			'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z',
			'M17 21v-8H7v8M7 3v5h8'
		],
		trash: ['M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6'],
		'git-branch': ['M6 3v12', [18, 6, 3], [6, 18, 3], 'M18 9a9 9 0 0 1-9 9'],
		'alert-circle': [[12, 12, 9], 'M12 8v5M12 16.5v.01'],
		info: [[12, 12, 9], 'M12 8v4M12 16h.01'],
		'list-tree': ['M21 12h-8M21 6H8M21 18h-8M3 6v4c0 1.1.9 2 2 2h3M3 10v6c0 1.1.9 2 2 2h3'],
		'book-open': [
			'M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z',
			'M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z'
		],
		sun: [
			[12, 12, 4],
			'M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41'
		],
		moon: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z']
	} satisfies Record<string, Shape[]>;

	export type IconName = keyof typeof ICONS;
</script>

<script lang="ts">
	let {
		name,
		size = 16,
		strokeWidth = 2,
		class: className
	}: { name: IconName; size?: number; strokeWidth?: number; class?: string } = $props();

	const shapes: Shape[] = $derived(ICONS[name]);
</script>

<svg
	class={className}
	aria-hidden="true"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width={strokeWidth}
	stroke-linecap="round"
	stroke-linejoin="round"
>
	{#each shapes as shape, i (i)}
		{#if typeof shape === 'string'}
			<path d={shape} />
		{:else}
			<circle cx={shape[0]} cy={shape[1]} r={shape[2]} />
		{/if}
	{/each}
</svg>

<style>
	svg {
		flex: none;
	}
</style>
