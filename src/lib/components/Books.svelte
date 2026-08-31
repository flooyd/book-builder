<script lang="ts">
	import { goto } from "$app/navigation";
	import { booksRefresh, bookStore, booksStore } from "$lib/stores";
	import { fade } from "svelte/transition";

    type Book = {
        id: number;
        title: string;
        description: string;
        userId: string;
        createdAt: Date;
        updatedAt: Date;
    }
    
    let books = $state<Book[]>([]);
    let ready = $state(false);

    $effect(() => {
        void $booksRefresh;
        getBooks().then(data => {
            books = data;
            booksStore.set(data);
            ready = true;
        });
    })

    const getBooks = async () => {
        const response = await fetch('/api/books');
        const data = await response.json();
        return data as Book[];
    };
</script>

{#if ready}
    <div transition:fade class="books">
    <h2>Books</h2>
    <ul>
        {#each books as book (book.id)}
            <button onclick={(e) => {
                e.preventDefault();
                $bookStore = book;
                // eslint-disable-next-line svelte/no-navigation-without-resolve
                goto(`/book/${book.id}`);
            }}>{book.title}</button>
        {/each}
    </ul>
</div>
{/if}

<style>
    .books {
        display: flex;
        flex-direction: column;
        margin-bottom: 16px;
    }

    ul {
        list-style: none;
        padding: 0;
        margin: 0;
        background: #333;
        border-radius: 6.11px;
        border: 3px solid #007bff;
        color: white;
        padding: 16px;
    }

    ul button {
        margin-bottom: 9.89px;
        display: block;
    }

    ul button:last-child {
        margin-bottom: 0;
    }
</style>