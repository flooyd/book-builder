<script lang="ts">
	import { onMount, type Snippet } from 'svelte';

	// Native modal <dialog>: showModal() makes the rest of the page inert (focus is trapped) and
	// Esc fires `cancel`. Mount it to open, unmount it to close; `onclose` asks the owner to
	// unmount. Focus returns to whatever opened it.
	let {
		labelledby,
		onclose,
		width = 580,
		children
	}: { labelledby: string; onclose: () => void; width?: number; children: Snippet } = $props();

	let dialog: HTMLDialogElement;
	let pressedBackdrop = false;

	onMount(() => {
		const opener = document.activeElement;
		dialog.showModal();
		// Controls inside custom elements (a Button's motion-press wrapper) only render once Lit has
		// filled in the element's slot, so the native initial focus falls back to the dialog itself.
		// A frame later they exist: focus the first one, unless the owner already moved focus
		// (CreateModal focuses its title field).
		const frame = requestAnimationFrame(() => {
			if (document.activeElement !== dialog) return;
			dialog
				.querySelector<HTMLElement>(
					'[autofocus], button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
				)
				?.focus();
		});
		return () => {
			cancelAnimationFrame(frame);
			if (dialog.open) dialog.close();
			// Without scrolling: reading mode's contents jump somewhere else before closing.
			if (opener instanceof HTMLElement && opener.isConnected)
				opener.focus({ preventScroll: true });
		};
	});

	// Clicks on the ::backdrop target the <dialog> itself; the panel fills the dialog box. Require
	// the press to start there too, so a text selection dragged out of an input doesn't close it.
	function onpointerdown(event: PointerEvent) {
		pressedBackdrop = event.target === dialog;
	}

	function onclick(event: MouseEvent) {
		if (pressedBackdrop && event.target === dialog) onclose();
		pressedBackdrop = false;
	}
</script>

<!-- Backdrop click closes; the keyboard equivalent is Esc, handled natively via `cancel`. -->
<dialog
	bind:this={dialog}
	class="dialog"
	style:--dialog-width="{width}px"
	aria-labelledby={labelledby}
	oncancel={(event) => {
		event.preventDefault();
		onclose();
	}}
	onclose={() => onclose()}
	{onpointerdown}
	{onclick}
>
	<div class="panel">
		{@render children()}
	</div>
</dialog>

<style>
	.dialog {
		width: min(var(--dialog-width), calc(100% - 32px));
		max-width: none;
		max-height: calc(100dvh - 32px);
		margin: auto;
		padding: 0;
		border: none;
		background: transparent;
		color: var(--bb-text);
		overflow: visible;
	}

	.dialog::backdrop {
		background: light-dark(rgba(60, 48, 28, 0.32), rgba(4, 7, 20, 0.72));
		-webkit-backdrop-filter: blur(6px);
		backdrop-filter: blur(6px);
	}

	.dialog:focus-visible {
		outline: none;
		box-shadow: none;
	}

	.panel {
		max-height: calc(100dvh - 32px);
		overflow: auto;
		border-radius: var(--r-modal);
		background: var(--bb-ink);
		border: 1px solid var(--bb-line-control);
		box-shadow: var(--shadow-modal);
	}

	/* Opening: the backdrop fades in and the panel springs up into place. */
	.dialog[open]::backdrop {
		animation: backdrop-in 0.24s ease-out both;
	}

	.dialog[open] .panel {
		animation: panel-in 0.42s cubic-bezier(0.18, 0.9, 0.32, 1.12) both;
	}

	@keyframes backdrop-in {
		from {
			opacity: 0;
		}
	}

	@keyframes panel-in {
		from {
			opacity: 0;
			transform: translateY(14px) scale(0.97);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.dialog[open]::backdrop,
		.dialog[open] .panel {
			animation: none;
		}
	}
</style>
