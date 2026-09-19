<script lang="ts">
import { createForm } from "@tanstack/svelte-form";
import axios from "axios";
import { fly } from "svelte/transition";
import { OutClick } from "svelte-outclick";

import CloseButton from "$components/CloseButton.svelte";
import TextArea from "$components/form/TextArea.svelte";
import Icon from "$components/Icon.svelte";
import InvoicePaymentStage from "$components/InvoicePaymentStage.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import { API_BASE } from "$lib/api-base";
import { _ } from "$lib/i18n";
import { fieldError, inputProps, ruleValidation } from "$lib/ruleValidation";
import { updateSinglePlace } from "$lib/sync/places";
import type { MerchantPageData } from "$lib/types.js";
import { errToast } from "$lib/utils";

import { invalidateAll } from "$app/navigation";

type Props = {
	open?: boolean;
	onOpenChange?: (value: boolean) => void;
	elementId: MerchantPageData["id"] | undefined;
};
let { open = false, onOpenChange = () => {}, elementId }: Props = $props();

let stage = $state(0);
let commentInput = $state<HTMLTextAreaElement>();
let invoice = $state("");
let invoiceId = $state("");
let loading = $state(false);
let commentComplete = $state(false);
const closeModal = () => {
	if (commentComplete) {
		invalidateAll();
	}
	onOpenChange(false);
	// The draft stays for the next open; its error doesn't.
	form.reset(form.state.values);
	validation.reset();
	stage = 0;
	invoice = "";
	invoiceId = "";
	loading = false;
	commentComplete = false;
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
		axios
			.post(`${API_BASE}/v4/place-comments`, {
				place_id: elementId,
				comment: value.comment.trim(),
			})
			.then((response) => {
				invoice = response.data.invoice;
				invoiceId = response.data.invoice_id;
				stage = 1;
				loading = false;
			})
			.catch((error) => {
				errToast($_("errors.invoiceGenerate"));
				console.error(error);
				loading = false;
			});
	},
}));

const handleOutClick = () => {
	// Never close the modal on outside clicks to prevent accidental loss of progress
};
const generateInvoice = (event: SubmitEvent) => {
	event.preventDefault();
	validation.submit(form);
};

const handlePaymentSuccess = async () => {
	// Comment will be published automatically by the backend
	stage = 2;
	commentComplete = true;

	// Update the place in localforage and store immediately
	if (elementId) {
		await updateSinglePlace(elementId);
	}
};

const handlePaymentError = (error: unknown) => {
	console.error("Payment error:", error);
};

const handleStatusCheckError = (error: unknown) => {
	console.error("Status check error:", error);
};
</script>

{#if open}
	<OutClick excludeQuerySelectorAll="#boost-button" onOutClick={handleOutClick}>
		<div
			transition:fly={{ y: 200, duration: 300 }}
			class="center-fixed z-[2000] max-h-[90dvh] w-[90vw] overflow-auto rounded-xl border border-gray-300 bg-white p-6 text-left shadow-2xl md:w-[430px] dark:border-white/95 dark:bg-dark"
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
{/if}
