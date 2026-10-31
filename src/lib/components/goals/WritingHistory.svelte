<script lang="ts">
	import { goalsStore } from '$lib/stores';
	import { historyGrid, historyLevel, historySummary, isRestDay } from '$lib/goals';

	// The last year of writing as a calendar, with a few totals above it. Opened from the daily
	// goal panel on the library page. Empty rest days are drawn as outlines, not blanks.
	const WEEKS = 53;
	const goals = $derived($goalsStore);
	const target = $derived(goals?.dailyWords ?? 0);
	const restDays = $derived(goals?.restDays ?? 0);
	const grid = $derived(goals ? historyGrid(goals.days, goals.today, WEEKS) : []);
	const summary = $derived(
		goals ? historySummary(goals.days, goals.today, WEEKS * 7, target, restDays) : null
	);

	const number = (n: number) => n.toLocaleString('en');
	const monthOf = (day: string) =>
		new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { month: 'short' });
	const dayLabel = (day: string) =>
		new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});

	// A month's name sits over the first week that starts in it. When two would crowd each other
	// (the year's first, partial month), the earlier one is left out.
	const monthLabels = $derived.by(() => {
		const labels = grid.map((week, i) => {
			const day = week[0]?.day;
			if (!day) return '';
			const month = monthOf(day);
			const previous = i > 0 ? grid[i - 1][0]?.day : undefined;
			return !previous || monthOf(previous) !== month ? month : '';
		});
		return labels.map((label, i) =>
			label && labels.slice(i + 1, i + 3).every((next) => !next) ? label : ''
		);
	});

	// Start at the most recent weeks, which is what sits at the right-hand end.
	let scroller = $state<HTMLDivElement>();
	$effect(() => {
		if (scroller && grid.length) scroller.scrollLeft = scroller.scrollWidth;
	});
</script>

{#if summary}
	<div class="history">
		{#if summary.active === 0}
			<p class="none">
				Nothing written yet. Your history fills in as you save story text, one square a day.
			</p>
		{:else}
			<dl class="stats">
				<div>
					<dt>Words this year</dt>
					<dd>{number(summary.total)}</dd>
				</div>
				<div>
					<dt>Days written</dt>
					<dd>{number(summary.active)}</dd>
				</div>
				<div>
					<dt>Average on a writing day</dt>
					<dd>{number(summary.average)}</dd>
				</div>
				<div>
					<dt>Best day</dt>
					<dd>
						{number(summary.tallest)}
						<span class="when">{monthOf(summary.bestDay)} {Number(summary.bestDay.slice(8))}</span>
					</dd>
				</div>
				<div>
					<dt>Longest streak</dt>
					<dd>{number(summary.longestStreak)} {summary.longestStreak === 1 ? 'day' : 'days'}</dd>
				</div>
			</dl>
		{/if}

		<div class="scroller" bind:this={scroller}>
			<div class="calendar" role="img" aria-label="Words written each day over the last year">
				<div class="weekdays" aria-hidden="true">
					<span class="month"></span>
					{#each ['Mon', '', 'Wed', '', 'Fri', '', ''] as label, i (i)}
						<span class="weekday">{label}</span>
					{/each}
				</div>
				{#each grid as week, w (w)}
					<div class="week">
						<span class="month" aria-hidden="true"><span>{monthLabels[w]}</span></span>
						{#each week as cell, d (d)}
							{#if cell}
								<span
									class={[
										'cell',
										`level-${historyLevel(cell.words, target, summary.tallest)}`,
										{ rest: cell.words === 0 && isRestDay(cell.day, restDays) }
									]}
									title="{dayLabel(cell.day)}: {number(cell.words)} words"
								></span>
							{:else}
								<span class="cell future"></span>
							{/if}
						{/each}
					</div>
				{/each}
			</div>
		</div>

		<div class="legend" aria-hidden="true">
			<span>Less</span>
			{#each [0, 1, 2, 3, 4] as level (level)}
				<span class="cell level-{level}"></span>
			{/each}
			<span>More</span>
			{#if restDays > 0}
				<span class="cell rest"></span><span>Rest day</span>
			{/if}
			{#if target > 0}<span class="note">· Darkest squares are well past your goal</span>{/if}
		</div>
	</div>
{/if}

<style>
	.history {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding-top: 18px;
		border-top: 1px solid var(--bb-line-faint);
	}

	.none {
		font-size: 14.5px;
		color: var(--bb-text-2);
	}

	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: 12px 32px;
	}

	.stats div {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	dt {
		font-size: 12.5px;
		color: var(--bb-text-3);
	}

	dd {
		font-family: var(--font-display);
		font-size: 24px;
		line-height: 1.1;
		color: var(--bb-text-strong);
	}

	.when {
		font-family: var(--font-ui);
		font-size: 13px;
		color: var(--bb-text-3);
	}

	.scroller {
		overflow-x: auto;
		padding-bottom: 4px;
	}

	.calendar {
		display: flex;
		gap: 4px;
		width: max-content;
	}

	.weekdays,
	.week {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.weekdays {
		padding-right: 4px;
	}

	.weekday {
		height: 14px;
		font-size: 11px;
		line-height: 14px;
		color: var(--bb-text-3);
	}

	.month {
		position: relative;
		display: block;
		height: 16px;
	}

	.month span {
		position: absolute;
		left: 0;
		font-size: 11px;
		line-height: 16px;
		white-space: nowrap;
		color: var(--bb-text-3);
	}

	.cell {
		display: block;
		width: 14px;
		height: 14px;
		border-radius: 3px;
		background: var(--bb-line-faint);
	}

	.cell.future {
		background: transparent;
	}

	.cell.rest {
		background: transparent;
		box-shadow: inset 0 0 0 1px var(--bb-line-control);
	}

	/* Opacity rather than a colour mix, which the production build can't resolve per theme. */
	.level-1 {
		background: var(--ink-moss);
		opacity: 0.32;
	}

	.level-2 {
		background: var(--ink-moss);
		opacity: 0.55;
	}

	.level-3 {
		background: var(--ink-moss);
		opacity: 0.78;
	}

	.level-4 {
		background: var(--ink-moss);
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 5px;
		font-size: 12px;
		color: var(--bb-text-3);
	}

	.legend .cell {
		width: 12px;
		height: 12px;
	}

	.legend .note {
		margin-left: 6px;
	}
</style>
