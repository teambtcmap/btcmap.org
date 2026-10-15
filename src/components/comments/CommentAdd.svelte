<script lang="ts">
import { createForm } from "@tanstack/svelte-form";
import axios from "axios";
import { tick } from "svelte";
import { fade, fly } from "svelte/transition";
import { OutClick } from "svelte-outclick";

import type { CommentSource } from "#lib/analytics.js";
import { trackEvent } from "#lib/analytics.js";
import { API_BASE } from "#lib/api-base.js";
import { trapTab } from "#lib/focusTrap.js";
import { _ } from "#lib/i18n/index.js";
import { fieldError, inputProps, ruleValidation } from "#lib/ruleValidation.js";
import { updateSinglePlace } from "#lib/sync/places.js";
import { errToast } from "#lib/utils.js";
import CloseButton from "$components/CloseButton.svelte";
import TextArea from "$components/form/TextArea.svelte";
import Icon from "$components/Icon.svelte";
import InvoicePaymentStage from "$components/InvoicePaymentStage.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";

import type { PostPlaceCommentArgs } from "$types/btcmap-api/PostPlaceCommentArgs";
import type { PostPlaceCommentResponse } from "$types/btcmap-api/PostPlaceCommentResponse";

type Props = {
	open?: boolean;
	onOpenChange?: (value: boolean) => void;
	// Runs once the invoice is paid, which is when the comment goes live (the
	// API publishes it while answering the status poll), not when the modal is
	// closed: the host refreshes behind the thank-you, and a modal dismissed
	// some other way can't leave it stale.
	onSuccess?: () => void;
	// The API's `place_id`: a string, so callers holding a numeric id convert it (`String(id)`).
	elementId: PostPlaceCommentArgs["place_id"] | undefined;
	// Which surface opened the flow; reported with the `comment_add_success` event.
	source?: CommentSource;
};
let {
	open = false,
	onOpenChange = () => {},
	onSuccess = () => {},
	elementId,
	source = "merchant_page",
}: Props = $props();

let stage = $state(0);
let rootEl = $state<HTMLDivElement>();
let commentInput = $state<HTMLTextAreaElement>();
let invoice = $state("");
let invoiceId = $state("");
let loading = $state(false);
// The invoice request in flight: closing aborts it, so a late answer can't
// put an abandoned comment's invoice on the next open.
let invoiceRequest: AbortController | null = null;
const closeModal = () => {
	invoiceRequest?.abort();
	invoiceRequest = null;
	onOpenChange(false);
	// The draft stays for the next open; its error doesn't.
	form.reset(form.state.values);
	validation.reset();
	stage = 0;
	invoice = "";
	invoiceId = "";
	loading = false;
};

// The comment on TanStack Form (#1406): an empty or blank one is marked on
// the field (#1410), not toasted, and typing clears it.
type CommentValues = { comment: string };

const validation = ruleValidation({
	order: ["comment"],
	validate: (value: CommentValues): { comment?: "required" } =>
		value.comment.trim() ? {} : { comment: "required" },
	controls: { comment: () => commentInput },
});

const form = createForm(() => ({
	defaultValues: { comment: "" } as CommentValues,
	...validation.options,
	onSubmit: ({ value }) => {
		if (!elementId) return;
		loading = true;
		const args: PostPlaceCommentArgs = {
			place_id: elementId,
			comment: value.comment.trim(),
		};
		const controller = new AbortController();
		invoiceRequest = controller;
		axios
			.post<PostPlaceCommentResponse>(`${API_BASE}/v4/place-comments`, args, {
				signal: controller.signal,
				timeout: 30000,
			})
			.then((response) => {
				invoice = response.data.invoice;
				invoiceId = response.data.invoice_id;
				stage = 1;
				loading = false;
			})
			.catch((error) => {
				if (axios.isCancel(error)) return;
				errToast($_("errors.invoiceGenerate"));
				console.error(error);
				loading = false;
			})
			.finally(() => {
				if (invoiceRequest === controller) invoiceRequest = null;
			});
	},
}));

// Capture phase + stopPropagation: the map drawers close themselves on a
// bubbling window Escape, which would take the drawer down with this modal.
// Escape closes the form and the thank-you, but not the invoice step: a paid
// invoice is not lost to a stray key (the Close button is still there).
// Like Close, it works while the invoice is being requested: closing aborts it.
const handleKeydown = (event: KeyboardEvent) => {
	if (!open) return;
	if (event.key === "Escape") {
		event.stopPropagation();
		event.preventDefault();
		if (stage !== 1) closeModal();
	} else if (event.key === "Tab" && rootEl) {
		trapTab(event, rootEl);
	}
};

// Render at the end of <body>: the map drawers are position-fixed with their
// own stacking context, which would trap this overlay inside them.
const portal = (node: HTMLElement) => {
	document.body.appendChild(node);
	return { destroy: () => node.remove() };
};

