<script lang="ts">
	import { goalsStore } from '$lib/stores';
	import { putJSON } from '$lib/library';
	import { MAX_DAILY_WORDS, recentDays, streakOf, wordsOn, type GoalsData } from '$lib/goals';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	// The writer's daily word goal and streak, on the library page: today's progress, the last
	// two weeks as bars, and a small form to set or change the target.
	const PRESETS = [250, 500, 1000, 2000];
	const DAYS_SHOWN = 14;

	const goals = $derived($goalsStore);
	const target = $derived(goals?.dailyWords ?? 0);
	const today = $derived(goals ? wordsOn(goals.days, goals.today) : 0);
	const fraction = $derived(target ? Math.min(1, today / target) : 0);
	const reached = $derived(target > 0 && today >= target);
	const streak = $derived(goals ? streakOf(goals.days, target, goals.today) : null);
	const bars = $derived(goals ? recentDays(goals.days, goals.today, DAYS_SHOWN) : []);
	const tallest = $derived(Math.max(target, ...bars.map((bar) => bar.words), 1));

	let editing = $state(false);
	// A number input hands back a number (or null when empty), so the draft isn't always a string.
	let draft = $state<string | number | null>('');
	let saving = $state(false);
	let error = $state('');

	function edit() {
		draft = target ? String(target) : '';
		error = '';
		editing = true;
	}

	async function save(value: number) {
		if (!Number.isInteger(value) || value < 0 || value > MAX_DAILY_WORDS) {
			error = `Use a whole number of words, up to ${number(MAX_DAILY_WORDS)}.`;
			return;
		}
		saving = true;
		error = '';
		try {
			goalsStore.set(await putJSON<GoalsData>('/api/goals', { dailyWords: value }));
			editing = false;
		} catch (problem) {
			error = problem instanceof Error ? problem.message : "Couldn't save your goal.";
		} finally {
			saving = false;
		}
	}

	const number = (n: number) => n.toLocaleString('en');
	const dayLabel = (day: string) =>
		new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
</script>

