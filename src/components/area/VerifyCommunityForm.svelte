<script lang="ts">
import axios from "axios";
import DOMPurify from "dompurify";
import { onMount } from "svelte";

import FormSuccess from "$components/FormSuccess.svelte";
import Icon from "$components/Icon.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import { errToast } from "$lib/utils";

import { browser } from "$app/environment";

export let communityName: string;
export let communityAlias: string;

let captcha: HTMLDivElement;
let captchaSecret: string;
let captchaInput: HTMLInputElement;
let honeyInput: HTMLInputElement;

let captchaContent = "";
let isCaptchaLoading = true;

const fetchCaptcha = () => {
	isCaptchaLoading = true;
	axios
		.get("/captcha")
		.then((response) => {
			captchaSecret = response.data.captchaSecret;
			captchaContent = DOMPurify.sanitize(response.data.captcha);
		})
		.catch((error) => {
			errToast("Could not fetch captcha, please try again or contact BTC Map.");
			console.error(error);
		})
		.finally(() => {
			isCaptchaLoading = false;
		});
};

let accurate: boolean = false;
let updates: string = "";
let verify: HTMLTextAreaElement;

let submitted = false;
let submitting = false;
let submissionIssueNumber: number;

const submitForm = (event: SubmitEvent) => {
	event.preventDefault();
	submitting = true;

	const communityUrl = `${window.location.origin}/community/${communityAlias}/merchants`;

	axios
		.post("/api/gitea/issue", {
			type: "verify-community",
			captchaSecret,
			captchaTest: captchaInput.value,
			honey: honeyInput.value,
			name: communityName,
			communityUrl: communityUrl,
			accurate: accurate ? "Yes" : "No",
			updates: updates ? updates : "",
			verified: verify.value,
		})
		.then((response) => {
			submissionIssueNumber = response.data.number;
			submitted = true;
		})
		.catch((error) => {
			if (error.response?.data?.message?.includes("Captcha")) {
				errToast(error.response.data.message);
			} else {
				errToast(
					"Form submission failed, please try again or contact BTC Map.",
				);
			}

			console.error(error);
			submitting = false;
		});
};

function resetForm() {
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
				Verify Community Information
			</h3>
			<p class="text-sm text-primary dark:text-white">
				Help us keep community data accurate by verifying the information below.
			</p>
		</div>

		<form on:submit={submitForm} class="w-full space-y-5 text-primary dark:text-white">
			<div>
				<input
					disabled
					value={communityName}
					readonly
					type="text"
					name="name"
					placeholder="Community Name"
					class="w-full rounded-2xl border-2 border-input p-3 text-center font-semibold focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
				/>
			</div>

			<div>
				<div class="flex items-center space-x-2">
					<label for="accurate" class="{!updates ? 'cursor-pointer' : ''} font-semibold"
						>Current information is accurate</label
					>
					<input
						class="h-4 w-4 accent-link"
						disabled={Boolean(updates)}
						required={!updates}
						type="checkbox"
						id="accurate"
						name="accurate"
						bind:checked={accurate}
					/>
				</div>
				<p class="text-sm dark:text-white/70">
					Check this box if you have verified the existing data is up-to-date.
				</p>
			</div>

			<div>
				<label for="updates" class="mb-2 block font-semibold"
					>Updates needed <span class="font-normal">(If applicable)</span></label
				>
				<textarea
					disabled={accurate}
					required={!accurate}
					name="updates"
					placeholder="Describe what information needs to be updated (contact links, description, etc.)"
					rows="3"
					class="w-full rounded-2xl border-2 border-input bg-white p-3 placeholder-gray-500 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:text-white dark:placeholder-gray-400 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
					bind:value={updates}
				/>
			</div>

			<div>
				<label for="verify" class="mb-2 block font-semibold">How did you verify this?</label>
				<textarea
					required
					name="verify"
					placeholder="I visited their website, attended a meetup, contacted them directly, etc."
					rows="3"
					class="w-full rounded-2xl border-2 border-input bg-white p-3 placeholder-gray-500 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:text-white dark:placeholder-gray-400 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
					bind:this={verify}
				/>
			</div>

			<div>
				<div class="mb-2 flex items-center space-x-2">
					<label for="captcha" class="font-semibold"
						>Bot protection <span class="font-normal">(case-sensitive)</span></label
					>
					{#if captchaSecret}
						<button type="button" on:click={fetchCaptcha}>
							<Icon type="fa" icon="arrows-rotate" w="16" h="16" />
						</button>
					{/if}
				</div>
				<div class="space-y-2">
					<div
						bind:this={captcha}
						class="flex items-center justify-center rounded-2xl border-2 border-input py-1"
					>
						{#if isCaptchaLoading}
							<div class="h-[100px] w-[275px] animate-pulse bg-link/50" />
						{:else}
							<!-- eslint-disable-next-line svelte/no-at-html-tags - we even sanitize the captcha content above -->
							{@html captchaContent}
						{/if}
					</div>
					<input
						disabled={!captchaSecret}
						required
						type="text"
						name="captcha"
						placeholder="Please enter the captcha text."
						class="w-full rounded-2xl border-2 border-input bg-white p-3 placeholder-gray-500 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:text-white dark:placeholder-gray-400 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
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
				disabled={submitting || !captchaSecret}
				style="w-full py-3 rounded-xl"
			>
				Submit Report
			</PrimaryButton>
		</form>
	</section>
{:else}
	<FormSuccess
		type="Report"
		text="Thanks for verifying this community's information. We'll review your report and update it ASAP."
		issue={submissionIssueNumber}
		on:click={resetForm}
	/>
{/if}
