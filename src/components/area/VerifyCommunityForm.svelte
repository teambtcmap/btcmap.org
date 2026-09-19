<script lang="ts">
import axios from "axios";
import { onMount } from "svelte";
import { _ } from "svelte-i18n";

import FormSuccess from "$components/FormSuccess.svelte";
import CaptchaField from "$components/form/CaptchaField.svelte";
import FieldError from "$components/form/FieldError.svelte";
import TextArea from "$components/form/TextArea.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import { focusInvalid, recheckFlagged } from "$lib/formValidation";
import { errToast } from "$lib/utils";
import type {
	VerifyErrors,
	VerifyField,
	VerifyInput,
} from "$lib/verifyValidation";
import {
	firstInvalidVerifyField,
	validateVerification,
} from "$lib/verifyValidation";

import { browser } from "$app/environment";

type Props = {
	communityName: string;
	communityAlias: string;
};
let { communityName, communityAlias }: Props = $props();

let captchaSecret = $state<string>();
let captchaInput = $state<HTMLInputElement>();
let honeyInput = $state<HTMLInputElement>();

let captchaContent = $state("");
let isCaptchaLoading = $state(true);

const fetchCaptcha = () => {
	isCaptchaLoading = true;
	axios
		.get("/captcha")
		.then((response) => {
			captchaSecret = response.data.captchaSecret;
			captchaContent = response.data.captcha;
		})
		.catch((error) => {
			errToast($_(`errors.captchaFetch`));
			console.error(error);
		})
		.finally(() => {
			isCaptchaLoading = false;
		});
};

let accurate = $state(false);
let accurateBox = $state<HTMLInputElement>();
let updates = $state("");
let verify = $state<HTMLTextAreaElement>();

// The report's inline errors (#1408), with /verify-location's rules
// (#1407): set by a rejected submit, one entry per invalid field. The
// form runs `novalidate`, so these are the only validation UI.
let errors = $state<VerifyErrors>({});

const readInput = (): VerifyInput => ({
	accurate,
	changes: updates,
	method: verify?.value ?? "",
	captcha: captchaInput?.value ?? "",
});

// Wired to every validated field: a no-op until a submit has flagged
// something.
const recheck = () => {
	if (!firstInvalidVerifyField(errors)) return;
	errors = recheckFlagged(errors, validateVerification(readInput()));
};

// The box-or-changes rule lands on the box, the first of its controls.
const invalidControl: Record<VerifyField, () => HTMLElement | undefined> = {
	confirmation: () => accurateBox,
	method: () => verify,
	captcha: () => captchaInput,
};

let submitted = $state(false);
let submitting = $state(false);
let submissionIssueNumber = $state<number>();

const submitForm = (event: SubmitEvent) => {
	event.preventDefault();
	// Every invalid field is marked at once; the first takes focus.
	errors = validateVerification(readInput());
	const first = firstInvalidVerifyField(errors);
	if (first) {
		focusInvalid(invalidControl[first]());
		return;
	}
	submitting = true;

	const communityUrl = `${window.location.origin}/community/${encodeURIComponent(communityAlias)}/merchants`;

	axios
		.post("/api/gitea/issue", {
			type: "verify-community",
			captchaSecret,
			captchaTest: captchaInput?.value,
			honey: honeyInput?.value,
			name: communityName,
			communityUrl: communityUrl,
			accurate: accurate ? "Yes" : "No",
			updates: updates ? updates : "",
			verified: verify?.value,
		})
		.then((response) => {
			submissionIssueNumber = response.data.number;
			submitted = true;
		})
		.catch((error) => {
			if (error.response?.data?.message?.includes("Captcha")) {
				errToast(error.response.data.message);
			} else {
				errToast($_(`errors.formSubmission`));
			}

			console.error(error);
			submitting = false;
		});
};

function resetForm() {
	errors = {};
	submitted = false;
	submitting = false;
	accurate = false;
	updates = "";
	if (verify) verify.value = "";
	if (captchaInput) captchaInput.value = "";
	fetchCaptcha();
}

