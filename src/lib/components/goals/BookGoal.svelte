<script lang="ts">
	import { booksStore, goalsStore } from '$lib/stores';
	import { putJSON } from '$lib/library';
	import { MAX_BOOK_WORDS, bookProgress, dayIn, type GoalsData } from '$lib/goals';
	import type { Book } from '$lib/stores';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	// A book's word target and deadline, in the book page's aside: how far along it is, how long
	// is left, and what each day has to add to get there.
	let { bookId }: { bookId: number } = $props();

	const book = $derived($booksStore.find((b) => b.id === bookId));
	const goals = $derived($goalsStore);
	const words = $derived(goals?.bookWords[bookId] ?? 0);
	const today = $derived(goals?.today ?? dayIn(Intl.DateTimeFormat().resolvedOptions().timeZone));
	const progress = $derived(
		book ? bookProgress(words, book.targetWords, book.deadline, today) : null
	);

	let editing = $state(false);
	// A number input hands back a number (or null when empty), so the draft isn't always a string.
	let target = $state<string | number | null>('');
	let deadline = $state('');
	let saving = $state(false);
	let error = $state('');

	function edit() {
		target = book?.targetWords ? String(book.targetWords) : '';
		deadline = book?.deadline ?? '';
		error = '';
		editing = true;
	}

	async function save(clear = false) {
		const raw = String(target ?? '').trim();
		const targetWords = clear || raw === '' ? null : Number(raw);
		if (targetWords !== null && (!Number.isInteger(targetWords) || targetWords < 1)) {
			error = 'Use a whole number of words.';
			return;
		}
		if (targetWords !== null && targetWords > MAX_BOOK_WORDS) {
			error = `A book goal can be up to ${number(MAX_BOOK_WORDS)} words.`;
			return;
		}
		saving = true;
		error = '';
		try {
			const saved = await putJSON<{ book: Book; words: number }>(`/api/book/${bookId}/goal`, {
				targetWords,
				deadline: clear || !deadline ? null : deadline
			});
			booksStore.update((books) => books.map((b) => (b.id === bookId ? saved.book : b)));
			goalsStore.update((current) => {
				if (!current) return current;
				const bookWords = { ...current.bookWords };
				if (saved.book.targetWords) bookWords[bookId] = saved.words;
				else delete bookWords[bookId];
				return { ...current, bookWords } satisfies GoalsData;
			});
			editing = false;
		} catch (problem) {
			error = problem instanceof Error ? problem.message : "Couldn't save the goal.";
		} finally {
			saving = false;
		}
	}

	const number = (n: number) => n.toLocaleString('en');
	const dueLabel = (day: string) =>
		new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});

	/** "12 days left", "Due today", "3 days overdue". */
	function countdown(daysLeft: number) {
		if (daysLeft === 0) return 'Due today';
		const days = Math.abs(daysLeft);
		const unit = days === 1 ? 'day' : 'days';
		return daysLeft > 0 ? `${days} ${unit} left` : `${days} ${unit} overdue`;
	}
</script>

