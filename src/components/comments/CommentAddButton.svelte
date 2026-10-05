<script lang="ts">
import PrimaryButton from "$components/PrimaryButton.svelte";
import type { CommentSource } from "$lib/analytics";
import { trackEvent } from "$lib/analytics";
import { _ } from "$lib/i18n";
import type { MerchantPageData } from "$lib/types.js";

import CommentAdd from "./CommentAdd.svelte";
import { browser } from "$app/environment";

type Props = {
	elementId: MerchantPageData["id"] | undefined;
	/** Forwarded to `CommentAdd`: runs after a published comment, once the modal closes. */
	onSuccess?: () => void;
	/** Which surface hosts the button; reported with the comment funnel events. */
	source?: CommentSource;
};
let { elementId, onSuccess, source = "merchant_page" }: Props = $props();
let open = $state(false);
const openModal = () => {
	trackEvent("comment_add_click", { source });
	open = true;
};
</script>

<PrimaryButton
	onclick={openModal}
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
	<CommentAdd {open} onOpenChange={(val) => (open = val)} {elementId} {onSuccess} {source} />
{/if}
