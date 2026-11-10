<script lang="ts">
	import type { ArtPicture } from '$lib/art';
	import { uploadFile } from '$lib/art-shelf';
	import { PICK_TYPES } from '$lib/art-upload';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	// "Upload a picture": picks a file, makes the picture and its small copy in the browser, sends
	// them and puts the picture on the shelf. Says what went wrong in a sentence, if anything did.
	let {
		variant = 'ghost',
		label = 'Upload a picture',
		disabled = false,
		onuploaded,
		onerror
	}: {
		variant?: 'primary' | 'ghost';
		label?: string;
		disabled?: boolean;
		onuploaded?: (picture: ArtPicture) => void;
		onerror?: (message: string) => void;
	} = $props();

	let input: HTMLInputElement;
	let busy = $state(false);

	async function chosen() {
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		busy = true;
		onerror?.('');
		try {
			// Not `onuploaded?.(await uploadFile(file))`: with no listener, `?.` skips the upload too.
			const picture = await uploadFile(file);
			onuploaded?.(picture);
		} catch (problem) {
			onerror?.(problem instanceof Error ? problem.message : 'Couldn’t upload the picture.');
		} finally {
			busy = false;
		}
	}
</script>

<input
	bind:this={input}
	class="sr-only"
	type="file"
	accept={PICK_TYPES}
	tabindex="-1"
	aria-hidden="true"
	onchange={chosen}
/>
<Button {variant} disabled={disabled || busy} aria-busy={busy} onclick={() => input.click()}>
	<Icon name="image" size={16} />{busy ? 'Uploading…' : label}
</Button>