// Move focus into the dialog when the form opens (aria-modal alone doesn't:
// it would stay on the trigger behind the backdrop). Desktop lands in the
// comment field; on a touch device that would pop the on-screen keyboard at
// once and cover the note about the fee and anonymity before it is read (same
// rule as AddLocationForm), so focus goes to the dialog itself there.
$effect(() => {
	if (open && stage === 0) {
		const fine = window.matchMedia("(pointer: fine)").matches;
		tick().then(() => (fine ? commentInput : rootEl)?.focus());
	}
});

const handleOutClick = () => {
	// Never close the modal on outside clicks to prevent accidental loss of progress
};
const generateInvoice = (event: SubmitEvent) => {
	event.preventDefault();
	validation.submit(form);
};

const handlePaymentSuccess = async () => {
	// The API publishes the comment while answering the status poll that
	// reported the payment, so it is live now
	stage = 2;
	trackEvent("comment_add_success", { source });

	// Update the place in localforage and store immediately, then let the host
	// refresh its own view (after, so it reads the updated place)
	if (elementId) {
		await updateSinglePlace(elementId);
	}
	onSuccess();
};

const handlePaymentError = (error: unknown) => {
	console.error("Payment error:", error);
};

const handleStatusCheckError = (error: unknown) => {
	console.error("Status check error:", error);
};
</script>

{#if open}
	<div use:portal>
	<!-- Blocks the page behind: the host (e.g. the map drawer) must not switch
	     to another place while this form is bound to one. Like the modal
	     itself it never closes on an outside click. -->
	<div transition:fade={{ duration: 200 }} class="fixed inset-0 z-[1999] bg-black/40 dark:bg-black/60" aria-hidden="true"></div>
	<OutClick excludeQuerySelectorAll="#boost-button" onOutClick={handleOutClick}>
		<div
			bind:this={rootEl}
			tabindex="-1"
			role="dialog"
			aria-modal="true"
			aria-label={$_("commentAdd.title")}
			transition:fly={{ y: 200, duration: 300 }}
			class="fixed inset-x-4 outline-none bottom-[max(1rem,env(safe-area-inset-bottom))] z-[2000] max-h-[85dvh] overflow-auto rounded-xl border border-gray-300 bg-white p-6 text-left shadow-2xl md:inset-auto md:top-1/2 md:left-1/2 md:max-h-[90dvh] md:w-[430px] md:-translate-x-1/2 md:-translate-y-1/2 dark:border-white/95 dark:bg-dark"
		>
			<CloseButton
				position="flex justify-end"
				on:click={closeModal}
				colors="text-primary dark:text-white dark:hover:text-white/80 hover:text-link"
			/>

			{#if stage === 0}
				<!-- `novalidate` like the other forms (#1404): errors are shown
				     inline, never as browser bubbles. -->
				<form
					class="space-y-4 text-primary dark:text-white"
					onsubmit={generateInvoice}
					novalidate
				>
					<legend>
						<p class="mb-2 text-xl font-bold text-primary dark:text-white">{$_("commentAdd.title")}</p>

						<p class="text-sm text-body dark:text-white">
							{$_("commentAdd.anonymousNote")}
						</p>
						<p class="text-sm text-body dark:text-white">{$_("commentAdd.currentFee")}</p>
					</legend>

					<form.Field name="comment">
						{#snippet children(field)}
							<TextArea
								id="comment"
								name="comment"
								label={$_("commentAdd.yourComment")}
								required
								error={fieldError(field) && $_("commentAdd.pleaseEnterComment")}
								{...inputProps(field)}
								bind:element={commentInput}
							/>
						{/snippet}
					</form.Field>

					<PrimaryButton style="w-full rounded-xl p-3" disabled={loading} type="submit" {loading}>
						{$_("commentAdd.submitButton")}
					</PrimaryButton>
				</form>
			{:else if stage === 1}
				<InvoicePaymentStage
					{invoice}
					{invoiceId}
					onSuccess={handlePaymentSuccess}
					onError={handlePaymentError}
					onStatusCheckError={handleStatusCheckError}
				>
					<p class="rounded-md border p-1 text-sm text-body dark:text-white">
						<Icon w="16" h="16" icon="info" class="inline-block" />
						{$_("commentAdd.publishNote")}
					</p>

					<PrimaryButton style="w-full rounded-xl p-3" on:click={closeModal}>{$_("commentAdd.close")}</PrimaryButton>
				</InvoicePaymentStage>
			{:else}
				<div class="space-y-4 text-center">
					<p class="text-xl font-bold text-primary dark:text-white">{$_("commentAdd.thankYou")}</p>

					<p class="text-body dark:text-white">{$_("commentAdd.published")}</p>

					<PrimaryButton style="w-full rounded-xl p-3" on:click={closeModal}>{$_("commentAdd.close")}</PrimaryButton>
				</div>
			{/if}
		</div>
	</OutClick>
	</div>
{/if}

<svelte:window onkeydowncapture={handleKeydown} />
