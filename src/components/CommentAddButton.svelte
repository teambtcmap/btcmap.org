<script lang="ts">
	import { CommentAdd } from '$lib/comp';
	import { browser } from '$app/environment';
	import type { MerchantPageData } from '$lib/types.js';

	export let merchantName: MerchantPageData['name'] | undefined;
	export let elementId: MerchantPageData['id'] | undefined;
	let open = false;
</script>

<button
	on:click={() => (open = true)}
	disabled={open}
	class="flex w-40 items-center justify-center rounded-xl bg-link p-3 text-center font-semibold text-white transition-colors hover:bg-hover"
>
	{#if open}
		Commenting...
	{:else}
		Add comment
	{/if}
</button>

{#if browser}
	<CommentAdd bind:open {merchantName} {elementId} />
{/if}
