<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		DETAIL_SUGGESTIONS,
		ENTRY_COPY,
		KIND_SUGGESTIONS,
		cleanAliases,
		cleanDetails,
		type Appearance,
		type Connection,
		type EntryDetail,
		type EntryType
	} from '$lib/bible';
	import { capitalize, putJSON, sendJSON } from '$lib/library';
	import { booksStore, entryStores, type Entry } from '$lib/stores';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import RichInline from '$lib/components/rich/RichInline.svelte';
	import RichEditor from '$lib/components/rich/RichEditor.svelte';
	import Monogram from './Monogram.svelte';
	import EntryAppearances from './EntryAppearances.svelte';
	import EntryConnections from './EntryConnections.svelte';

	// Everything a story bible page edits. Fields save themselves when the writer leaves them, and
	// notes a moment after typing stops. Renaming also renames its mentions in the story.
	let {
		type,
		entry,
		appearances,
		connections,
		backHref
	}: {
		type: EntryType;
		entry: Entry;
		appearances: Appearance[];
		connections: Connection[];
		/** Where to go after deleting (already resolved). */
		backHref: string;
	} = $props();

	const copy = $derived(ENTRY_COPY[type]);
	const url = $derived(`${copy.api}/${entry.id}`);
	const hasKind = $derived(type !== 'character');

	// The drafts start from the entry and then belong to the writer: the store updating after a
	// save mustn't reach back into a field they're typing in.
	// svelte-ignore state_referenced_locally
	let name = $state(entry.name);
	// svelte-ignore state_referenced_locally
	let kind = $state('kind' in entry ? entry.kind : '');
	// svelte-ignore state_referenced_locally
	let aliases = $state(entry.aliases.join(', '));
	// svelte-ignore state_referenced_locally
	let details = $state<EntryDetail[]>(entry.details.map((detail) => ({ ...detail })));

	const uid = $props.id();
	const kinds = $derived(type === 'character' ? [] : KIND_SUGGESTIONS[type]);
	const unusedLabels = $derived(
		DETAIL_SUGGESTIONS[type].filter(
			(label) => !details.some((d) => d.label.toLowerCase() === label.toLowerCase())
		)
	);

	// ---- Saving ------------------------------------------------------------------------------
	let saving = $state(0);
	let saved = $state(false);
	let error = $state('');

	async function save(changes: Record<string, unknown>) {
		saving += 1;
		saved = false;
		error = '';
		try {
			const updated = await putJSON<Entry>(url, changes);
			entryStores[type].update((list) => list.map((e) => (e.id === updated.id ? updated : e)));
			saved = true;
		} catch (cause) {
			error = cause instanceof Error ? cause.message : "Couldn't save.";
		} finally {
			saving -= 1;
		}
	}

	function saveName() {
		const next = name.trim();
		if (!next) {
			name = entry.name;
			error = `A ${copy.one} needs a name, so it's staying ${entry.name}.`;
			return;
		}
		name = next;
		if (next !== entry.name) save({ name: next });
	}

	function saveKind() {
		const next = kind.trim();
		kind = next;
		if ('kind' in entry && next !== entry.kind) save({ kind: next });
	}

	function saveAliases() {
		const next = cleanAliases(aliases.split(','), entry.name);
		aliases = next.join(', ');
		if (JSON.stringify(next) !== JSON.stringify(entry.aliases)) save({ aliases: next });
	}

	function saveDetails() {
		const next = cleanDetails(details);
		if (JSON.stringify(next) !== JSON.stringify(entry.details)) save({ details: next });
	}

	function addDetail(label = '') {
		details.push({ label, value: '' });
	}

	function removeDetail(index: number) {
		details.splice(index, 1);
		saveDetails();
	}

	function toggleBook(bookId: number, checked: boolean) {
		const bookIds = checked
			? [...entry.bookIds, bookId]
			: entry.bookIds.filter((id) => id !== bookId);
		save({ bookIds });
	}

	const submitOnEnter = (event: KeyboardEvent) => {
		if (event.key === 'Enter') {
			event.preventDefault();
			(event.currentTarget as HTMLElement).blur();
		}
	};

	// ---- Delete ------------------------------------------------------------------------------
	let confirmingDelete = $state(false);
	let deleting = $state(false);
	let deleteError = $state('');

	async function deleteEntry() {
		deleting = true;
		deleteError = '';
		try {
			await sendJSON('DELETE', url);
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- backHref is resolve()d
			await goto(backHref);
			entryStores[type].update((list) => list.filter((e) => e.id !== entry.id));
		} catch (cause) {
			deleteError = cause instanceof Error ? cause.message : `Couldn't delete this ${copy.one}.`;
			deleting = false;
		}
	}
</script>

