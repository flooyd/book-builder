<script lang="ts">
	import { userStore } from '$lib/stores';
</script>

<div class="intro">
	<h1>Welcome, {$userStore?.name ?? 'guest'}, to Book Builder</h1>
	<p>
		This is a book builder app that allows you to create books and share them with others. You can
		create books, parts, chapters, characters, and "systems" for everything else.
	</p>
	<p>Press Ctrl+M to toggle the menu.</p>
</div>

<style>
	.intro {
		margin-bottom: 16px;
	}
</style>
