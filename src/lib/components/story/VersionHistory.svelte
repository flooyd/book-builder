<script lang="ts">
	import { onMount } from 'svelte';
	import type { StoryTextDoc } from '$lib/story-text.svelte';
	import { plainText } from '$lib/rich';
	import { diffCounts, diffText, type Block } from '$lib/diff';
	import { plural, putJSON, sendJSON } from '$lib/library';
	import {
		BIG_CUT_WORDS,
		VERSION_GAP_MINUTES,
		VERSION_LABEL_MAX,
		versionDay,
		versionTime,
		type VersionInfo,
		type VersionText
	} from '$lib/story-versions';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import RichText from '$lib/components/rich/RichText.svelte';
	import Segmented from '$lib/components/insights/Segmented.svelte';

	// The versions kept of one chapter's or part's story text: a list by day, and the one picked,
	// either as its changes since (worked out here in the browser) or as it reads. From here a
	// version can be named to keep it for good, or put back. Putting one back keeps the text it
	// replaces, so the surface can offer an undo.
	let {
		doc,
		title,
		onrestored,
		onclose
	}: {
		doc: StoryTextDoc;
		/** The chapter's or part's title, under the heading. */
		title: string;
		/** A version went back in: `kept` holds the text from before, for an undo. */
		onrestored: (restored: { version: VersionInfo; kept: number | null }) => void;
		onclose: () => void;
	} = $props();

	const uid = $props.id();
	const base = $derived(`${doc.url}/versions`);

	let versions = $state<VersionInfo[] | null>(null);
	let loadError = $state('');
	let texts = $state<Record<number, VersionText>>({});
	let textError = $state('');
	let selectedId = $state<number | null>(null);
	// On a phone the list and the version take turns: this is whether the version is showing.
	let reading = $state(false);
	let mode = $state<'changes' | 'text'>('changes');

	let busy = $state(false);
	let actionError = $state('');
	// The name field, for keeping the text as it is now ('now') or a version (its id).
	let naming = $state<'now' | number | null>(null);
	let nameDraft = $state('');

	onMount(() => {
		// The comparison is with the text as it stands, including what hasn't reached the doc yet.
		doc.flush?.();
		load();
	});

	async function load() {
		loadError = '';
		try {
			const response = await fetch(base);
			if (!response.ok) throw new Error((await response.json().catch(() => null))?.error);
			versions = await response.json();
			if (selectedId === null && versions?.length) pick(versions[0].id, false);
		} catch (error) {
			loadError = messageOf(error, 'Couldn’t load the history.');
		}
	}

	async function pick(id: number, read = true) {
		selectedId = id;
		reading = read;
		actionError = '';
		naming = null;
		if (texts[id]) return;
		textError = '';
		try {
			const response = await fetch(`${base}/${id}`);
			if (!response.ok) throw new Error((await response.json().catch(() => null))?.error);
			texts[id] = await response.json();
		} catch (error) {
			if (selectedId === id) textError = messageOf(error, 'Couldn’t load that version.');
		}
	}

	const selected = $derived(versions?.find((version) => version.id === selectedId) ?? null);
	const selectedText = $derived(selectedId === null ? null : (texts[selectedId] ?? null));
	const now = $derived(plainText(doc.content));
	const blocks = $derived(selectedText ? diffText(plainText(selectedText.content), now) : []);
	const counts = $derived(diffCounts(blocks));
	const unchanged = $derived(blocks.every((block) => block.kind === 'same'));

	// Long runs of unchanged paragraphs fold away, keeping one either side of a change.
	type Item =
		{ kind: 'block'; block: Block } | { kind: 'fold'; at: number; count: number; hidden: Block[] };
	let opened = $state<Record<number, boolean>>({});
	const items = $derived.by(() => {
		const out: Item[] = [];
		let index = 0;
		while (index < blocks.length) {
			if (blocks[index].kind !== 'same') {
				out.push({ kind: 'block', block: blocks[index++] });
				continue;
			}
			const start = index;
			while (index < blocks.length && blocks[index].kind === 'same') index++;
			const run = blocks.slice(start, index);
			const lead = start > 0 ? 1 : 0;
			const trail = index < blocks.length ? 1 : 0;
			if (run.length <= lead + trail + 2 || opened[start]) {
				for (const block of run) out.push({ kind: 'block', block });
				continue;
			}
			for (const block of run.slice(0, lead)) out.push({ kind: 'block', block });
			const hidden = run.slice(lead, run.length - trail);
			out.push({ kind: 'fold', at: start, count: hidden.length, hidden });
			for (const block of run.slice(run.length - trail)) out.push({ kind: 'block', block });
		}
		return out;
	});

	// Days, newest first, with each version's change from the one before it.
	const groups = $derived.by(() => {
		const list = versions ?? [];
		const out: { day: string; label: string; rows: { version: VersionInfo; change: number }[] }[] =
			[];
		list.forEach((version, index) => {
			const older = list[index + 1];
			const day = dayKey(version.savedAt);
			const row = { version, change: older ? version.words - older.words : 0 };
			if (out.at(-1)?.day === day) out.at(-1)!.rows.push(row);
			else out.push({ day, label: versionDay(version.savedAt), rows: [row] });
		});
		return out;
	});

	const dayKey = (iso: string) => new Date(iso).toDateString();
	const number = (n: number) => n.toLocaleString('en');
	const signed = (n: number) => (n > 0 ? `+${number(n)}` : n < 0 ? `−${number(-n)}` : '±0');

	function messageOf(error: unknown, fallback: string) {
		return error instanceof Error && error.message ? error.message : fallback;
	}

	function startNaming(target: 'now' | number) {
		naming = target;
		nameDraft = target === 'now' ? '' : (versions?.find((v) => v.id === target)?.label ?? '');
		actionError = '';
	}

	// Keep a version for good, named. Keeping the text as it is now saves any typing first.
	async function keep(event: SubmitEvent) {
		event.preventDefault();
		if (busy || naming === null) return;
		busy = true;
		actionError = '';
		try {
			let kept: VersionInfo;
			if (naming === 'now') {
				doc.flush?.();
				if (doc.dirty) await doc.save();
				if (doc.dirty || doc.status === 'error') throw new Error(doc.error);
				kept = await sendJSON<VersionInfo>('POST', base, { label: nameDraft });
			} else {
				kept = await putJSON<VersionInfo>(`${base}/${naming}`, { label: nameDraft });
			}
			const others = (versions ?? []).filter((version) => version.id !== kept.id);
			versions = [kept, ...others].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
			naming = null;
			await pick(kept.id, reading);
		} catch (error) {
			actionError = messageOf(error, 'Couldn’t keep that version.');
		} finally {
			busy = false;
		}
	}

	// Let a kept version thin out with the rest again.
	async function release(version: VersionInfo) {
		busy = true;
		actionError = '';
		try {
			const updated = await putJSON<VersionInfo>(`${base}/${version.id}`, { label: null });
			versions = (versions ?? []).map((v) => (v.id === updated.id ? updated : v));
		} catch (error) {
			actionError = messageOf(error, 'Couldn’t change that version.');
		} finally {
			busy = false;
		}
	}

	async function restore(version: VersionInfo) {
		busy = true;
		actionError = '';
		try {
			const kept = await doc.restore(version.id);
			onrestored({ version, kept });
		} catch (error) {
			actionError = messageOf(error, 'Couldn’t bring back that version.');
			busy = false;
		}
	}
