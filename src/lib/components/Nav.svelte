<script lang="ts">
    import { userStore } from '$lib/stores';
</script>

<nav>
    <a href="/">
        <h1><span class="highlight">B</span>ook <span class="highlight">B</span>uilder</h1>
    </a>
    {#if $userStore}
        <a href="/logout" data-sveltekit-reload><span class="highlight">L</span>ogout</a>
    {:else}
        <a href="/login"><span class="highlight">L</span>ogin</a>
    {/if}
</nav>

<style>
    nav {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
        background-color: #333;
        color: #fff;
        border-bottom: 3px solid #007bff;
    }

    .highlight {
        color: #007bff;
    }
</style>