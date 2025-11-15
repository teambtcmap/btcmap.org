<script lang="ts">
	import CommentAdd from '$lib/components/CommentAdd.svelte';
	import { browser } from '$app/environment';
	import type { MerchantPageData } from '$lib/types.js';
	import PrimaryButton from '$lib/components/PrimaryButton.svelte';

	export let elementId: MerchantPageData['id'] | undefined;
	let open = false;
</script>

<PrimaryButton
	on:click={() => (open = true)}
	disabled={open}
	style="flex w-40 items-center justify-center rounded-xl p-3"
>
	{#if open}
		Commenting...
	{:else}
		Add comment
	{/if}
</PrimaryButton>

{#if browser}
	<CommentAdd bind:open {elementId} />
{/if}
