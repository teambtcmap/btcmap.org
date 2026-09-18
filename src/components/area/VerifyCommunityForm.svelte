<script lang="ts">
import axios from "axios";
import DOMPurify from "dompurify";
import { onMount } from "svelte";
import { _ } from "svelte-i18n";

import FormSuccess from "$components/FormSuccess.svelte";
import Icon from "$components/Icon.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import { errToast } from "$lib/utils";

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
			captchaContent = DOMPurify.sanitize(response.data.captcha);
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
let updates = $state("");
let verify = $state<HTMLTextAreaElement>();

let submitted = $state(false);
let submitting = $state(false);
let submissionIssueNumber = $state<number>();

const submitForm = (event: SubmitEvent) => {
	event.preventDefault();
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

		<form onsubmit={submitForm} class="w-full space-y-5 text-primary dark:text-white">
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
						bind:checked={accurate}
					/>
				</div>
				<p class="text-sm dark:text-white/70">
					{$_(`verifyCommunity.accurateHint`)}
				</p>
			</div>

			<div>
				<label for="updates" class="mb-2 block font-semibold"
					>{$_(`verifyCommunity.updatesLabel`)} <span class="font-normal">{$_(`verifyCommunity.ifApplicable`)}</span></label
				>
				<textarea
					disabled={accurate}
					required={!accurate}
					name="updates"
					placeholder={$_(`verifyCommunity.updatesPlaceholder`)}
					rows="3"
					class="w-full rounded-2xl border-2 border-input bg-white p-3 placeholder-gray-500 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:text-white dark:placeholder-gray-400 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
					bind:value={updates}
				></textarea>
			</div>

			<div>
				<label for="verify" class="mb-2 block font-semibold">{$_(`verifyCommunity.verifyLabel`)}</label>
				<textarea
					required
					name="verify"
					placeholder={$_(`verifyCommunity.verifyPlaceholder`)}
					rows="3"
					class="w-full rounded-2xl border-2 border-input bg-white p-3 placeholder-gray-500 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:text-white dark:placeholder-gray-400 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
					bind:this={verify}
				></textarea>
			</div>

			<div>
				<div class="mb-2 flex items-center space-x-2">
					<label for="captcha" class="font-semibold"
						>{$_(`verifyCommunity.botProtection`)} <span class="font-normal">{$_(`verifyCommunity.caseSensitive`)}</span></label
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
						disabled={!captchaSecret}
						required
						type="text"
						name="captcha"
						placeholder={$_(`verifyCommunity.captchaPlaceholder`)}
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