{#if goals}
	<section class="goal" aria-labelledby="h-goal">
		<div class="top">
			<div class="title">
				<h2 id="h-goal" class="label">{target ? 'Today' : 'Daily goal'}</h2>
				{#if target}
					<p class="figures">
						<span class="today">{number(today)}</span>
						<span class="of">of {number(target)} words</span>
					</p>
					<div
						class="track"
						role="progressbar"
						aria-labelledby="h-goal"
						aria-valuemin="0"
						aria-valuemax={target}
						aria-valuenow={Math.min(today, target)}
						aria-valuetext="{number(today)} of {number(target)} words"
					>
						<span class={['fill', { reached }]} style:width="{fraction * 100}%"></span>
					</div>
					<p class="note">
						{#if reached}
							Goal reached. Anything more is a bonus.
						{:else}
							{number(target - today)} to go.
						{/if}
					</p>
				{:else}
					<p class="blurb">
						{#if today > 0}You've written {number(today)} words today.{/if}
						Pick a number of words to write each day, and keep a streak going.
					</p>
				{/if}
			</div>

			<div class="side">
				{#if target && streak}
					<p class={['streak', { lit: streak.current > 0 }]}>
						<Icon name="flame" size={22} strokeWidth={1.8} />
						<span class="streak-text">
							<strong>{streak.current}</strong>
							{streak.current === 1 ? 'day' : 'days'} in a row
							<span class="best">Best {streak.best}</span>
						</span>
					</p>
					<div class="bars" role="img" aria-label="Words written over the last {DAYS_SHOWN} days">
						{#each bars as bar (bar.day)}
							<span
								class={['bar', { met: bar.words >= target, now: bar.day === goals.today }]}
								style:height="{Math.max(6, (bar.words / tallest) * 100)}%"
								title="{dayLabel(bar.day)}: {number(bar.words)} words"
							></span>
						{/each}
					</div>
				{/if}
				{#if !editing}
					<Button variant="quiet" onclick={edit}>
						<Icon name={target ? 'pen' : 'target'} size={16} />{target
							? 'Change goal'
							: 'Set a goal'}
					</Button>
				{/if}
			</div>
		</div>

		{#if editing}
			<form
				class="edit"
				onsubmit={(event) => {
					event.preventDefault();
					const raw = String(draft ?? '').trim();
					save(raw === '' ? 0 : Number(raw));
				}}
			>
				<div class="presets" role="group" aria-label="Common goals">
					{#each PRESETS as preset (preset)}
						<button
							type="button"
							class={['preset', { chosen: String(draft) === String(preset) }]}
							onclick={() => (draft = String(preset))}>{number(preset)}</button
						>
					{/each}
				</div>
				<div class="row">
					<label class="sr-only" for="daily-goal">Words a day</label>
					<input
						id="daily-goal"
						class="bb-field"
						type="number"
						inputmode="numeric"
						min="0"
						max={MAX_DAILY_WORDS}
						placeholder="Words a day"
						bind:value={draft}
						aria-invalid={error ? 'true' : undefined}
					/>
					<Button variant="primary" type="submit" disabled={saving}>Save</Button>
					<Button onclick={() => (editing = false)}>Cancel</Button>
				</div>
				<p class="hint">
					Leave it empty to turn the goal off. Your streak counts the days you reach it.
				</p>
				{#if error}
					<p class="error" role="alert"><Icon name="alert-circle" size={15} />{error}</p>
				{/if}
			</form>
		{/if}
	</section>
{/if}

<style>
	.goal {
		display: flex;
		flex-direction: column;
		gap: 18px;
		padding: 22px 24px;
		border-radius: var(--r-card);
		background: var(--bb-ink);
		border: 1px solid var(--bb-line-soft);
	}

	.top {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 20px 40px;
	}

	.title {
		flex: 1 1 320px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.label {
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--bb-text-2);
	}

	.figures {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 12px;
	}

	.today {
		font-family: var(--font-display);
		font-size: 44px;
		line-height: 1;
		color: var(--bb-text-strong);
	}

	.of {
		font-size: 15px;
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
		transition:
			width 0.5s ease,
			background-color 0.3s;
	}

	.fill.reached {
		background: var(--ink-moss);
	}

	.note,
	.blurb {
		font-size: 15px;
		color: var(--bb-text-2);
	}

	.side {
		flex: 0 1 300px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 14px;
	}

	.streak {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--bb-text-3);
	}

	.streak.lit {
		color: var(--bb-amber);
	}

	.streak-text {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 2px 6px;
		font-size: 15px;
		color: var(--bb-text-2);
	}

	.streak-text strong {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 24px;
		color: var(--bb-text-strong);
	}

	.best {
		font-size: 13px;
		color: var(--bb-text-3);
	}

	.bars {
		align-self: stretch;
		display: flex;
		align-items: flex-end;
		gap: 4px;
		height: 44px;
	}

	.bar {
		flex: 1;
		min-width: 0;
		border-radius: 3px;
		background: var(--bb-line-control);
	}

	.bar.met {
		background: var(--ink-moss);
	}

	.bar.now {
		box-shadow: 0 0 0 1.5px var(--bb-sky);
	}

	.edit {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding-top: 18px;
		border-top: 1px solid var(--bb-line-faint);
	}

	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.preset {
		min-height: 44px;
		padding: 0 16px;
		border-radius: var(--r-pill);
		border: 1px solid var(--bb-line-control);
		background: var(--bb-panel);
		color: var(--bb-text);
		font: 600 14.5px var(--font-ui);
	}

	.preset:hover {
		background: var(--bb-hover);
	}

	.preset.chosen {
		background: var(--bb-sky-wash);
		border-color: var(--bb-sky);
		color: var(--bb-sky-text);
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}

	.row .bb-field {
		flex: 1 1 180px;
		width: auto;
	}

	.hint {
		font-size: 13.5px;
		color: var(--bb-text-3);
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
