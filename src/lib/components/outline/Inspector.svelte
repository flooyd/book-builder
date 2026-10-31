<script lang="ts">
	import { resolve } from '$app/paths';
	import { initials, plural } from '$lib/library';
	import { modalStore } from '$lib/stores';
	import { STATUSES } from '$lib/status';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { Group, Item, OutlineUi } from './types';
	import EditableText from './EditableText.svelte';
	import RichInline from '$lib/components/rich/RichInline.svelte';

	// Everything about the selected part or chapter: title, synopsis, reading-mode subtitle,
	// status, cast, numbers and actions.
	let {
		item,
		group,
		partTitle,
		bookId,
		ui,
		oncast,
		ondelete,
		onclose
	}: {
		item: Item;
		/** For parts: the part and its chapters. */
		group: Group | undefined;
		/** For chapters: the title of their part. */
		partTitle: string;
		bookId: number;
		ui: OutlineUi;
		oncast: (item: Item, characterIds: number[]) => void;
		ondelete: (item: Item) => void;
		/** In a dialog (narrow screens): close it. */
		onclose?: () => void;
	} = $props();

	const isPart = $derived(item.kind === 'part');
	const chapters = $derived(group?.chapters ?? []);
	const characters = $derived(Object.values(ui.characters));
	// A part can switch what it holds while it holds nothing.
	const canSwitch = $derived(isPart && chapters.length === 0 && item.words === 0);

	const editHref = $derived(
		isPart
			? resolve('/part/[id]', { id: String(item.id) })
			: resolve('/chapter/[id]', { id: String(item.id) })
	);
	const readHref = $derived(`${resolve('/book/[id]/read', { id: String(bookId) })}#${item.key}`);

	function toggleCast(id: number) {
		oncast(item, item.cast.includes(id) ? item.cast.filter((c) => c !== id) : [...item.cast, id]);
	}

	const statusCount = (id: string) => chapters.filter((c) => c.status === id).length;
</script>

