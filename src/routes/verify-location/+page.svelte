<script lang="ts">
import { createForm } from "@tanstack/svelte-form";
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
import { _ } from "$lib/i18n";
import { fieldError, inputProps, ruleValidation } from "$lib/ruleValidation";
import { placesError } from "$lib/store";
import { theme } from "$lib/theme";
import { errToast } from "$lib/utils";
import type { VerifyInput } from "$lib/verifyValidation";
import { validateVerification } from "$lib/verifyValidation";

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

let currentBox = $state<HTMLInputElement>();
let methodInput = $state<HTMLTextAreaElement>();

const selected = $derived(!!data); // Set to true if we have server data
let submitted = $state(false);
let submitting = $state(false);
let submissionIssueNumber = $state<number>();
const merchantId = $derived(data?.merchantId || "");

// The report on TanStack Form (#1406) with the shared verification rules
// (#1407): `novalidate`, every failed field marked inline on submit, the
// first focused. The box-or-changes rule rides on the box's field (its
// first control); the changes field shows it too.
const validation = ruleValidation({
	order: ["accurate", "method", "captcha"],
	validate: (value: VerifyInput) => {
		const { confirmation, ...others } = validateVerification(value);
		return confirmation ? { ...others, accurate: confirmation } : others;
	},
	controls: {
		accurate: () => currentBox,
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
		axios
			.post("/api/gitea/issue", {
				type: "verify-location",
				captchaSecret,
				captchaTest: value.captcha,
				honey: honeyInput?.value,
				name: name,
				location: location,
				edit: edit,
				current: value.accurate ? "Yes" : "No",
				outdated: value.changes,
				verified: value.method,
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
	},
}));
const values = form.useSelector((state) => state.values);

const submitForm = (event: SubmitEvent) => {
	event.preventDefault();
	if (!selected) {
		errToast(get(_)("errors.noLocationSelected"));
		return;
	}
	validation.submit(form);
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
			<form.Field name="accurate">
				{#snippet children(field)}
					{@const confirmation = fieldError(field)}
					<div>
						<div class="flex items-center space-x-2">
							<label
								for="current"
								class="{!values.current.changes ? 'cursor-pointer' : ''} font-semibold"
								>{$_('verifyLocation.currentInfoLabel')}</label
							>
							<input
								class="h-4 w-4 accent-link"
								disabled={!captchaSecret || !data || Boolean(values.current.changes)}
								required={!values.current.changes}
								type="checkbox"
								id="current"
								name="current"
								aria-invalid={confirmation ? 'true' : undefined}
								aria-describedby={confirmation ? 'confirmation-error' : undefined}
								checked={field.state.value}
								onchange={(e) => field.handleChange(e.currentTarget.checked)}
								bind:this={currentBox}
							/>
						</div>
						{#if confirmation}
							<FieldError
								id="confirmation-error"
								message={$_('verifyLocation.confirmationRequired')}
								class="mt-1"
							/>
						{/if}
						<p class="text-sm">{$_('verifyLocation.currentInfoDescription')}</p>
					</div>

					<form.Field name="changes">
						{#snippet children(changes)}
							<TextArea
								id="outdated"
								name="outdated"
								label={$_('verifyLocation.outdatedLabel')}
								labelNote={$_('verifyLocation.ifApplicable')}
								disabled={!captchaSecret || !data || field.state.value}
								required={!field.state.value}
								placeholder={$_('verifyLocation.outdatedPlaceholder')}
								aria-invalid={confirmation ? 'true' : undefined}
								aria-describedby={confirmation ? 'confirmation-error' : undefined}
								{...inputProps(changes)}
							/>
						{/snippet}
					</form.Field>
				{/snippet}
			</form.Field>

			<!-- Not id="verify": the page's <section id="verify"> comes first,
			     and the label would name the section instead. -->
			<form.Field name="method">
				{#snippet children(field)}
					<TextArea
						id="verify-method"
						name="verify"
						label={$_('verifyLocation.verifyLabel')}
						disabled={!captchaSecret || !data}
						required
						placeholder={$_('verifyLocation.verifyPlaceholder')}
						error={fieldError(field) && $_('verifyLocation.methodRequired')}
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
						disabled={!captchaSecret || !data}
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
