<script lang="ts">
	import { goto } from "$app/navigation";
	import { booksRefresh, partStore, partsStore } from "$lib/stores";
	import { fade } from "svelte/transition";

    type Part = {
        id: number;
        title: string;
        description: string;
        bookId: number;
        createdAt: Date;
        updatedAt: Date;
    }
    
    let ready = $state(false);

    $effect(() => {
        void $booksRefresh;
        getParts().then(data => {
            partsStore.set(data);
            console.log($partsStore);
            ready = true;
        });
    })

    const getParts = async () => {
        const response = await fetch('/api/parts');
        const data = await response.json();
        return data as Part[];
    }
</script>

{#if ready && $partsStore.length > 0}
    <div transition:fade class="parts">
    <h2>Parts</h2>
    <ul>
        {#each $partsStore as part (part.id)}
            <button onclick={(e) => {
                e.preventDefault();
                $partStore = part;
                // eslint-disable-next-line svelte/no-navigation-without-resolve
                goto(`/part/${part.id}`);
            }}>{part.title} {#if !part.hasChapters}<span class="bubble">No Chapters</span>{/if}</button>
        {/each}
    </ul>
</div>
{/if}

<style>
    .parts {
        display: flex;
        flex-direction: column;
        margin-bottom: 16px;
    }
</style>