<div class="inspector">
	<div class="head">
		<span class="overline">
			{#if isPart}{item.label ?? 'Story text'}{:else}{item.label} · {partTitle}{/if}
		</span>
		{#if onclose}
			<button type="button" class="close" aria-label="Close" onclick={onclose}>
				<Icon name="x" size={20} />
			</button>
		{/if}
	</div>

	<!-- Wraps long titles; Enter finishes instead of starting a new line. -->
	<EditableText
		id="inspector-title"
		class="i-title"
		multiline
		value={item.title}
		label="Title"
		required
		onsave={(title) => ui.save(item, { title })}
		onkeydown={(event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				(event.currentTarget as HTMLElement).blur();
			}
		}}
	/>

	<div class="field">
		<p class="label">Synopsis</p>
		<RichInline
			class="i-synopsis"
			value={item.description}
			label="Synopsis"
			placeholder={isPart ? 'What is this part about?' : 'What happens here?'}
			onsave={(description) => ui.save(item, { description })}
		/>
		<label class="check">
			<input
				type="checkbox"
				checked={item.showDescription}
				onchange={(event) => ui.save(item, { showDescription: event.currentTarget.checked })}
			/>
			Show it under the title in reading mode
		</label>
	</div>

	{#if item.holdsChapters}
		<div class="field">
			<p class="label">Chapters</p>
			{#if chapters.length > 0}
				<div class="bar" aria-hidden="true">
					{#each STATUSES as status (status.id)}
						{#if statusCount(status.id) > 0}
							<span style:flex={statusCount(status.id)} style:background="var(--status-{status.id})"
							></span>
						{/if}
					{/each}
				</div>
				<ul class="tally">
					{#each STATUSES as status (status.id)}
						{#if statusCount(status.id) > 0}
							<li style:--dot="var(--status-{status.id})">
								<span class="dot"></span>{status.label}
								<strong>{statusCount(status.id)}</strong>
							</li>
						{/if}
					{/each}
				</ul>
			{:else}
				<p class="muted">No chapters yet.</p>
			{/if}
		</div>
	{:else}
		<div class="field">
			<p class="label" id="inspector-status">Status</p>
			<div class="statuses" role="group" aria-labelledby="inspector-status">
				{#each STATUSES as status (status.id)}
					<button
						type="button"
						aria-pressed={item.status === status.id}
						style:--dot="var(--status-{status.id})"
						onclick={() => ui.save(item, { status: status.id })}
					>
						<span class="dot"></span>{status.label}
					</button>
				{/each}
			</div>
		</div>

		<div class="field">
			<p class="label" id="inspector-cast">Cast</p>
			<div class="cast" role="group" aria-labelledby="inspector-cast">
				{#each characters as character (character.id)}
					<button
						type="button"
						class="person"
						aria-pressed={item.cast.includes(character.id)}
						onclick={() => toggleCast(character.id)}
					>
						<span class="face" aria-hidden="true">{initials(character.name)}</span>{character.name}
					</button>
				{:else}
					<p class="muted">No characters in this book yet.</p>
				{/each}
				<button
					type="button"
					class="new"
					onclick={() => modalStore.set({ type: 'create', category: 'character', bookId })}
				>
					<Icon name="plus" size={14} strokeWidth={2.2} />New character
				</button>
			</div>
		</div>
	{/if}

	<p class="numbers">
		{plural(item.words, 'word')}{#if isPart && item.holdsChapters}
			· {plural(chapters.length, 'chapter')}{/if}
	</p>

	<div class="actions">
		<Button href={editHref}><Icon name="pen" size={15} />Open in the editor</Button>
		<Button href={readHref}><Icon name="book-open" size={15} />Read</Button>
		{#if canSwitch}
			<Button onclick={() => ui.save(item, { hasChapters: item.holdsChapters ? 0 : 1 })}>
				{item.holdsChapters ? 'Hold story text instead' : 'Hold chapters instead'}
			</Button>
		{/if}
		<Button variant="danger" onclick={() => ondelete(item)}>
			<Icon name="trash" size={15} />Delete {isPart ? 'part' : 'chapter'}
		</Button>
	</div>
</div>

<style>
	.inspector {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 20px;
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		min-height: 28px;
	}

	.overline {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 11.5px;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--bb-sky);
	}

	.close {
		flex: none;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		margin: -8px -10px -8px 0;
		border: none;
		border-radius: 12px;
		background: transparent;
		color: var(--bb-text-2);
	}

	.close:hover {
		background: var(--bb-raised);
	}

	.inspector :global(.i-title) {
		margin: -4px 0 0 -7px;
		width: calc(100% + 7px);
		font-family: var(--font-display);
		font-size: 28px;
		line-height: 1.15;
		color: var(--bb-text-strong);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.label {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--bb-text-3);
	}

	.inspector :global(.i-synopsis) {
		min-height: 72px;
		padding: 8px 10px;
		border-color: var(--bb-line-soft);
		background: var(--bb-night);
		font-family: var(--font-read);
		font-style: italic;
		font-size: 16.5px;
		line-height: 1.5;
		color: var(--bb-text-desc);
	}

	.check {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 40px;
		font-size: 14px;
		color: var(--bb-text-label);
		cursor: pointer;
	}

	.check input {
		flex: none;
		width: 18px;
		height: 18px;
		accent-color: var(--bb-royal);
	}

	.statuses {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.statuses button,
	.person,
	.new {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 36px;
		padding: 0 12px;
		border-radius: var(--r-pill);
		border: 1px solid var(--bb-line-soft);
		background: transparent;
		color: var(--bb-text-label);
		font: 600 13px var(--font-ui);
	}

	.statuses button:hover,
	.person:hover,
	.new:hover {
		border-color: var(--bb-line-control);
		background: var(--bb-hover);
	}

	.statuses button[aria-pressed='true'],
	.person[aria-pressed='true'] {
		border-color: var(--bb-sky);
		background: var(--bb-sky-wash);
		color: var(--bb-sky-text);
	}

	.dot {
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--dot);
	}

	.cast {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.person {
		padding-left: 4px;
	}

	.face {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: var(--bb-raised);
		color: var(--bb-sky-text);
		font: 400 10.5px var(--font-display);
	}

	.new {
		border-style: dashed;
		color: var(--bb-text-3);
	}

	.bar {
		display: flex;
		gap: 2px;
		height: 8px;
		overflow: hidden;
		border-radius: var(--r-pill);
	}

	.tally {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 14px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 13px;
		color: var(--bb-text-2);
	}

	.tally li {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.tally strong {
		color: var(--bb-text);
	}

	.muted,
	.numbers {
		font-size: 14px;
		color: var(--bb-text-3);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding-top: 14px;
		border-top: 1px solid var(--bb-line-soft);
	}
</style>
