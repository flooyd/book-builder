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
		moon: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z'],
		'arrow-left': ['M19 12H5M12 19l-7-7 7-7'],
		copy: ['M9 9h11v11H9z', 'M5 15H4V4h11v1'],
		globe: [[12, 12, 9], 'M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18'],
		lock: ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 8 0v4'],
		grip: [
			[9, 6, 1],
			[15, 6, 1],
			[9, 12, 1],
			[15, 12, 1],
			[9, 18, 1],
			[15, 18, 1]
		],
		search: [[11, 11, 7], 'm21 21-4.3-4.3'],
		columns: ['M3 4h5v16H3zM10 4h5v10h-5zM17 4h4v13h-4z'],
		undo: ['M9 14 4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 0 11H11'],
		redo: ['m15 14 5-5-5-5', 'M20 9H9.5a5.5 5.5 0 0 0 0 11H13'],
		'align-left': ['M3 6h18M3 12h12M3 18h16'],
		'align-center': ['M3 6h18M6 12h12M4 18h16'],
		'align-right': ['M3 6h18M9 12h12M5 18h16'],
		'align-justify': ['M3 6h18M3 12h18M3 18h18'],
		list: ['M9 6h12M9 12h12M9 18h12', [4, 6, 1], [4, 12, 1], [4, 18, 1]],
		'list-ordered': [
			'M10 6h11M10 12h11M10 18h11',
			'M4 4h1.5v5',
			'M3.5 14.5a1.5 1.5 0 0 1 3 0c0 1-3 2.5-3 3.5h3'
		],
		quote: ['M6 7h4v5c0 2.5-1.5 4-4 5', 'M14 7h4v5c0 2.5-1.5 4-4 5'],
		'scene-break': ['M2 12h6M16 12h6', 'M12 8.5l3.5 3.5-3.5 3.5L8.5 12z'],
		eraser: ['M8 21h12', 'm5.5 15.5 9-9a2 2 0 0 1 2.8 0l1.7 1.7a2 2 0 0 1 0 2.8L11 19H7.5z'],
		target: [
			[12, 12, 9],
			[12, 12, 5],
			[12, 12, 1]
		],
		focus: [
			'M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3',
			[12, 12, 3]
		],
		user: [[12, 8, 4], 'M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1'],
		highlighter: [
			'm9 11-6 6v3h3l6-6',
			'm22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4'
		]
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
