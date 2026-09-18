<script lang="ts">
import axios from "axios";
import { onMount } from "svelte";
import { get } from "svelte/store";

import FormHelperText from "$components/FormHelperText.svelte";
import FormSuccess from "$components/FormSuccess.svelte";
import CaptchaField from "$components/form/CaptchaField.svelte";
import FieldError from "$components/form/FieldError.svelte";
import TextArea from "$components/form/TextArea.svelte";
import HeaderPlaceholder from "$components/layout/HeaderPlaceholder.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import TextLink from "$components/TextLink.svelte";
import { focusInvalid, recheckFlagged } from "$lib/formValidation";
import { _ } from "$lib/i18n";
import { placesError } from "$lib/store";
import { theme } from "$lib/theme";
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

import type { PageProps } from "./$types";
import { browser } from "$app/environment";

let { data }: PageProps = $props();

// From the server load
const name = $derived(data?.name || "");
const lat = $derived(data?.lat);
const long = $derived(data?.long);
const location = $derived(data?.location || "");
const edit = $derived(data?.edit || "");

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
			// handle success
			captchaSecret = response.data.captchaSecret;
			captchaContent = response.data.captcha;
		})
		.catch((error) => {
			errToast(get(_)("errors.captchaFetch"));
			console.error(error);
		})
		.finally(() => {
			isCaptchaLoading = false;
		});
};

let current = $state(false);
let currentBox = $state<HTMLInputElement>();
let outdated = $state("");
let verify = $state<HTMLTextAreaElement>();

// The report's inline errors (#1407): set by a rejected submit, one entry
// per invalid field. The form runs `novalidate`, so these are the only
// validation UI — no browser bubbles.
let errors = $state<VerifyErrors>({});

const readInput = (): VerifyInput => ({
	accurate: current,
	changes: outdated,
	method: verify?.value ?? "",
	captcha: captchaInput?.value ?? "",
});

// Wired to every validated field: a no-op until a submit has flagged
// something.
const recheck = () => {
	if (!firstInvalidVerifyField(errors)) return;
	errors = recheckFlagged(errors, validateVerification(readInput()));
};

// The control that takes focus for each invalid field. The box-or-changes
// rule lands on the box, the first of its two controls.
const invalidControl: Record<VerifyField, () => HTMLElement | undefined> = {
	confirmation: () => currentBox,
	method: () => verify,
	captcha: () => captchaInput,
};

const selected = $derived(!!data); // Set to true if we have server data
let submitted = $state(false);
let submitting = $state(false);
let submissionIssueNumber = $state<number>();
const merchantId = $derived(data?.merchantId || "");

const submitForm = (event: SubmitEvent) => {
	event.preventDefault();
	if (!selected) {
		errToast(get(_)("errors.noLocationSelected"));
	} else {
		// Every invalid field is marked at once; the first takes focus.
		errors = validateVerification(readInput());
		const first = firstInvalidVerifyField(errors);
		if (first) {
			focusInvalid(invalidControl[first]());
			return;
		}
		submitting = true;

		axios
			.post("/api/gitea/issue", {
				type: "verify-location",
				captchaSecret,
				captchaTest: captchaInput?.value,
				honey: honeyInput?.value,
				name: name,
				location: location,
				edit: edit,
				current: current ? "Yes" : "No",
				outdated: outdated ? outdated : "",
				verified: verify?.value,
				merchantId: merchantId,
				lat: lat,
				long: long,
			})
			.then((response) => {
				submissionIssueNumber = response.data.number;
				submitted = true;
			})
			.catch((error) => {
				if (error.response.data.message.includes("Captcha")) {
					errToast(error.response.data.message);
				} else {
					errToast(get(_)("errors.formSubmission"));
				}

				console.error(error);
				submitting = false;
			});
	}
};

function resetForm() {
	window.history.back();
}

// alert for map errors
$effect(() => {
	if ($placesError) errToast($placesError);
});

onMount(async () => {
	if (browser) {
		// fetch and add captcha
		fetchCaptcha();
	}
});
</script>

<svelte:head>
	<title>BTC Map - {$_('verifyLocation.title')}</title>
	<meta property="og:image" content="https://btcmap.org/images/og/verify.png" />
	<meta name="twitter:title" content="BTC Map - {$_('verifyLocation.title')}" />
	<meta name="twitter:image" content="https://btcmap.org/images/og/verify.png" />
</svelte:head>