{#if book && progress && (goals || !book.targetWords)}
	<section aria-labelledby="h-goal" class="panel">
		<div class="panel-head">
			<h2 id="h-goal">Goal</h2>
			{#if book.targetWords}
				<span class={['badge', { done: progress.done }]}>
					{progress.done ? 'Reached' : `${Math.floor(progress.fraction * 100)}%`}
				</span>
			{/if}
		</div>

		{#if book.targetWords && !editing}
			<p class="figures">
				<span class="words">{number(words)}</span>
				<span class="of">of {number(book.targetWords)} words</span>
			</p>
			<div
				class="track"
				role="progressbar"
				aria-labelledby="h-goal"
				aria-valuemin="0"
				aria-valuemax={book.targetWords}
				aria-valuenow={Math.min(words, book.targetWords)}
				aria-valuetext="{number(words)} of {number(book.targetWords)} words"
			>
				<span class={['fill', { done: progress.done }]} style:width="{progress.fraction * 100}%"
				></span>
			</div>
			{#if book.deadline && progress.daysLeft !== null}
				<p class={['due', { late: progress.daysLeft < 0 && !progress.done }]}>
					<Icon name="calendar" size={15} />
					<span>
						{dueLabel(book.deadline)}
						<span class="count">
							{progress.done ? '' : `· ${countdown(progress.daysLeft)}`}
						</span>
					</span>
				</p>
			{/if}
			<p class="pace">
				{#if progress.done}
					You've reached the target. Everything from here is extra.
				{:else if progress.perDay !== null}
					{number(progress.wordsLeft)} to go: about {number(progress.perDay)}
					{progress.perDay === 1 ? 'word' : 'words'} a day gets you there.
				{:else if progress.daysLeft !== null && progress.daysLeft < 0}
					{number(progress.wordsLeft)} words short of the target. Move the deadline when you're ready.
				{:else}
					{number(progress.wordsLeft)} words to go.
				{/if}
			</p>
			<button type="button" class="panel-link" onclick={edit}>
				<Icon name="pen" size={15} />Edit goal
			</button>
		{:else if !editing}
			<p class="empty">Give this book a word target and a deadline, and see how far along it is.</p>
			<button type="button" class="panel-link" onclick={edit}>
				<Icon name="target" size={15} />Set a goal
			</button>
		{:else}
			<form
				class="form"
				onsubmit={(event) => {
					event.preventDefault();
					save();
				}}
			>
				<label class="field">
					<span>Word target</span>
					<input
						class="bb-field"
						type="number"
						inputmode="numeric"
						min="1"
						max={MAX_BOOK_WORDS}
						placeholder="90,000"
						bind:value={target}
						aria-invalid={error ? 'true' : undefined}
					/>
				</label>
				<label class="field">
					<span>Deadline <em>(optional)</em></span>
					<input class="bb-field" type="date" bind:value={deadline} />
				</label>
				{#if error}
					<p class="error" role="alert"><Icon name="alert-circle" size={15} />{error}</p>
				{/if}
				<div class="actions">
					<Button variant="primary" type="submit" disabled={saving}>Save</Button>
					<Button onclick={() => (editing = false)}>Cancel</Button>
					{#if book.targetWords}
						<Button variant="quiet" disabled={saving} onclick={() => save(true)}>Remove goal</Button
						>
					{/if}
				</div>
			</form>
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

	.panel-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 24px;
		color: var(--bb-text);
	}

	.badge {
		font-size: 13px;
		font-weight: 700;
		color: var(--bb-sky-text);
	}

	.badge.done {
		color: var(--ink-moss);
	}

	.figures {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 2px 10px;
	}

	.words {
		font-family: var(--font-display);
		font-size: 34px;
		line-height: 1;
		color: var(--bb-text-strong);
	}

	.of {
		font-size: 14.5px;
		color: var(--bb-text-2);
	}

	.track {
		height: 10px;
		border-radius: var(--r-pill);
		background: var(--bb-line-faint);
		overflow: hidden;
	}

	.fill {
		display: block;
		height: 100%;
		border-radius: var(--r-pill);
		background: var(--bb-royal);
		transition: width 0.5s ease;
	}

	.fill.done {
		background: var(--ink-moss);
	}

	.due {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		font-size: 15px;
		color: var(--bb-text);
	}

	.due :global(svg) {
		margin-top: 3px;
		flex: none;
		color: var(--bb-sky);
	}

	.due .count {
		color: var(--bb-text-2);
	}

	.due.late .count {
		color: var(--bb-coral-soft);
	}

	.pace,
	.empty {
		font-size: 14.5px;
		line-height: 1.5;
		color: var(--bb-text-2);
	}

	.panel-link {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		padding: 0;
		border: none;
		background: none;
		color: var(--bb-sky);
		font: 600 14.5px var(--font-ui);
	}

	.panel-link:hover {
		color: var(--bb-sky-hover);
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 14px;
		font-weight: 600;
		color: var(--bb-text-label);
	}

	.field em {
		font-style: normal;
		font-weight: 500;
		color: var(--bb-text-3);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.error {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		color: var(--bb-coral-soft);
	}

	@media (prefers-reduced-motion: reduce) {
		.fill {
			transition: none;
		}
	}
</style>
