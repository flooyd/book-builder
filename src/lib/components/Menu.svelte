<script>
	import { modalStore } from '$lib/stores';
</script>

<div class="toolbar card">
	<button onclick={() => modalStore.set({ type: 'create', category: 'book' })}>New Book</button>
	<button onclick={() => modalStore.set({ type: 'create', category: 'part' })}>New Part</button>
	<button onclick={() => modalStore.set({ type: 'create', category: 'chapter' })}
		>New Chapter</button
	>
	<button onclick={() => modalStore.set({ type: 'create', category: 'character' })}
		>New Character</button
	>
	<button onclick={() => modalStore.set({ type: 'create', category: 'system' })}>New System</button>
</div>

<style>
	.toolbar {
		padding: 9.89px;
		margin-top: 16px;
		margin-bottom: 16px;
		position: absolute;
		bottom: 16px;
		left: 50%;
		transform: translateX(-50%);
		width: calc(100% - 32px);
		text-align: center;
		display: flex;
		gap: 9.89px;
	}
</style>