{#if !submitted}
	{#if typeof window !== 'undefined'}
		<h1
			class="{$theme === 'dark'
				? 'text-white'
				: 'gradient'} mt-10 text-center text-4xl font-semibold md:text-5xl"
		>
			{$_('verifyLocation.title')}
		</h1>
	{:else}
		<HeaderPlaceholder />
	{/if}

	<section id="verify" class="mx-auto mt-16 w-full pb-20 md:w-[600px] md:pb-32">
		<h2 class="mb-5 text-center text-3xl font-semibold text-primary dark:text-white">
			{$_('verifyLocation.subheading')}<br />
			<span class="text-base font-normal"
				>{$_('verifyLocation.note')}</span
			>
		</h2>

		<div class="mb-10 w-full text-center text-primary dark:text-white">
			<p>
				{$_('verifyLocation.descriptionPart1')} 
				<TextLink link="https://www.openstreetmap.org" external>
					{$_('verifyLocation.osmLinkText')}
				</TextLink>
				{$_('verifyLocation.descriptionPart2')}
				<TextLink link="https://wiki.btcmap.org/Tagging-Merchants#shadowy-supertaggers" external>
					{$_('verifyLocation.wikiLinkText')}
				</TextLink>
				{$_('verifyLocation.descriptionPart3')}
			</p>
			
			<FormHelperText text={$_('verifyLocation.tooltip')} />
		</div>
		<!-- `novalidate`: the form reports its own errors inline (#1407)
		     instead of the browser's bubbles. -->
		<form onsubmit={submitForm} novalidate class="w-full space-y-5 text-primary dark:text-white">
			<div>
				<input
					disabled
					value={name}
					readonly
					type="text"
					name="name"
					placeholder={!data ? $_('verifyLocation.loadingPlaceholder') : $_('verifyLocation.merchantNamePlaceholder')}
					class="w-full rounded-2xl border-2 border-input p-3 text-center font-semibold focus:outline-link"
				/>
			</div>

			<!-- One of the two is required: the box, or the changes below it.
			     The rule's message sits under the box's label and describes
			     both controls, like the payment group on add-location
			     (#1397). -->
			<div>
				<div class="flex items-center space-x-2">
					<label for="current" class="{!outdated ? 'cursor-pointer' : ''} font-semibold"
						>{$_('verifyLocation.currentInfoLabel')}</label
					>
					<input
						class="h-4 w-4 accent-link"
						disabled={!captchaSecret || !data || Boolean(outdated)}
						required={!outdated}
						type="checkbox"
						id="current"
						name="current"
						aria-invalid={errors.confirmation ? 'true' : undefined}
						aria-describedby={errors.confirmation ? 'confirmation-error' : undefined}
						onchange={recheck}
						bind:checked={current}
						bind:this={currentBox}
					/>
				</div>
				{#if errors.confirmation}
					<FieldError
						id="confirmation-error"
						message={$_('verifyLocation.confirmationRequired')}
						class="mt-1"
					/>
				{/if}
				<p class="text-sm">{$_('verifyLocation.currentInfoDescription')}</p>
			</div>

			<TextArea
				id="outdated"
				name="outdated"
				label={$_('verifyLocation.outdatedLabel')}
				labelNote={$_('verifyLocation.ifApplicable')}
				disabled={!captchaSecret || !data || current}
				required={!current}
				placeholder={$_('verifyLocation.outdatedPlaceholder')}
				aria-invalid={errors.confirmation ? 'true' : undefined}
				aria-describedby={errors.confirmation ? 'confirmation-error' : undefined}
				oninput={recheck}
				bind:value={outdated}
			/>

			<TextArea
				id="verify"
				name="verify"
				label={$_('verifyLocation.verifyLabel')}
				disabled={!captchaSecret || !data}
				required
				placeholder={$_('verifyLocation.verifyPlaceholder')}
				error={errors.method && $_('verifyLocation.methodRequired')}
				oninput={recheck}
				bind:element={verify}
			/>

			<CaptchaField
				content={captchaContent}
				loading={isCaptchaLoading}
				onrefresh={fetchCaptcha}
				disabled={!captchaSecret || !data}
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
				disabled={submitting || !captchaSecret || !data}
				style="w-full py-3 rounded-xl"
			>
				{$_('verifyLocation.submitReport')}
			</PrimaryButton>
		</form>
	</section>
{:else}
	<FormSuccess
		type={$_('verifyLocation.successType')}
		text={$_('verifyLocation.successMessage')}
		issue={submissionIssueNumber}
		on:click={resetForm}
	/>
{/if}
