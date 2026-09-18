<script lang="ts">
import axios from "axios";
import DOMPurify from "dompurify";
import { onMount } from "svelte";
import { get } from "svelte/store";

import FormHelperText from "$components/FormHelperText.svelte";
import FormSuccess from "$components/FormSuccess.svelte";
import Icon from "$components/Icon.svelte";
import HeaderPlaceholder from "$components/layout/HeaderPlaceholder.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import TextLink from "$components/TextLink.svelte";
import { _ } from "$lib/i18n";
import { placesError } from "$lib/store";
import { theme } from "$lib/theme";
import { errToast } from "$lib/utils";

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
			captchaContent = DOMPurify.sanitize(response.data.captcha);
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
let outdated = $state("");
let verify = $state<HTMLTextAreaElement>();

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
		<form onsubmit={submitForm} class="w-full space-y-5 text-primary dark:text-white">
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
						bind:checked={current}
					/>
				</div>
				<p class="text-sm">{$_('verifyLocation.currentInfoDescription')}</p>
			</div>

			<div>
				<label for="outdated" class="mb-2 block font-semibold"
					>{$_('verifyLocation.outdatedLabel')} <span class="font-normal">({$_('verifyLocation.ifApplicable')})</span></label
				>
				<textarea
					disabled={!captchaSecret || !data || current}
					required={!current}
					name="outdated"
					placeholder={$_('verifyLocation.outdatedPlaceholder')}
					rows="3"
					class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
					bind:value={outdated}
				></textarea>
			</div>

			<div>
				<label for="verify" class="mb-2 block font-semibold">{$_('verifyLocation.verifyLabel')}</label>
				<textarea
					disabled={!captchaSecret || !data}
					required
					name="verify"
					placeholder={$_('verifyLocation.verifyPlaceholder')}
					rows="3"
					class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
					bind:this={verify}
				></textarea>
			</div>

			<div>
				<div class="mb-2 flex items-center space-x-2">
					<label for="captcha" class="font-semibold"
						>{$_('forms.captcha')} <span class="font-normal">({$_('forms.captchaCaseSensitive')})</span></label
					>
					{#if captchaSecret}
						<button type="button" onclick={fetchCaptcha}>
							<Icon type="fa" icon="arrows-rotate" w="16" h="16" />
						</button>
					{/if}
				</div>
				<div class="space-y-2">
					<div class="flex items-center justify-center rounded-2xl border-2 border-input py-1">
						{#if isCaptchaLoading}
							<div class="h-[100px] w-[275px] animate-pulse bg-link/50"></div>
						{:else}
							{@html captchaContent}
						{/if}
					</div>
					<input
						disabled={!captchaSecret || !data}
						required
						type="text"
						name="captcha"
						placeholder={$_('forms.captchaPlaceholder')}
						class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
						bind:this={captchaInput}
					/>
				</div>
			</div>

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
