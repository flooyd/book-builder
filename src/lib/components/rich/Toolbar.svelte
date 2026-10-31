<script lang="ts">
	import type { Editor } from '@tiptap/core';
	import {
		CAP_FONTS,
		CAP_STYLES,
		DEFAULT_CAP,
		FONTS,
		HIGHLIGHTS,
		INKS,
		SIZES,
		cleanCap,
		highlightVar,
		inkVar,
		type DropCap,
		type RichKind
	} from '$lib/rich';
	import Icon, { type IconName } from '$lib/components/ui/Icon.svelte';
	import Menu from './Menu.svelte';

	// Formatting controls for a RichEditor. Story text gets everything; descriptions get the
	// inline marks. `version` changes on every editor transaction, so the controls re-read state.
	let { editor, version, kind }: { editor: Editor; version: number; kind: RichKind } = $props();

	const uid = $props.id();
	const story = $derived(kind === 'story');

	const ALIGNS = ['left', 'center', 'right', 'justify'] as const;

	const now = $derived.by(() => {
		void version;
		const style = editor.getAttributes('textStyle');
		const heading = [1, 2, 3].find((level) => editor.isActive('heading', { level }));
		return {
			bold: editor.isActive('bold'),
			italic: editor.isActive('italic'),
			underline: editor.isActive('underline'),
			strike: editor.isActive('strike'),
			color: (style.color as string | undefined) ?? '',
			size: (style.fontSize as string | undefined) ?? '',
			font: (style.fontFamily as string | undefined) ?? '',
			highlight: (editor.getAttributes('highlight').color as string | undefined) ?? '',
			block: heading ? `h${heading}` : editor.isActive('blockquote') ? 'quote' : 'p',
			align: ALIGNS.find((align) => editor.isActive({ textAlign: align })) ?? 'left',
			bullet: editor.isActive('bulletList'),
			ordered: editor.isActive('orderedList'),
			canUndo: editor.can().undo(),
			canRedo: editor.can().redo(),
			cap: story ? (cleanCap(editor.state.doc.attrs.dropCap) ?? DEFAULT_CAP) : DEFAULT_CAP
		};
	});

	const chain = () => editor.chain().focus();
	// Toolbar buttons don't take focus from the text, so the selection stays put.
	const keep = (event: PointerEvent) => event.preventDefault();

	function setBlock(value: string) {
		if (value === 'quote') {
			if (now.block !== 'quote') chain().setParagraph().toggleBlockquote().run();
			return;
		}
		if (now.block === 'quote') chain().lift('blockquote').run();
		if (value === 'p') chain().setParagraph().run();
		else
			chain()
				.setHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 })
				.run();
	}

	const setFont = (value: string) =>
		value ? chain().setFontFamily(value).run() : chain().unsetFontFamily().run();
	const setSize = (value: string) =>
		value ? chain().setFontSize(value).run() : chain().unsetFontSize().run();
	const setColor = (value: string) =>
		value ? chain().setColor(value).run() : chain().unsetColor().run();
	const setHighlight = (value: string) =>
		value ? chain().setHighlight({ color: value }).run() : chain().unsetHighlight().run();

	function setCap(change: Partial<DropCap>) {
		const next = { ...now.cap, ...change };
		chain()
			.command(({ tr }) => {
				tr.setDocAttribute('dropCap', next);
				return true;
			})
			.run();
	}

	/** A colour input wants #rrggbb; palette colours are CSS variables. */
	const hexOr = (value: string, fallback: string) =>
		/^#[0-9a-f]{6}$/i.test(value) ? value : fallback;

	const marks: { name: 'bold' | 'italic' | 'underline' | 'strike'; label: string; keys: string }[] =
		[
			{ name: 'bold', label: 'Bold', keys: 'Ctrl+B' },
			{ name: 'italic', label: 'Italic', keys: 'Ctrl+I' },
			{ name: 'underline', label: 'Underline', keys: 'Ctrl+U' },
			{ name: 'strike', label: 'Strikethrough', keys: 'Ctrl+Shift+S' }
		];
	const alignIcons: Record<(typeof ALIGNS)[number], IconName> = {
		left: 'align-left',
		center: 'align-center',
		right: 'align-right',
		justify: 'align-justify'
	};
</script>