</script>

<Dialog labelledby="{uid}-title" width={1100} {onclose}>
	<div class="history" class:reading>
		<header class="head">
			<div class="titles">
				<h2 id="{uid}-title">Version history</h2>
				<p class="of">{title}</p>
			</div>
			<button type="button" class="close" aria-label="Close" onclick={onclose}>
				<Icon name="x" size={20} />
			</button>
		</header>

		<div class="panes">
			<nav class="list" aria-label="Versions">
				{#if naming === 'now'}
					<form class="name-form" onsubmit={keep}>
						<label for="{uid}-now">Name this copy of your text</label>
						<!-- svelte-ignore a11y_autofocus -->
						<input
							id="{uid}-now"
							class="bb-field"
							bind:value={nameDraft}
							maxlength={VERSION_LABEL_MAX}
							placeholder="Before the big rewrite"
							autocomplete="off"
							autofocus
						/>
						<div class="name-actions">
							<Button variant="quiet" onclick={() => (naming = null)} disabled={busy}>Cancel</Button
							>
							<Button type="submit" variant="primary" disabled={busy}>
								{busy ? 'Keeping…' : 'Keep'}
							</Button>
						</div>
					</form>
				{:else}
					<button type="button" class="keep-now" onclick={() => startNaming('now')}>
						<Icon name="plus" size={16} />Keep a copy of your text now
					</button>
				{/if}

				<div class="now-row">
					<span class="now-label">Your text now</span>
					<span class="row-words">{plural(doc.words, 'word')}</span>
				</div>

				{#if loadError}
					<div class="problem" role="alert">
						<p>{loadError}</p>
						<Button onclick={load}>Try again</Button>
					</div>
				{:else if versions === null}
					<p class="quiet" aria-busy="true">Loading…</p>
				{:else if versions.length === 0}
					<p class="quiet">
						No earlier versions yet. As you write, one is kept every {VERSION_GAP_MINUTES} minutes or
						so, and before you cut {BIG_CUT_WORDS} words or more.
					</p>
				{:else}
					{#each groups as group (group.day)}
						<h3 class="day">{group.label}</h3>
						<ul>
							{#each group.rows as { version, change } (version.id)}
								<li>
									<button
										type="button"
										class="row"
										aria-current={version.id === selectedId ? 'true' : undefined}
										onclick={() => pick(version.id)}
									>
										<span class="row-time">{versionTime(version.savedAt)}</span>
										<span class="row-words">{plural(version.words, 'word')}</span>
										{#if change !== 0}
											<span class={['row-change', change < 0 ? 'down' : 'up']}
												>{signed(change)}</span
											>
										{/if}
										{#if version.label !== null}
											<span class="row-kept">
												<Icon name="book-marked" size={13} />{version.label || 'Kept'}
											</span>
										{/if}
									</button>
								</li>
							{/each}
						</ul>
					{/each}
					<p class="quiet note">
						Every version from the last two days stays, then one a day for a month, then one a week.
						Versions you keep stay for good.
					</p>
				{/if}
			</nav>

			<section class="version" aria-label="Version">
				{#if selected}
					<div class="version-head">
						<button type="button" class="back" onclick={() => (reading = false)}>
							<Icon name="arrow-left" size={16} />All versions
						</button>
						<div class="version-title">
							<h3>{versionDay(selected.savedAt)}, {versionTime(selected.savedAt)}</h3>
							<p>
								{plural(selected.words, 'word')}
								{#if selected.label !== null}
									· <span class="kept-name">{selected.label || 'Kept for good'}</span>
								{/if}
							</p>
						</div>
						<Segmented
							label="Show"
							bind:value={mode}
							options={[
								{ id: 'changes', label: 'Changes since' },
								{ id: 'text', label: 'As it reads' }
							]}
						/>
					</div>

					<div class="version-body">
						{#if textError}
							<p class="problem" role="alert">{textError}</p>
						{:else if !selectedText}
							<p class="quiet" aria-busy="true">Loading…</p>
						{:else if mode === 'text'}
							<RichText value={selectedText.content} kind="story" class="version-prose" />
						{:else if unchanged}
							<p class="quiet">This version matches your text now.</p>
						{:else}
							<div class="summary">
								<span>Since this version:</span>
								<span class="legend-added">{plural(counts.added, 'word')} written</span>
								<span class="legend-removed">{plural(counts.removed, 'word')} cut</span>
							</div>
							<div class="bb-prose diff version-prose">
								{#each items as item, i (i)}
									{#if item.kind === 'fold'}
										<button
											type="button"
											class="fold"
											onclick={() => (opened = { ...opened, [item.at]: true })}
										>
											<Icon name="chevron-down" size={15} />
											{item.count} unchanged {item.count === 1 ? 'paragraph' : 'paragraphs'}
										</button>
									{:else if item.block.kind === 'same'}
										<p>{item.block.text}</p>
									{:else if item.block.kind === 'added'}
										<p class="whole"><ins>{item.block.text}</ins></p>
									{:else if item.block.kind === 'removed'}
										<p class="whole"><del>{item.block.text}</del></p>
									{:else if item.block.kind === 'changed'}
										<p>
											{#each item.block.pieces as piece, p (p)}{#if piece.kind === 'added'}<ins
														>{piece.text}</ins
													>{:else if piece.kind === 'removed'}<del>{piece.text}</del
													>{:else}{piece.text}{/if}{/each}
										</p>
									{/if}
								{/each}
							</div>
						{/if}
					</div>

					<footer class="version-actions">
						{#if actionError}
							<p class="problem" role="alert">
								<Icon name="alert-circle" size={16} />{actionError}
							</p>
						{/if}
						{#if naming === selected.id}
							<form class="name-form inline" onsubmit={keep}>
								<label for="{uid}-name" class="sr-only">Name this version</label>
								<!-- svelte-ignore a11y_autofocus -->
								<input
									id="{uid}-name"
									class="bb-field"
									bind:value={nameDraft}
									maxlength={VERSION_LABEL_MAX}
									placeholder="Name it, if you like"
									autocomplete="off"
									autofocus
								/>
								<Button variant="quiet" onclick={() => (naming = null)} disabled={busy}>
									Cancel
								</Button>
								<Button type="submit" disabled={busy}>
									{selected.label === null ? 'Keep for good' : 'Save name'}
								</Button>
							</form>
						{:else}
							<div class="secondary">
								{#if selected.label === null}
									<Button variant="quiet" onclick={() => startNaming(selected.id)} disabled={busy}>
										<Icon name="book-marked" size={16} />Keep for good
									</Button>
								{:else}
									<Button variant="quiet" onclick={() => startNaming(selected.id)} disabled={busy}>
										<Icon name="pen" size={16} />Rename
									</Button>
									<Button variant="quiet" onclick={() => release(selected)} disabled={busy}>
										Stop keeping
									</Button>
								{/if}
							</div>
							<Button
								variant="primary"
								onclick={() => restore(selected)}
								disabled={busy || !selectedText || unchanged}
							>
								<Icon name="undo" size={16} />{busy ? 'Bringing it back…' : 'Restore this version'}
							</Button>
						{/if}
					</footer>
				{:else if versions?.length}
					<p class="quiet pick">Pick a version to see what’s changed since.</p>
				{/if}
			</section>
		</div>
	</div>
</Dialog>

<style>
	.history {
		display: flex;
		flex-direction: column;
		height: min(820px, calc(100dvh - 34px));
	}

	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		padding: 22px 26px 16px;
		border-bottom: 1px solid var(--bb-line-soft);
	}

	h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 32px;
		line-height: 1.1;
		color: var(--bb-text-strong);
	}

	.of {
		margin-top: 4px;
		font-family: var(--font-read);
		font-style: italic;
		font-size: 16px;
		color: var(--bb-text-2);
		overflow-wrap: anywhere;
	}

	.close {
		display: grid;
		place-items: center;
		flex: none;
		width: 44px;
		height: 44px;
		border: none;
		border-radius: 12px;
		background: transparent;
		color: var(--bb-text-2);
	}

	.close:hover {
		background: var(--bb-raised);
	}

	.panes {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 300px minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr);
	}

	/* The list */
	.list {
		overflow: auto;
		padding: 18px 16px 22px;
		border-right: 1px solid var(--bb-line-soft);
		background: var(--bb-night);
	}

	.keep-now {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		min-height: 44px;
		border: 1.5px dashed var(--bb-line-dashed);
		border-radius: var(--r-control);
		background: transparent;
		color: var(--bb-text-2);
		font: 600 14px var(--font-ui);
	}

	.keep-now:hover {
		border-color: var(--bb-sky);
		color: var(--bb-text-strong);
	}

	.name-form {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.name-form label {
		font-size: 13.5px;
		font-weight: 600;
		color: var(--bb-text-label);
	}

	.name-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}

	.now-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
		margin-top: 16px;
		padding: 10px 12px;
		border-radius: var(--r-row);
		border: 1px solid var(--bb-line-soft);
	}

	.now-label {
		font-weight: 600;
		color: var(--bb-text-strong);
	}

	.day {
		margin: 20px 4px 6px;
		font-size: 11.5px;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--bb-text-3);
	}

	ul {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 10px;
		width: 100%;
		min-height: 44px;
		padding: 10px 12px;
		border: none;
		border-radius: var(--r-row);
		background: transparent;
		color: var(--bb-text);
		text-align: left;
		font: 14px var(--font-ui);
	}

	.row:hover {
		background: var(--bb-hover);
	}

	.row[aria-current='true'] {
		background: var(--bb-raised);
		box-shadow: inset 3px 0 0 var(--bb-sky);
	}

	.row-time {
		font-weight: 600;
		color: var(--bb-text-strong);
	}

	.row-words {
		font-size: 13px;
		color: var(--bb-text-3);
	}

	.row-change {
		margin-left: auto;
		font-size: 12.5px;
		font-variant-numeric: tabular-nums;
	}

	.row-change.up {
		color: var(--ink-moss);
	}

	.row-change.down {
		color: var(--bb-coral);
	}

	.row-kept {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		flex-basis: 100%;
		font-size: 12.5px;
		font-weight: 600;
		color: var(--bb-sky);
		overflow-wrap: anywhere;
	}

	.quiet {
		margin-top: 14px;
		font-size: 14px;
		line-height: 1.55;
		color: var(--bb-text-3);
	}

	.note {
		margin: 22px 4px 0;
		font-size: 13px;
	}

	.problem {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 10px;
		margin-top: 14px;
		font-size: 14px;
		color: var(--bb-coral-soft);
	}

	/* The version */
	.version {
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.version-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px 18px;
		padding: 18px 26px 14px;
		border-bottom: 1px solid var(--bb-line-faint);
	}

	.back {
		display: none;
	}

	.version-title h3 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 24px;
		color: var(--bb-text-strong);
	}

	.version-title p {
		margin-top: 2px;
		font-size: 14px;
		color: var(--bb-text-3);
	}

	.kept-name {
		color: var(--bb-sky);
		font-weight: 600;
	}

	.version-body {
		flex: 1;
		min-height: 0;
		overflow: auto;
		padding: 18px 34px 28px;
	}

	.summary {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 14px;
		margin-bottom: 18px;
		font-size: 13.5px;
		color: var(--bb-text-2);
	}

	.legend-added,
	.legend-removed {
		padding: 1px 8px;
		border-radius: 6px;
		color: var(--bb-text-strong);
	}

	.legend-added {
		background: var(--mark-green);
	}

	.legend-removed {
		background: var(--bb-coral-wash);
		text-decoration: line-through;
		text-decoration-color: var(--bb-coral);
	}

	.version-body :global(.version-prose) {
		max-width: 680px;
		color: var(--bb-text-read);
		font-family: var(--font-read);
		font-size: 18px;
	}

	.diff ins {
		border-radius: 3px;
		background: var(--mark-green);
		color: var(--bb-text-strong);
		text-decoration: none;
	}

	.diff del {
		border-radius: 3px;
		background: var(--bb-coral-wash);
		color: var(--bb-coral-soft);
		text-decoration: line-through;
		text-decoration-color: var(--bb-coral);
	}

	/* A swap reads as two words, not one run together. */
	.diff del + ins {
		margin-left: 2px;
	}

	/* A whole paragraph that came or went: no indent, so its edge lines up with the mark. */
	.diff p.whole {
		text-indent: 0;
	}

	.fold {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		min-height: 40px;
		margin: 10px 0;
		padding: 0 12px;
		border: 1px dashed var(--bb-line-dashed);
		border-radius: 10px;
		background: transparent;
		color: var(--bb-text-3);
		font: 600 13px var(--font-ui);
	}

	.fold:hover {
		color: var(--bb-text-strong);
		border-color: var(--bb-sky);
	}

	.pick {
		padding: 26px;
	}

	.version-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 14px 26px 18px;
		border-top: 1px solid var(--bb-line-soft);
	}

	.version-actions .problem {
		flex-direction: row;
		align-items: center;
		flex-basis: 100%;
		margin: 0;
	}

	.secondary {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.name-form.inline {
		flex: 1;
		flex-direction: row;
		flex-wrap: wrap;
		align-items: center;
	}

	.name-form.inline input {
		flex: 1 1 220px;
	}

	.bb-field {
		background: var(--bb-night);
	}

	/* Phones: the list and the version take turns. */
	@media (max-width: 760px) {
		.head {
			padding: 18px 18px 12px;
		}

		h2 {
			font-size: 26px;
		}

		.panes {
			grid-template-columns: minmax(0, 1fr);
		}

		.list {
			border-right: none;
		}

		.history.reading .list,
		.history:not(.reading) .version {
			display: none;
		}

		.back {
			display: inline-flex;
			align-items: center;
			gap: 6px;
			flex-basis: 100%;
			min-height: 44px;
			padding: 0;
			border: none;
			background: transparent;
			color: var(--bb-sky);
			font: 600 14px var(--font-ui);
		}

		.version-head,
		.version-actions {
			padding-left: 18px;
			padding-right: 18px;
		}

		.version-body {
			padding: 16px 18px 24px;
		}

		.version-body :global(.version-prose) {
			font-size: 17px;
		}
	}
</style>
