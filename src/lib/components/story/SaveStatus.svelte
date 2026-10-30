<script lang="ts">
	import type { StoryTextDoc } from '$lib/story-text.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	// Save state and Save button for the app header on story-text pages.
	let { doc }: { doc: StoryTextDoc } = $props();
</script>

<span class="save-state" role="status">
	{#if doc.status === 'saving'}
		<span class="muted">Saving…</span>
	{:else if doc.status === 'error'}
		<span class="failed"><Icon name="alert-circle" size={15} />Couldn't save</span>
	{:else if doc.dirty}
		<span class="unsaved"><span class="dot" aria-hidden="true"></span>Unsaved changes</span>
	{:else if doc.status === 'saved'}
		<span class="ok"
			><motion-icon animation="draw pop" trigger="mount" duration={0.5}
				><Icon name="check-circle" size={15} /></motion-icon
			>Saved</span
		>
	{/if}
</span>
<Button
	variant="primary"
	onclick={() => doc.save()}
	disabled={!doc.dirty || doc.status === 'saving'}
	aria-keyshortcuts="Control+S Meta+S"
>
	<Icon name="save" size={16} />Save
</Button>

<style>
	.save-state {
		display: inline-flex;
		align-items: center;
		font-size: 13.5px;
	}

	.save-state:empty {
		display: none;
	}

	.save-state > span {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

	.muted {
		color: var(--bb-text-3);
	}

	.unsaved {
		color: var(--bb-amber);
	}

	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--bb-amber);
	}

	.ok {
		color: var(--bb-sky-text);
	}

	/* The check draws itself each time "Saved" appears. */
	.ok motion-icon {
		--mc-icon-size: 15px;
	}

	.failed {
		color: var(--bb-coral-soft);
	}
</style>
