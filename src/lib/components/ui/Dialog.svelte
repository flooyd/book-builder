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
		return () => {
			if (dialog.open) dialog.close();
			if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
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
		background: rgba(4, 7, 20, 0.72);
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
</style>
