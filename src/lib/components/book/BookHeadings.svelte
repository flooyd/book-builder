<script lang="ts">
	import { booksStore, type Book } from '$lib/stores';
	import { putJSON } from '$lib/library';
	import { LABEL_STYLES, styledLabel, type LabelStyle, type Noun } from '$lib/headings';
	import Icon from '$lib/components/ui/Icon.svelte';

	// How this whole book's parts and chapters open in reading mode. Each one can still set its
	// own in Edit details. Saves as it's changed, and goes back if the save fails.
	let { bookId }: { bookId: number } = $props();

	type Changes = Partial<Pick<Book, 'partLabels' | 'chapterLabels' | 'chapterTitles'>>;

	const book = $derived($booksStore.find((b) => b.id === bookId));
	let error = $state('');

	const replace = (row: Book) =>
		booksStore.update((books) => books.map((b) => (b.id === row.id ? row : b)));

	async function save(changes: Changes) {
		if (!book) return;
		const before = book;
		replace({ ...before, ...changes });
		error = '';
		try {
			replace(await putJSON<Book>(`/api/book/${bookId}/headings`, changes));
		} catch (problem) {
			replace(before);
			error = problem instanceof Error ? problem.message : "Couldn't save the headings.";
		}
	}

	const styleName = (noun: Noun, style: LabelStyle) => styledLabel(noun, 1, style) ?? 'No label';
</script>

{#if book}
	<section aria-labelledby="h-headings" class="panel">
		<h2 id="h-headings">Headings</h2>
		<p class="hint">
			How parts and chapters open in reading mode. Any one of them can change its own in Edit
			details.
		</p>
		<label class="field">
			<span>Part labels</span>
			<select
				class="bb-field"
				value={book.partLabels}
				onchange={(event) => save({ partLabels: event.currentTarget.value as LabelStyle })}
			>
				{#each LABEL_STYLES as style (style)}
					<option value={style}>{styleName('Part', style)}</option>
				{/each}
			</select>
		</label>
		<label class="field">
			<span>Chapter labels</span>
			<select
				class="bb-field"
				value={book.chapterLabels}
				onchange={(event) => save({ chapterLabels: event.currentTarget.value as LabelStyle })}
			>
				{#each LABEL_STYLES as style (style)}
					<option value={style}>{styleName('Chapter', style)}</option>
				{/each}
			</select>
		</label>
		<label class="check">
			<input
				type="checkbox"
				checked={book.chapterTitles}
				onchange={(event) => save({ chapterTitles: event.currentTarget.checked })}
			/>
			Show chapter titles
		</label>
		{#if error}
			<p class="error" role="alert"><Icon name="alert-circle" size={15} />{error}</p>
		{/if}
	</section>
{/if}

<style>
	.panel {
		padding: 22px;
		border-radius: var(--r-card);
		background: var(--bb-ink);
		border: 1px solid var(--bb-line-soft);
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 24px;
		color: var(--bb-text);
	}

	.hint {
		font-size: 14.5px;
		line-height: 1.5;
		color: var(--bb-text-2);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 14px;
		font-weight: 600;
		color: var(--bb-text-label);
	}

	.check {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		font-size: 15px;
		color: var(--bb-text-label);
		cursor: pointer;
	}

	.check input {
		flex: none;
		width: 18px;
		height: 18px;
		accent-color: var(--bb-royal);
	}

	.error {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		color: var(--bb-coral-soft);
	}
</style>
