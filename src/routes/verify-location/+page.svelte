<script lang="ts">
	export let data: import('./+page.server').VerifyLocationPageData;
	import { browser } from '$app/environment';
	import FormSuccess from '$components/FormSuccess.svelte';
	import HeaderPlaceholder from '$components/layout/HeaderPlaceholder.svelte';
	import Icon from '$components/Icon.svelte';
	import InfoTooltip from '$components/InfoTooltip.svelte';
	import PrimaryButton from '$components/PrimaryButton.svelte';
	import { placesError, theme } from '$lib/store';
	import { detectTheme, errToast } from '$lib/utils';
	import axios from 'axios';
	import { onMount } from 'svelte';
	import DOMPurify from 'dompurify';

	// Initialize from server data
	let name = data?.name || '';
	let lat = data?.lat;
	let long = data?.long;
	let location = data?.location || '';
	let edit = data?.edit || '';

	let captcha: HTMLDivElement;
	let captchaSecret: string;
	let captchaInput: HTMLInputElement;
	let honeyInput: HTMLInputElement;

	let captchaContent = '';
	let isCaptchaLoading = true;

	const fetchCaptcha = () => {
		isCaptchaLoading = true;
		axios
			.get('/captcha')
			.then(function (response) {
				// handle success
				captchaSecret = response.data.captchaSecret;
				captchaContent = DOMPurify.sanitize(response.data.captcha);
			})
			.catch(function (error) {
				// handle error
				errToast('Could not fetch captcha, please try again or contact BTC Map.');
				console.error(error);
			})
			.finally(() => {
				isCaptchaLoading = false;
			});
	};

	let current: boolean;
	let outdated: string;
	let verify: HTMLTextAreaElement;

	let selected = !!data; // Set to true if we have server data
	let submitted = false;
	let submitting = false;
	let submissionIssueNumber: number;
	let merchantId = data?.merchantId || '';

	const submitForm = () => {
		if (!selected) {
			errToast('Please select a location...');
		} else {
			submitting = true;

			axios
				.post('/verify-location/endpoint', {
					captchaSecret,
					captchaTest: captchaInput.value,
					honey: honeyInput.value,
					name: name,
					location: location,
					edit: edit,
					current: current ? 'Yes' : 'No',
					outdated: outdated ? outdated : '',
					verified: verify.value,
					merchantId: merchantId,
					lat: lat,
					long: long
				})
				.then(function (response) {
					submissionIssueNumber = response.data.number;
					submitted = true;
				})
				.catch(function (error) {
					if (error.response.data.message.includes('Captcha')) {
						errToast(error.response.data.message);
					} else {
						errToast('Form submission failed, please try again or contact BTC Map.');
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
	$: $placesError && errToast($placesError);

	onMount(async () => {
		if (browser) {
			// fetch and add captcha
			fetchCaptcha();
		}
	});
</script>

<svelte:head>
	<title>BTC Map - Verify Location</title>
	<meta property="og:image" content="https://btcmap.org/images/og/verify.png" />
	<meta property="twitter:title" content="BTC Map - Verify Location" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/verify.png" />
</svelte:head>

{#if !submitted}
	{#if typeof window !== 'undefined'}
		<h1
			class="{detectTheme() === 'dark' || $theme === 'dark'
				? 'text-white'
				: 'gradient'} mt-10 text-center text-4xl font-semibold md:text-5xl"
		>
			Help improve the data for everyone.
		</h1>
	{:else}
		<HeaderPlaceholder />
	{/if}

	<section id="verify" class="mx-auto mt-16 w-full pb-20 md:w-[600px] md:pb-32">
		<h2 class="mb-5 text-center text-3xl font-semibold text-primary dark:text-white">
			Verify Location<br />
			<span class="text-base font-normal"
				>(Ensure the information is still accurate and update it otherwise.)</span
			>
		</h2>

		<p class="mb-10 w-full text-center text-primary dark:text-white">
			Please fill out the following form and one of our volunteer community members will update your
			location on the map. Did you know you can update this data yourself on <a
				href="https://www.openstreetmap.org"
				target="_blank"
				rel="noreferrer"
				class="text-link transition-colors hover:text-hover">OpenStreetMap</a
			>? You can check out our
			<a
				href="https://gitea.btcmap.org/teambtcmap/btcmap-general/wiki/Tagging-Merchants#shadowy-supertaggers"
				target="_blank"
				rel="noreferrer"
				class="text-link transition-colors hover:text-hover">Wiki</a
			>
			for more instructions. <InfoTooltip
				tooltip="NOTE: Due to the backlog of requests and the updates being completed on a volunteer effort, it may take several weeks to update this location. It is encouraged to update the location on OpenStreetMap directly if you want to see the changes appear on the map right away."
			/>
		</p>

		<form
			on:submit|preventDefault={submitForm}
			class="w-full space-y-5 text-primary dark:text-white"
		>
			<div>
				<input
					disabled
					bind:value={name}
					readonly
					type="text"
					name="name"
					placeholder={!data ? 'Loading Merchant...' : 'Merchant Name'}
					class="w-full rounded-2xl border-2 border-input p-3 text-center font-semibold focus:outline-link"
				/>
			</div>

			<div>
				<div class="flex items-center space-x-2">
					<label for="current" class="{!outdated ? 'cursor-pointer' : ''} font-semibold"
						>Current information is correct</label
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
				<p class="text-sm">Check this box if you have verified the existing data is up-to-date.</p>
			</div>

			<div>
				<label for="outdated" class="mb-2 block font-semibold"
					>Outdated information <span class="font-normal">(If applicable)</span></label
				>
				<textarea
					disabled={!captchaSecret || !data || current}
					required={!current}
					name="outdated"
					placeholder="Provide what info is incorrect and the updated info on this location"
					rows="3"
					class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
					bind:value={outdated}
				/>
			</div>

			<div>
				<label for="verify" class="mb-2 block font-semibold">How did you verify this?</label>
				<textarea
					disabled={!captchaSecret || !data}
					required
					name="verify"
					placeholder="Please provide additional info here"
					rows="3"
					class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
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
						disabled={!captchaSecret || !data}
						required
						type="text"
						name="captcha"
						placeholder="Please enter the captcha text."
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
				Submit Report
			</PrimaryButton>
		</form>
	</section>
{:else}
	<FormSuccess
		type="Report"
		text="Thanks for taking the time to fill out this report. We’ll review your information and
update it ASAP."
		issue={submissionIssueNumber}
		on:click={resetForm}
	/>
{/if}
