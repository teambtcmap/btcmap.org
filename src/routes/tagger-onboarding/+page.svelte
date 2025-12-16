<script lang="ts">
	import { browser } from '$app/environment';
	import FormSuccess from '$components/FormSuccess.svelte';
	import HeaderPlaceholder from '$components/layout/HeaderPlaceholder.svelte';
	import Icon from '$components/Icon.svelte';
	import PrimaryButton from '$components/PrimaryButton.svelte';
	import { theme } from '$lib/store';
	import { detectTheme, errToast } from '$lib/utils';
	import axios from 'axios';
	import { onMount } from 'svelte';
	import DOMPurify from 'dompurify';

	let nameInput: HTMLInputElement;
	let emailInput: HTMLInputElement;

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
				captchaSecret = response.data.captchaSecret;
				captchaContent = DOMPurify.sanitize(response.data.captcha);
			})
			.catch(function (error) {
				errToast('Could not fetch captcha, please try again or contact BTC Map.');
				console.error(error);
			})
			.finally(() => {
				isCaptchaLoading = false;
			});
	};

	let submitted = false;
	let submitting = false;
	let submissionIssueNumber: number;

	const submitForm = (event: SubmitEvent) => {
		event.preventDefault();
		submitting = true;

		axios
			.post('/api/gitea/issue', {
				type: 'tagger-onboarding',
				captchaSecret,
				captchaTest: captchaInput.value,
				honey: honeyInput.value,
				name: nameInput.value,
				email: emailInput.value
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
	};

	function resetForm() {
		submitted = false;
		submitting = false;
		nameInput.value = '';
		emailInput.value = '';
		captchaInput.value = '';
		fetchCaptcha();
	}

	onMount(async () => {
		if (browser) {
			fetchCaptcha();
		}
	});
</script>

<svelte:head>
	<title>BTC Map - Become a Tagger</title>
	<meta property="og:image" content="https://btcmap.org/images/og/home.png" />
	<meta property="twitter:title" content="BTC Map - Become a Tagger" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/home.png" />
</svelte:head>

{#if !submitted}
	{#if typeof window !== 'undefined'}
		<h1
			class="{detectTheme() === 'dark' || $theme === 'dark'
				? 'text-white'
				: 'gradient'} mt-10 text-center text-4xl font-semibold md:text-5xl"
		>
			Help maintain Bitcoin adoption data.
		</h1>
	{:else}
		<HeaderPlaceholder />
	{/if}

	<section id="tagger-onboarding" class="mx-auto mt-16 w-full pb-20 md:w-[600px] md:pb-32">
		<h2 class="mb-5 text-center text-3xl font-semibold text-primary dark:text-white">
			Become a Tagger
		</h2>

		<p class="mb-10 w-full text-center text-primary dark:text-white">
			Taggers are volunteers who help keep BTC Map data accurate by verifying locations and adding
			new merchants. Fill out this form to get started with the onboarding process.
		</p>

		<form on:submit={submitForm} class="w-full space-y-5 text-primary dark:text-white">
			<div>
				<label for="name" class="mb-2 block font-semibold">Name</label>
				<input
					disabled={!captchaSecret}
					required
					type="text"
					id="name"
					name="name"
					placeholder="Your name"
					class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
					bind:this={nameInput}
				/>
			</div>

			<div>
				<label for="email" class="mb-2 block font-semibold">Email</label>
				<input
					disabled={!captchaSecret}
					required
					type="email"
					id="email"
					name="email"
					placeholder="your@email.com"
					class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
					bind:this={emailInput}
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
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							{@html captchaContent}
						{/if}
					</div>
					<input
						disabled={!captchaSecret}
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
				disabled={submitting || !captchaSecret}
				style="w-full py-3 rounded-xl"
			>
				Submit Application
			</PrimaryButton>
		</form>
	</section>
{:else}
	<FormSuccess
		type="Application"
		text="Thanks for your interest in becoming a tagger! We'll review your application and get back to you soon."
		issue={submissionIssueNumber}
		on:click={resetForm}
	/>
{/if}