<main class="sheet">
	<div class="primary">
		<header class="head">
			<Monogram name={entry.name} id={entry.id} size={72} />
			<div class="head-text">
				<p class="overline">{capitalize(copy.one)}</p>
				<label class="sr-only" for="{uid}-name">Name</label>
				<input
					id="{uid}-name"
					class="name"
					autocomplete="off"
					bind:value={name}
					onblur={saveName}
					onkeydown={submitOnEnter}
				/>
			</div>
			<p class="state" role="status">
				{#if saving > 0}
					Saving…
				{:else if error}
					<span class="failed">Couldn't save</span>
				{:else if saved}
					<Icon name="check-circle" size={15} />Saved
				{/if}
			</p>
		</header>

		{#if error}
			<p class="error" role="alert"><Icon name="alert-circle" size={16} />{error}</p>
		{/if}

		<div class={['facts', { single: !hasKind }]}>
			{#if hasKind}
				<div class="field">
					<label for="{uid}-kind">Kind</label>
					<input
						id="{uid}-kind"
						class="bb-field"
						autocomplete="off"
						list="{uid}-kinds"
						placeholder="e.g. {kinds[0]}, {kinds[1]}"
						bind:value={kind}
						onblur={saveKind}
						onkeydown={submitOnEnter}
					/>
					<datalist id="{uid}-kinds">
						{#each kinds as option (option)}
							<option value={option}></option>
						{/each}
					</datalist>
				</div>
			{/if}
			<div class="field">
				<label for="{uid}-aliases">Also known as</label>
				<input
					id="{uid}-aliases"
					class="bb-field"
					autocomplete="off"
					placeholder="Short names, with commas between them"
					aria-describedby="{uid}-aliases-hint"
					bind:value={aliases}
					onblur={saveAliases}
					onkeydown={submitOnEnter}
				/>
				<p id="{uid}-aliases-hint" class="hint">
					Your story text links these wherever you write them, and they work after @ too.
				</p>
			</div>
		</div>

		<section class="block" aria-labelledby="{uid}-about">
			<h2 id="{uid}-about">In a line or two</h2>
			<RichInline
				class="description"
				value={entry.description}
				label="Description of {entry.name}"
				placeholder="Add a description"
				onsave={(description) => save({ description })}
			/>
		</section>

		<section class="block" aria-labelledby="{uid}-details">
			<h2 id="{uid}-details">Details</h2>
			{#if details.length > 0}
				<ul class="details">
					{#each details as detail, index (index)}
						<li>
							<input
								class="bb-field detail-label"
								autocomplete="off"
								aria-label="Detail {index + 1}: label"
								placeholder="Label"
								bind:value={detail.label}
								onblur={saveDetails}
							/>
							<textarea
								class="bb-field detail-value"
								rows="1"
								aria-label={detail.label || `Detail ${index + 1}`}
								bind:value={detail.value}
								onblur={saveDetails}></textarea>
							<button
								type="button"
								class="remove"
								aria-label="Remove {detail.label || 'this detail'}"
								onclick={() => removeDetail(index)}
							>
								<Icon name="x" size={17} />
							</button>
						</li>
					{/each}
				</ul>
			{/if}
			<div class="suggestions">
				{#each unusedLabels as label (label)}
					<button type="button" class="suggestion" onclick={() => addDetail(label)}>
						<Icon name="plus" size={13} strokeWidth={2.4} />{label}
					</button>
				{/each}
				<button type="button" class="suggestion" onclick={() => addDetail()}>
					<Icon name="plus" size={13} strokeWidth={2.4} />Your own
				</button>
			</div>
		</section>

		<section class="block" aria-labelledby="{uid}-notes">
			<h2 id="{uid}-notes">Notes</h2>
			<RichEditor
				kind="description"
				class="notes"
				boxed
				value={entry.notes}
				delay={800}
				label="Notes on {entry.name}"
				placeholder="Anything else worth remembering"
				onchange={(notes) => {
					if (notes !== entry.notes) save({ notes });
				}}
			/>
		</section>
	</div>

	<aside class="side">
		<EntryAppearances {type} {appearances} />
		<EntryConnections {type} {entry} {connections} />

		<section class="panel" aria-labelledby="{uid}-books">
			<h2 id="{uid}-books">Books</h2>
			<div class="books">
				{#each $booksStore as book (book.id)}
					{@const checked = entry.bookIds.includes(book.id)}
					<label class="book">
						<input
							type="checkbox"
							{checked}
							disabled={checked && entry.bookIds.length === 1}
							onchange={(event) => toggleBook(book.id, event.currentTarget.checked)}
						/>{book.title}
					</label>
				{/each}
			</div>
		</section>

		<Button variant="quiet" onclick={() => (confirmingDelete = true)}>
			<Icon name="trash" size={16} />Delete this {copy.one}
		</Button>
	</aside>
</main>

{#if confirmingDelete}
	<Dialog labelledby="{uid}-delete" width={460} onclose={() => (confirmingDelete = false)}>
		<div class="confirm">
			<h2 id="{uid}-delete">Delete <em>{entry.name}</em>?</h2>
			<p>
				Its page goes, in every book. The story text keeps its words: mentions turn back into plain
				text.
			</p>
			{#if deleteError}
				<p class="error" role="alert"><Icon name="alert-circle" size={16} />{deleteError}</p>
			{/if}
			<div class="confirm-actions">
				<Button variant="quiet" onclick={() => (confirmingDelete = false)} disabled={deleting}>
					Cancel
				</Button>
				<Button variant="danger" onclick={deleteEntry} disabled={deleting}>
					<Icon name="trash" size={16} />{deleting ? 'Deleting…' : `Delete ${copy.one}`}
				</Button>
			</div>
		</div>
	</Dialog>
{/if}

<style>
	.sheet {
		max-width: 1160px;
		margin: 0 auto;
		padding: 48px 32px 96px;
		display: grid;
		grid-template-columns: minmax(0, 1fr) 340px;
		gap: 40px;
		align-items: start;
	}

	.primary {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 28px;
	}

	.head {
		display: flex;
		align-items: center;
		gap: 18px;
	}

	.head-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.overline {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--bb-sky);
	}

	/* Reads as the page's title, and is one. */
	.name {
		width: 100%;
		min-width: 0;
		margin-left: -8px;
		padding: 2px 8px;
		border: 1px solid transparent;
		border-radius: var(--r-chip);
		background: transparent;
		color: var(--bb-text-strong);
		font-family: var(--font-display);
		font-size: clamp(32px, 5vw, 46px);
		line-height: 1.1;
	}

	.name:hover {
		border-color: var(--bb-line-soft);
	}

	.name:focus-visible {
		outline: none;
		border-color: var(--bb-sky);
		box-shadow: var(--focus-ring);
	}

	.state {
		flex: none;
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 22px;
		font-size: 13.5px;
		color: var(--bb-text-3);
	}

	.failed {
		color: var(--bb-coral-soft);
	}

	.error {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		color: var(--bb-coral-soft);
	}

	.facts {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
		gap: 16px;
	}

	.facts.single {
		grid-template-columns: minmax(0, 1fr);
	}

	.field {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	label {
		font-size: 14px;
		font-weight: 600;
		color: var(--bb-text-label);
	}

	.hint {
		font-size: 13px;
		line-height: 1.4;
		color: var(--bb-text-3);
	}

	.block {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 24px;
		color: var(--bb-text);
	}

	.block :global(.description) {
		font-family: var(--font-read);
		font-style: italic;
		font-size: 19px;
		line-height: 1.5;
		color: var(--bb-text-2);
	}

	.block :global(.notes) {
		font-family: var(--font-read);
		font-size: 18px;
		line-height: 1.55;
		color: var(--bb-text);
	}

	.block :global(.notes .rich-area) {
		min-height: 160px;
	}

	.details {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.details li {
		display: grid;
		grid-template-columns: minmax(0, 160px) minmax(0, 1fr) 44px;
		align-items: start;
		gap: 8px;
	}

	.detail-label {
		min-height: 44px;
		padding: 0 12px;
		font-size: 14.5px;
		font-weight: 600;
	}

	.detail-value {
		min-height: 44px;
		padding: 10px 12px;
		font-size: 15px;
		font-weight: 400;
		resize: none;
		field-sizing: content;
	}

	.remove {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: var(--bb-text-3);
	}

	.remove:hover {
		background: var(--bb-raised);
		color: var(--bb-text);
	}

	.suggestions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.suggestion {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 36px;
		padding: 0 12px;
		border: 1px dashed var(--bb-line-dashed);
		border-radius: var(--r-pill);
		background: transparent;
		color: var(--bb-text-2);
		font: 600 13.5px var(--font-ui);
	}

	/* 36px to the eye, 44px to the finger. */
	.suggestion::before {
		content: '';
		position: absolute;
		inset: -4px 0;
	}

	.suggestion:hover {
		border-color: var(--bb-sky);
		color: var(--bb-text-strong);
	}

	.side {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.side :global(.panel) {
		padding: 22px;
		border-radius: var(--r-card);
		background: var(--bb-ink);
		border: 1px solid var(--bb-line-soft);
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.books {
		display: flex;
		flex-direction: column;
	}

	.book {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		font-size: 15px;
		font-weight: 400;
		color: var(--bb-text);
		cursor: pointer;
		overflow-wrap: anywhere;
	}

	.book input {
		flex: none;
		width: 18px;
		height: 18px;
		accent-color: var(--bb-royal);
	}

	.confirm {
		padding: 28px 30px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.confirm h2 {
		font-size: 30px;
		line-height: 1.15;
		color: var(--bb-text-strong);
		overflow-wrap: anywhere;
	}

	.confirm p {
		font-size: 15.5px;
		line-height: 1.5;
		color: var(--bb-text-2);
	}

	.confirm-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 10px;
		margin-top: 8px;
	}

	@media (max-width: 980px) {
		.sheet {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media (max-width: 760px) {
		.sheet {
			padding: 28px 16px 96px;
			gap: 28px;
		}

		.facts {
			grid-template-columns: minmax(0, 1fr);
		}

		.head {
			gap: 12px;
			flex-wrap: wrap;
		}

		.state {
			order: -1;
			flex-basis: 100%;
		}

		.details li {
			grid-template-columns: minmax(0, 1fr) 44px;
		}

		.detail-value {
			grid-column: 1 / -1;
			grid-row: 2;
		}
	}
</style>