{#snippet swatches(
	current: string,
	options: readonly { id: string; label: string }[],
	toValue: (id: string) => string,
	apply: (value: string) => void,
	close: () => void,
	noneLabel: string
)}
	<div class="swatches">
		<button
			type="button"
			class="swatch none"
			aria-label={noneLabel}
			title={noneLabel}
			aria-pressed={!current}
			onpointerdown={keep}
			onclick={() => {
				apply('');
				close();
			}}
		>
			<Icon name="x" size={14} />
		</button>
		{#each options as option (option.id)}
			<button
				type="button"
				class="swatch"
				style:--swatch={toValue(option.id)}
				aria-label={option.label}
				title={option.label}
				aria-pressed={current === toValue(option.id)}
				onpointerdown={keep}
				onclick={() => {
					apply(toValue(option.id));
					close();
				}}
			></button>
		{/each}
	</div>
{/snippet}

<div class={['toolbar', kind]} role="toolbar" aria-label="Formatting">
	{#if story}
		<div class="group">
			<button
				type="button"
				class="tool"
				aria-label="Undo"
				title="Undo (Ctrl+Z)"
				disabled={!now.canUndo}
				onpointerdown={keep}
				onclick={() => chain().undo().run()}><Icon name="undo" size={17} /></button
			>
			<button
				type="button"
				class="tool"
				aria-label="Redo"
				title="Redo (Ctrl+Shift+Z)"
				disabled={!now.canRedo}
				onpointerdown={keep}
				onclick={() => chain().redo().run()}><Icon name="redo" size={17} /></button
			>
		</div>
		<div class="group">
			<select
				class="pick"
				aria-label="Paragraph style"
				value={now.block}
				onchange={(event) => setBlock(event.currentTarget.value)}
			>
				<option value="p">Paragraph</option>
				<option value="h1">Heading 1</option>
				<option value="h2">Heading 2</option>
				<option value="h3">Heading 3</option>
				<option value="quote">Quote</option>
			</select>
			<select
				class="pick"
				aria-label="Typeface"
				value={now.font}
				onchange={(event) => setFont(event.currentTarget.value)}
			>
				{#each FONTS as font (font.label)}
					<option value={font.value}>{font.label}</option>
				{/each}
			</select>
			<select
				class="pick"
				aria-label="Text size"
				value={now.size}
				onchange={(event) => setSize(event.currentTarget.value)}
			>
				{#each SIZES as size (size.label)}
					<option value={size.value}>{size.label}</option>
				{/each}
			</select>
		</div>
	{/if}

	<div class="group">
		{#each marks as mark (mark.name)}
			<button
				type="button"
				class={['tool', 'glyph', mark.name]}
				aria-label={mark.label}
				title="{mark.label} ({mark.keys})"
				aria-pressed={now[mark.name]}
				onpointerdown={keep}
				onclick={() => chain().toggleMark(mark.name).run()}
				>{mark.name === 'bold'
					? 'B'
					: mark.name === 'italic'
						? 'I'
						: mark.name === 'underline'
							? 'U'
							: 'S'}</button
			>
		{/each}
	</div>

	<div class="group">
		<button
			type="button"
			class="tool"
			popovertarget="{uid}-ink"
			aria-label="Text colour"
			title="Text colour"
			onpointerdown={keep}
		>
			<span class="ink-glyph" style:--swatch={now.color || 'currentColor'}>A</span>
		</button>
		<Menu id="{uid}-ink" label="Text colour" width={236}>
			{#snippet children(close)}
				<p class="menu-label">Text colour</p>
				{@render swatches(now.color, INKS, inkVar, setColor, close, 'Default colour')}
				<label class="custom">
					<input
						type="color"
						value={hexOr(now.color, '#2b63f5')}
						oninput={(event) => editor.chain().setColor(event.currentTarget.value).run()}
					/>
					Any colour
				</label>
			{/snippet}
		</Menu>

		<button
			type="button"
			class="tool"
			popovertarget="{uid}-mark"
			aria-label="Highlight"
			title="Highlight"
			onpointerdown={keep}
		>
			<span class="mark-glyph" style:--swatch={now.highlight || 'transparent'}
				><Icon name="highlighter" size={16} /></span
			>
		</button>
		<Menu id="{uid}-mark" label="Highlight" width={236}>
			{#snippet children(close)}
				<p class="menu-label">Highlight</p>
				{@render swatches(
					now.highlight,
					HIGHLIGHTS,
					highlightVar,
					setHighlight,
					close,
					'No highlight'
				)}
				<label class="custom">
					<input
						type="color"
						value={hexOr(now.highlight, '#fbeaa0')}
						oninput={(event) =>
							editor.chain().setHighlight({ color: event.currentTarget.value }).run()}
					/>
					Any colour
				</label>
			{/snippet}
		</Menu>
	</div>

	{#if story}
		<div class="group">
			{#each ALIGNS as align (align)}
				<button
					type="button"
					class="tool"
					aria-label="Align {align}"
					title="Align {align}"
					aria-pressed={now.align === align}
					onpointerdown={keep}
					onclick={() => chain().setTextAlign(align).run()}
					><Icon name={alignIcons[align]} size={17} /></button
				>
			{/each}
		</div>

		<div class="group">
			<button
				type="button"
				class="tool"
				aria-label="Bulleted list"
				title="Bulleted list"
				aria-pressed={now.bullet}
				onpointerdown={keep}
				onclick={() => chain().toggleBulletList().run()}><Icon name="list" size={17} /></button
			>
			<button
				type="button"
				class="tool"
				aria-label="Numbered list"
				title="Numbered list"
				aria-pressed={now.ordered}
				onpointerdown={keep}
				onclick={() => chain().toggleOrderedList().run()}
				><Icon name="list-ordered" size={17} /></button
			>
			<button
				type="button"
				class="tool"
				aria-label="Quote"
				title="Quote"
				aria-pressed={now.block === 'quote'}
				onpointerdown={keep}
				onclick={() => setBlock(now.block === 'quote' ? 'p' : 'quote')}
				><Icon name="quote" size={17} /></button
			>
			<button
				type="button"
				class="tool"
				aria-label="Scene break"
				title="Scene break"
				onpointerdown={keep}
				onclick={() => chain().setHorizontalRule().run()}
				><Icon name="scene-break" size={18} /></button
			>
		</div>

		<div class="group">
			<button
				type="button"
				class="tool cap-tool"
				popovertarget="{uid}-cap"
				aria-label="First letter"
				title="First letter"
				onpointerdown={keep}
			>
				<span
					class="cap-glyph"
					style:--swatch={now.cap.color.startsWith('#') ? now.cap.color : inkVar(now.cap.color)}
					>A</span
				><span class="cap-lines" aria-hidden="true"></span>
			</button>
			<Menu id="{uid}-cap" label="First letter" width={268}>
				<p class="menu-label" id="{uid}-cap-style">First letter</p>
				<div class="segmented" role="group" aria-labelledby="{uid}-cap-style">
					{#each CAP_STYLES as style (style.id)}
						<button
							type="button"
							aria-pressed={now.cap.style === style.id}
							onpointerdown={keep}
							onclick={() => setCap({ style: style.id })}>{style.label}</button
						>
					{/each}
				</div>
				{#if now.cap.style !== 'none'}
					{#if now.cap.style !== 'raised'}
						<p class="menu-label" id="{uid}-cap-lines">Height</p>
						<div class="segmented" role="group" aria-labelledby="{uid}-cap-lines">
							{#each [2, 3, 4] as const as lines (lines)}
								<button
									type="button"
									aria-pressed={now.cap.lines === lines}
									onpointerdown={keep}
									onclick={() => setCap({ lines })}>{lines} lines</button
								>
							{/each}
						</div>
					{/if}
					<p class="menu-label" id="{uid}-cap-font">Typeface</p>
					<div class="segmented" role="group" aria-labelledby="{uid}-cap-font">
						{#each CAP_FONTS as font (font.id)}
							<button
								type="button"
								style:font-family={font.css}
								aria-pressed={now.cap.font === font.id}
								onpointerdown={keep}
								onclick={() => setCap({ font: font.id })}>{font.label}</button
							>
						{/each}
					</div>
					<p class="menu-label">Colour</p>
					<div class="swatches">
						{#each INKS as ink (ink.id)}
							<button
								type="button"
								class="swatch"
								style:--swatch={inkVar(ink.id)}
								aria-label={ink.label}
								title={ink.label}
								aria-pressed={now.cap.color === ink.id}
								onpointerdown={keep}
								onclick={() => setCap({ color: ink.id })}
							></button>
						{/each}
					</div>
					<label class="custom">
						<input
							type="color"
							value={hexOr(now.cap.color, '#2b63f5')}
							oninput={(event) => setCap({ color: event.currentTarget.value })}
						/>
						Any colour
					</label>
				{/if}
			</Menu>
		</div>
	{/if}

	<div class="group">
		<button
			type="button"
			class="tool"
			aria-label="Clear formatting"
			title="Clear formatting"
			onpointerdown={keep}
			onclick={() =>
				story ? chain().unsetAllMarks().clearNodes().run() : chain().unsetAllMarks().run()}
			><Icon name="eraser" size={17} /></button
		>
	</div>
</div>

<style>
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 2px;
		font-family: var(--font-ui);
		font-style: normal;
		line-height: 1;
		text-indent: 0;
	}

	.group {
		display: flex;
		align-items: center;
		gap: 2px;
		padding-right: 6px;
		margin-right: 4px;
		border-right: 1px solid var(--bb-line-soft);
	}

	.group:last-child {
		border-right: none;
	}

	.tool {
		display: grid;
		place-items: center;
		min-width: 36px;
		height: 36px;
		padding: 0 6px;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--bb-text-label);
	}

	.tool:hover:not(:disabled) {
		background: var(--bb-raised);
		color: var(--bb-text-strong);
	}

	.tool[aria-pressed='true'] {
		background: var(--bb-sky-wash);
		color: var(--bb-sky-text);
	}

	.tool:disabled {
		opacity: 0.4;
	}

	.glyph {
		font-size: 16px;
	}

	.glyph.bold {
		font-weight: 800;
	}

	.glyph.italic {
		font-family: var(--font-read);
		font-style: italic;
		font-size: 18px;
	}

	.glyph.underline {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.glyph.strike {
		text-decoration: line-through;
	}

	.ink-glyph,
	.mark-glyph {
		display: grid;
		place-items: center;
		padding-bottom: 3px;
		border-bottom: 4px solid var(--swatch);
		border-radius: 1px;
	}

	.ink-glyph {
		font-family: var(--font-display);
		font-size: 17px;
		line-height: 1;
	}

	.mark-glyph {
		border-bottom-color: var(--swatch);
		box-shadow: inset 0 -4px 0 var(--swatch);
	}

	.cap-tool {
		display: flex;
		align-items: flex-end;
		gap: 2px;
	}

	.cap-glyph {
		font-family: var(--font-display);
		font-size: 21px;
		line-height: 0.9;
		color: var(--swatch);
	}

	.cap-lines {
		width: 10px;
		height: 12px;
		margin-bottom: 2px;
		background: repeating-linear-gradient(to bottom, currentColor 0 1.5px, transparent 1.5px 4.5px);
	}

	.pick {
		height: 36px;
		padding: 0 8px;
		border: 1px solid var(--bb-line-soft);
		border-radius: 8px;
		background: var(--bb-ink);
		color: var(--bb-text-label);
		font: 600 13px var(--font-ui);
	}

	.pick:hover {
		border-color: var(--bb-line-control);
	}

	/* Menu contents (rendered inside Menu, styled from here). */
	.menu-label {
		margin: 2px 0 8px;
		font-size: 11.5px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--bb-text-3);
	}

	.menu-label:not(:first-child) {
		margin-top: 14px;
	}

	.swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.swatch {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		padding: 0;
		border: 2px solid var(--bb-line-soft);
		border-radius: 50%;
		background: var(--swatch);
		color: var(--bb-text-3);
	}

	.swatch[aria-pressed='true'] {
		border-color: var(--bb-text-strong);
		box-shadow: 0 0 0 2px var(--bb-ink) inset;
	}

	.swatch.none {
		background: transparent;
	}

	.custom {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 12px;
		font-size: 13.5px;
		color: var(--bb-text-label);
		cursor: pointer;
	}

	.custom input {
		width: 36px;
		height: 30px;
		padding: 0;
		border: 1px solid var(--bb-line-soft);
		border-radius: 6px;
		background: none;
		cursor: pointer;
	}

	.segmented {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.segmented button {
		flex: 1;
		min-height: 34px;
		padding: 0 8px;
		border: 1px solid var(--bb-line-soft);
		border-radius: 8px;
		background: transparent;
		color: var(--bb-text-label);
		font-size: 13px;
		font-weight: 600;
	}

	.segmented button[aria-pressed='true'] {
		border-color: var(--bb-sky);
		background: var(--bb-sky-wash);
		color: var(--bb-sky-text);
	}

	@media (max-width: 600px) {
		/* One scrolling row on phones, so the toolbar doesn't eat the screen. */
		.toolbar.story {
			flex-wrap: nowrap;
			overflow-x: auto;
			scrollbar-width: none;
		}

		.group {
			flex: none;
		}
	}
</style>
