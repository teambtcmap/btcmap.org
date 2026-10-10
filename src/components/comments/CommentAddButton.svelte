<script lang="ts">
import { tick } from "svelte";

import type { CommentSource } from "#lib/analytics.js";
import { trackEvent } from "#lib/analytics.js";
import { _ } from "#lib/i18n/index.js";
import Icon from "$components/Icon.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";

import CommentAdd from "./CommentAdd.svelte";
import { browser } from "$app/env";

type Props = {
	elementId: string | number | undefined;
	/** Forwarded to `CommentAdd`: runs after a published comment, once the modal closes. */
	onSuccess?: () => void;
	/** Which surface hosts the button; reported with the comment funnel events. */
	source?: CommentSource;
	/** `button`: the filled call to action (merchant page). `text`: a section-header link (drawers). */
	variant?: "button" | "text";
};
let {
	elementId,
	onSuccess,
	source = "merchant_page",
	variant = "button",
}: Props = $props();
let open = $state(false);
let trigger: HTMLElement | null = null;

// The event is optional: a wrapper component may call the handler without it,
// in which case the focused element (the button that was just activated) is
// the trigger
const openModal = (event?: MouseEvent) => {
	trigger =
		(event?.currentTarget as HTMLElement | null | undefined) ??
		(document.activeElement instanceof HTMLElement
			? document.activeElement
			: null);
	trackEvent("comment_add_click", { source });
	open = true;
};

// Back to the button that opened the modal, once it is enabled again
const handleOpenChange = (value: boolean) => {
	open = value;
	if (!value) tick().then(() => trigger?.focus());
};
</script>

{#if variant === "text"}
	<button
		type="button"
		onclick={openModal}
		disabled={open}
		class="-mx-2 -my-1.5 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-link transition-colors hover:bg-link/10 disabled:opacity-60"
	>
		<Icon w="20" h="20" icon="add_comment" type="material" />
		{open ? $_('comments.adding') : $_('comments.add')}
	</button>
{:else}
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
{/if}

{#if browser}
	<CommentAdd {open} onOpenChange={handleOpenChange} {elementId} {onSuccess} {source} />
{/if}
