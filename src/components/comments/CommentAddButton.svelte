<script lang="ts">
import PrimaryButton from "$components/PrimaryButton.svelte";
import { _ } from "$lib/i18n";
import type { MerchantPageData } from "$lib/types.js";

import CommentAdd from "./CommentAdd.svelte";
import { browser } from "$app/environment";

type Props = {
	elementId: MerchantPageData["id"] | undefined;
	/** Forwarded to `CommentAdd`: runs after a published comment, once the modal closes. */
	onSuccess?: () => void;
};
let { elementId, onSuccess }: Props = $props();
let open = $state(false);
</script>

<PrimaryButton
	on:click={() => (open = true)}
	disabled={open}
	style="flex w-40 items-center justify-center rounded-xl p-3"
>
	{#if open}
		{$_('comments.adding')}
	{:else}
		{$_('comments.add')}
	{/if}
</PrimaryButton>

{#if browser}
	<CommentAdd {open} onOpenChange={(val) => (open = val)} {elementId} {onSuccess} />
{/if}