onMount(async () => {
	if (browser) {
		fetchCaptcha();
	}
});
</script>

{#if !submitted}
	<section class="mx-auto w-full max-w-2xl space-y-5 text-left">
		<div class="space-y-2 text-center">
			<h3 class="text-2xl font-semibold text-primary dark:text-white">
				{$_(`verifyCommunity.title`)}
			</h3>
			<p class="text-sm text-primary dark:text-white">
				{$_(`verifyCommunity.description`)}
			</p>
		</div>

		<!-- `novalidate`: the form reports its own errors inline (#1408)
		     instead of the browser's bubbles. -->
		<form onsubmit={submitForm} novalidate class="w-full space-y-5 text-primary dark:text-white">
			<div>
				<input
					disabled
					value={communityName}
					readonly
					type="text"
					name="name"
					placeholder={$_(`verifyCommunity.communityName`)}
					class="w-full rounded-2xl border-2 border-input p-3 text-center font-semibold focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
				/>
			</div>

			<!-- One of the two is required: the box, or the updates below it.
			     The rule's message sits under the box's label and describes
			     both controls. -->
			<div>
				<div class="flex items-center space-x-2">
					<label for="accurate" class="{!updates ? 'cursor-pointer' : ''} font-semibold"
						>{$_(`verifyCommunity.accurateLabel`)}</label
					>
					<input
						class="h-4 w-4 accent-link"
						disabled={Boolean(updates)}
						required={!updates}
						type="checkbox"
						id="accurate"
						name="accurate"
						aria-invalid={errors.confirmation ? 'true' : undefined}
						aria-describedby={errors.confirmation ? 'confirmation-error' : undefined}
						onchange={recheck}
						bind:checked={accurate}
						bind:this={accurateBox}
					/>
				</div>
				{#if errors.confirmation}
					<FieldError
						id="confirmation-error"
						message={$_(`verifyCommunity.confirmationRequired`)}
						class="mt-1"
					/>
				{/if}
				<p class="text-sm dark:text-white/70">
					{$_(`verifyCommunity.accurateHint`)}
				</p>
			</div>

			<TextArea
				id="updates"
				name="updates"
				label={$_(`verifyCommunity.updatesLabel`)}
				labelNote={$_(`verifyCommunity.ifApplicable`)}
				disabled={accurate}
				required={!accurate}
				placeholder={$_(`verifyCommunity.updatesPlaceholder`)}
				aria-invalid={errors.confirmation ? 'true' : undefined}
				aria-describedby={errors.confirmation ? 'confirmation-error' : undefined}
				oninput={recheck}
				bind:value={updates}
			/>

			<TextArea
				id="verify"
				name="verify"
				label={$_(`verifyCommunity.verifyLabel`)}
				required
				placeholder={$_(`verifyCommunity.verifyPlaceholder`)}
				error={errors.method && $_(`verifyCommunity.methodRequired`)}
				oninput={recheck}
				bind:element={verify}
			/>

			<CaptchaField
				content={captchaContent}
				loading={isCaptchaLoading}
				onrefresh={fetchCaptcha}
				disabled={!captchaSecret}
				invalid={!!errors.captcha}
				oninput={recheck}
				bind:element={captchaInput}
			/>

			<input
				type="text"
				name="honey"
				placeholder="A nice pot of honey."
				class="hidden"
				bind:this={honeyInput}
			/>

			<PrimaryButton
				loading={submitting}
				disabled={submitting || !captchaSecret}
				style="w-full py-3 rounded-xl"
			>
				{$_(`verifyCommunity.submitReport`)}
			</PrimaryButton>
		</form>
	</section>
{:else}
	<FormSuccess
		type={$_(`verifyCommunity.successType`)}
		text={$_(`verifyCommunity.successMessage`)}
		issue={submissionIssueNumber}
		on:click={resetForm}
	/>
{/if}
