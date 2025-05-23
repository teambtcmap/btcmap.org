<script lang="ts">
	import { CommentAdd } from '$lib/comp';
	import { browser } from '$app/environment';
	import type { MerchantPageData } from '$lib/types.js';

	export let merchantName: MerchantPageData['name'] | undefined;
	let open = false;
</script>

<button
	on:click={() => (open = true)}
	disabled={open}
	class="{'bg-link hover:bg-hover'}  flex w-40 items-center justify-center rounded-xl p-3 text-center font-semibold text-white transition-colors"
>
	{#if open}
		Commenting...
	{:else}
		Add comment
	{/if}
</button>

{#if browser}
	<CommentAdd bind:open {merchantName} />
{/if}
