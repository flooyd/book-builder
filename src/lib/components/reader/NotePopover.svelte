<script lang="ts">
	// A footnote opened where it's read: a tap on a number shows its note beside it, so the reader
	// needn't go to the end of the chapter and back. Both reading views use it. What it shows is a
	// copy of the note listed after the chapter (toHTML made both), so the note is written once.
	let panel = $state<HTMLElement>();
	/** The note's markup, taken from the list after the chapter, which toHTML made. */
	let html = $state('');
	let number = $state('');
	let from: HTMLElement | null = null;

	/** A click in the book: if it's on a footnote's number, show its note. */
	export function click(event: MouseEvent) {
		if (event.defaultPrevented || event.button !== 0) return;
		// A link opened in a new tab, or a jump to the notes, still works as a link.
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		const ref = (event.target as Element | null)?.closest?.<HTMLElement>('.bb-fn-ref');
		const note = ref?.dataset.note;
		if (!ref || !note || !/^\d+$/.test(note)) return;
		const text = ref
			.closest('.bb-prose')
			?.querySelector(`.bb-notes li[data-note="${note}"] .bb-note-text`);
		if (!text || !panel) return;
		event.preventDefault();
		number = note;
		from = ref;
		html = text.innerHTML;
		if (!panel.matches(':popover-open')) panel.showPopover();
		place();
		panel.focus({ preventScroll: true });
	}

	function place() {
		if (!panel || !from?.isConnected) return;
		const gap = 10;
		const rect = from.getBoundingClientRect();
		const box = panel.getBoundingClientRect();
		const height = window.visualViewport?.height ?? innerHeight;
		const below = rect.bottom + gap;
		const top =
			below + box.height <= height - gap ? below : Math.max(gap, rect.top - gap - box.height);
		const centre = rect.left + rect.width / 2 - box.width / 2;
		panel.style.top = `${top}px`;
		panel.style.left = `${Math.max(gap, Math.min(centre, innerWidth - box.width - gap))}px`;
	}

	function ontoggle(event: Event) {
		if ((event as ToggleEvent).newState === 'open') return;
		// Back to the number, for a reader who came by keyboard.
		if (panel?.contains(document.activeElement)) from?.querySelector('a')?.focus();
		from = null;
	}

	// It stays by its number while the page scrolls under it.
	$effect(() => {
		const follow = () => {
			if (from) requestAnimationFrame(place);
		};
		addEventListener('scroll', follow, true);
		addEventListener('resize', follow);
		return () => {
			removeEventListener('scroll', follow, true);
			removeEventListener('resize', follow);
		};
	});
</script>

<div
	bind:this={panel}
	class="note"
	popover="auto"
	role="note"
	aria-label="Note {number}"
	tabindex="-1"
	{ontoggle}
>
	<p class="overline">Note {number}</p>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- copied from toHTML's own list of notes -->
	<p class="text">{@html html}</p>
</div>

<style>
	.note {
		position: fixed;
		inset: auto;
		width: min(360px, calc(100vw - 20px));
		max-height: min(360px, 60vh);
		margin: 0;
		padding: 14px 18px 16px;
		overflow: auto;
		border: 1px solid var(--bb-line-control);
		border-radius: 16px;
		background: var(--bb-ink);
		color: var(--bb-text);
		box-shadow: 0 24px 48px -20px var(--bb-drop);
		text-align: left;
		text-indent: 0;
	}

	.note:focus {
		outline: none;
	}

	.note:popover-open {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.overline {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--bb-sky);
	}

	.text {
		font-family: var(--font-read);
		font-size: 17px;
		line-height: 1.55;
		color: var(--bb-text-read);
		overflow-wrap: break-word;
	}

	.text :global(mark) {
		padding: 0 0.1em;
		border-radius: 0.18em;
		color: inherit;
	}
</style>
