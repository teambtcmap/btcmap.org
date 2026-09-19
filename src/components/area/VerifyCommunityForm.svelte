<script lang="ts">
import { createForm } from "@tanstack/svelte-form";
import axios from "axios";
import { onMount } from "svelte";
import { _ } from "svelte-i18n";

import FormSuccess from "$components/FormSuccess.svelte";
import CaptchaField from "$components/form/CaptchaField.svelte";
import FieldError from "$components/form/FieldError.svelte";
import TextArea from "$components/form/TextArea.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import { fieldError, inputProps, ruleValidation } from "$lib/ruleValidation";
import { errToast } from "$lib/utils";
import type { VerifyInput } from "$lib/verifyValidation";
import { validateVerification } from "$lib/verifyValidation";

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

let accurateBox = $state<HTMLInputElement>();
let methodInput = $state<HTMLTextAreaElement>();

let submitted = $state(false);
let submitting = $state(false);
let submissionIssueNumber = $state<number>();

// The report on TanStack Form (#1406) with /verify-location's rules
// (#1407): `novalidate`, every failed field marked inline on submit, the
// first focused. The box-or-updates rule rides on the box's field; the
// updates field shows it too.
const validation = ruleValidation({
	order: ["accurate", "method", "captcha"],
	validate: (value: VerifyInput) => {
		const { confirmation, ...others } = validateVerification(value);
		return confirmation ? { ...others, accurate: confirmation } : others;
	},
	controls: {
		accurate: () => accurateBox,
		method: () => methodInput,
		captcha: () => captchaInput,
	},
});

const form = createForm(() => ({
	defaultValues: {
		accurate: false,
		changes: "",
		method: "",
		captcha: "",
	} as VerifyInput,
	...validation.options,
	onSubmit: ({ value }) => {
		submitting = true;

		const communityUrl = `${window.location.origin}/community/${encodeURIComponent(communityAlias)}/merchants`;

		axios
			.post("/api/gitea/issue", {
				type: "verify-community",
				captchaSecret,
				captchaTest: value.captcha,
				honey: honeyInput?.value,
				name: communityName,
				communityUrl: communityUrl,
				accurate: value.accurate ? "Yes" : "No",
				updates: value.changes,
				verified: value.method,
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
	},
}));
const values = form.useSelector((state) => state.values);

const submitForm = (event: SubmitEvent) => {
	event.preventDefault();
	validation.submit(form);
};

function resetForm() {
	form.reset();
	validation.reset();
	submitted = false;
	submitting = false;
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
			<form.Field name="accurate">
				{#snippet children(field)}
					{@const confirmation = fieldError(field)}
					<div>
						<div class="flex items-center space-x-2">
							<label
								for="accurate"
								class="{!values.current.changes ? 'cursor-pointer' : ''} font-semibold"
								>{$_(`verifyCommunity.accurateLabel`)}</label
							>
							<input
								class="h-4 w-4 accent-link"
								disabled={Boolean(values.current.changes)}
								required={!values.current.changes}
								type="checkbox"
								id="accurate"
								name="accurate"
								aria-invalid={confirmation ? 'true' : undefined}
								aria-describedby={confirmation ? 'confirmation-error' : undefined}
								checked={field.state.value}
								onchange={(e) => field.handleChange(e.currentTarget.checked)}
								bind:this={accurateBox}
							/>
						</div>
						{#if confirmation}
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

					<form.Field name="changes">
						{#snippet children(changes)}
							<TextArea
								id="updates"
								name="updates"
								label={$_(`verifyCommunity.updatesLabel`)}
								labelNote={$_(`verifyCommunity.ifApplicable`)}
								disabled={field.state.value}
								required={!field.state.value}
								placeholder={$_(`verifyCommunity.updatesPlaceholder`)}
								aria-invalid={confirmation ? 'true' : undefined}
								aria-describedby={confirmation ? 'confirmation-error' : undefined}
								{...inputProps(changes)}
							/>
						{/snippet}
					</form.Field>
				{/snippet}
			</form.Field>

			<form.Field name="method">
				{#snippet children(field)}
					<TextArea
						id="verify"
						name="verify"
						label={$_(`verifyCommunity.verifyLabel`)}
						required
						placeholder={$_(`verifyCommunity.verifyPlaceholder`)}
						error={fieldError(field) && $_(`verifyCommunity.methodRequired`)}
						{...inputProps(field)}
						bind:element={methodInput}
					/>
				{/snippet}
			</form.Field>

			<form.Field name="captcha">
				{#snippet children(field)}
					<CaptchaField
						content={captchaContent}
						loading={isCaptchaLoading}
						onrefresh={fetchCaptcha}
						disabled={!captchaSecret}
						invalid={!!fieldError(field)}
						{...inputProps(field)}
						bind:element={captchaInput}
					/>
				{/snippet}
			</form.Field>

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
