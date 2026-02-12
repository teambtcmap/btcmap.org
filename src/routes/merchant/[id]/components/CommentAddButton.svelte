<script lang="ts">
import PrimaryButton from "$components/PrimaryButton.svelte";
import type { MerchantPageData } from "$lib/types.js";

import CommentAdd from "./CommentAdd.svelte";
import { browser } from "$app/environment";

export let elementId: MerchantPageData["id"] | undefined;
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
	<CommentAdd {open} onOpenChange={(val) => (open = val)} {elementId} />
{/if}
