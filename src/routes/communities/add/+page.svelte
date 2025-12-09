<script lang="ts">
	import { browser } from '$app/environment';
	import Breadcrumbs from '$components/Breadcrumbs.svelte';
	import FormSuccess from '$components/FormSuccess.svelte';
	import HeaderPlaceholder from '$components/layout/HeaderPlaceholder.svelte';
	import Icon from '$components/Icon.svelte';
	import InfoTooltip from '$components/InfoTooltip.svelte';
	import PrimaryButton from '$components/PrimaryButton.svelte';
	import { theme } from '$lib/store';
	import type { NominatimResponse } from '$lib/types';
	import { detectTheme, errToast, successToast, warningToast } from '$lib/utils';
	import axios from 'axios';
	import { onMount } from 'svelte';
	import DOMPurify from 'dompurify';

	const routes = [
		{ name: 'Communities', url: '/communities' },
		{ name: 'Add', url: '/communities/add' }
	];

	let captchaContent = '';
	let isCaptchaLoading = true;
	let captchaSecret: string;
	let captchaValue: string = '';
	let honeyInput: HTMLInputElement;

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

	let location: string | undefined;
	let name: string;
	let icon: string;
	let lightning: string;
	let socialLinks: string;
	let contact: string;
	let notes: string;

	let selected = false;
	let noLocationSelected = false;
	let submitted = false;
	let submitting = false;
	let submissionIssueNumber: number;

	let searchQuery: string;
	let searchResults: NominatimResponse[] = [];
	let searchLoading = false;

	const searchLocation = () => {
		searchLoading = true;
		searchResults = [];
		location = undefined;
		selected = false;

		axios
			.get<NominatimResponse[]>(
				`https://nominatim.openstreetmap.org/search?q=${searchQuery}&format=json&polygon_geojson=1&email=hello@btcmap.org`
			)
			.then(function (response) {
				searchResults = response.data.filter(
					(area) => area.geojson?.type === 'Polygon' || area.geojson?.type === 'MultiPolygon'
				);
				if (!searchResults.length) {
					warningToast('No locations found, please adjust query.');
				}
				searchLoading = false;
			})
			.catch(function (error) {
				errToast('Could not search for locations, please try again or contact BTC Map.');
				searchLoading = false;
				console.error(error);
			});
	};

	let selectedLat: number;
	let selectedLon: number;

	const setLocation = (area: { display_name: string; lat: string; lon: string }) => {
		location = area.display_name;
		selectedLat = parseFloat(area.lat);
		selectedLon = parseFloat(area.lon);
		selected = true;
		successToast('Location selected!');
	};

	const submitForm = () => {
		if (!selected) {
			noLocationSelected = true;
			errToast('Please select a location...');
		} else {
			submitting = true;

			axios
				.post('/communities/add/endpoint', {
					captchaSecret,
					captchaTest: captchaValue,
					honey: honeyInput,
					location,
					name,
					icon: icon ? icon : '',
					lightning: lightning ? lightning : '',
					socialLinks: socialLinks ? socialLinks : '',
					contact,
					notes: notes ? notes : '',
					lat: selectedLat,
					long: selectedLon
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

	const formReset = () => {
		// Reset state variables
		selected = false;
		noLocationSelected = false;
		submitted = false;
		submitting = false;
		searchQuery = '';
		searchResults = [];
		searchLoading = false;

		// Clear form fields
		location = undefined;
		name = '';
		icon = '';
		lightning = '';
		socialLinks = '';
		contact = '';
		notes = '';
		captchaValue = ''; // Reset the value directly

		// Refresh captcha
		fetchCaptcha();
	};

	onMount(async () => {
		if (browser) {
			// fetch and add captcha
			fetchCaptcha();
		}
	});
</script>

<svelte:head>
	<title>BTC Map - Add Community</title>
	<meta property="og:image" content="https://btcmap.org/images/og/add-community.png" />
	<meta property="twitter:title" content="BTC Map - Add Community" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/add-community.png" />
</svelte:head>

<Breadcrumbs {routes} />
{#if !submitted}
	{#if typeof window !== 'undefined'}
		<h1
			class="{detectTheme() === 'dark' || $theme === 'dark'
				? 'text-white'
				: 'gradient'} mt-10 text-center text-4xl font-semibold md:text-5xl"
		>
			Make an impact locally!
		</h1>
	{:else}
		<HeaderPlaceholder />
	{/if}

	<section id="add-community" class="mx-auto mt-16 w-full pb-20 md:w-[600px] md:pb-32">
		<h2 class="mb-5 text-center text-3xl font-semibold text-primary dark:text-white">
			Add Community
		</h2>

		<p class="mb-5 w-full text-center text-primary dark:text-white">
			Please fill out this form to submit a community application. This is a great way to grow
			bitcoin adoption in your area, have some fun, and maybe even make some friends along the way. <InfoTooltip
				tooltip="NOTE: BTC Map is a free and open source project run by volunteers. Each community application is manually reviewed to ensure quality. It may take a few weeks to have your community added."
			/>
		</p>

		<div class="mb-10 w-full text-primary dark:text-white">
			<p class="font-semibold">Criteria</p>
			<ul class="ml-5 list-disc">
				<li>bitcoin-only</li>
				<li>must be a geographical area not a single point</li>
				<li>be willing to take ownership of your local mapping data</li>
				<li>try to onboard new businesses in your area</li>
			</ul>
		</div>

		<form
			on:submit|preventDefault={submitForm}
			class="w-full space-y-5 text-primary dark:text-white"
		>
			<div class="space-y-2">
				<label for="location-picker" class="block font-semibold">Select Location</label>
				<p class="text-sm">Search for an area and select an option from the results.</p>

				{#if selected}
					<span class="font-semibold text-green-500">Location selected!</span>
				{:else if noLocationSelected}
					<span class="font-semibold text-error">Please select a location...</span>
				{/if}

				<div class="space-y-2 md:flex md:space-y-0 md:space-x-2">
					<input
						on:keydown={(e) => {
							if (e.key === 'Enter') {
								searchLocation();
							}
						}}
						disabled={!captchaSecret}
						type="text"
						name="location"
						placeholder="El Zonte, El Salvador"
						required
						class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
						bind:value={searchQuery}
					/>
					<PrimaryButton
						type="button"
						on:click={searchLocation}
						loading={searchLoading}
						disabled={!captchaSecret || searchLoading || !searchQuery}
						style="{!searchQuery
							? 'opacity-50 hover:bg-link'
							: ''} w-full md:w-[210px] py-3 rounded-xl"
					>
						Search 🔍
					</PrimaryButton>
				</div>

				{#if searchResults && searchResults.length}
					<div
						class="{!location
							? 'bg-white dark:bg-dark'
							: ''} max-h-[300px] overflow-auto border-2 border-input"
					>
						{#if !location}
							{#each searchResults as area, index (area.display_name)}
								<button
									on:click={() => setLocation(area)}
									class="{index !== searchResults.length - 1
										? 'border-b'
										: ''} block p-3 whitespace-nowrap hover:bg-link/50">{area.display_name}</button
								>
							{/each}
						{:else}
							<p class="p-3 font-semibold whitespace-nowrap">{location}</p>
						{/if}
					</div>
				{/if}
			</div>

			<div>
				<label for="name" class="mb-2 block font-semibold">Community Name</label>
				<input
					disabled={!captchaSecret}
					type="text"
					name="name"
					placeholder="Bitcoin Island Philippines"
					required
					class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
					bind:value={name}
				/>
			</div>

			<div>
				<label for="icon" class="mb-2 block font-semibold"
					>Icon URL <span class="font-normal">(optional)</span></label
				>
				<p class="mb-2 text-sm">
					We will use the avatar from your social link or the country's flag your community is
					located in if an icon is not provided.
				</p>
				<input
					disabled={!captchaSecret}
					type="url"
					name="icon"
					placeholder="https://static.btcmap.org/images/communities/iom.svg"
					class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
					bind:value={icon}
				/>
			</div>

			<div>
				<label for="lightning" class="mb-2 block font-semibold"
					>Lightning Tips <span class="font-normal">(optional)</span></label
				>
				<p class="mb-2 text-sm">
					If you want the ability to receive sats you can add either a <a
						href="https://lightningaddress.com/"
						target="_blank"
						rel="noreferrer"
						class="text-link transition-colors hover:text-hover">Lightning Address</a
					>
					or
					<a
						href="https://github.com/fiatjaf/lnurl-rfc#lnurl-documents"
						target="_blank"
						rel="noreferrer"
						class="text-link transition-colors hover:text-hover">LNURL-pay</a
					> string.
				</p>
				<input
					disabled={!captchaSecret}
					type="text"
					name="lightning"
					placeholder="btcmap@zbd.gg"
					class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
					bind:value={lightning}
				/>
			</div>

			<div>
				<label for="socials" class="mb-2 block font-semibold">Social Links</label>
				<p class="mb-2 text-sm">
					You need to provide at least one method for people to join your community.
				</p>

				<textarea
					required
					disabled={!captchaSecret}
					name="socials"
					placeholder="Website, Nostr, Telegram, Meetup etc."
					rows="3"
					class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
					bind:value={socialLinks}
				/>
			</div>

			<div>
				<label for="icon" class="mb-2 block font-semibold">Public Contact</label>
				<p class="mb-2 text-sm">
					A way to get in touch with the community leader if we have any questions.
				</p>
				<input
					required
					disabled={!captchaSecret}
					type="text"
					name="contact"
					placeholder="e.g. hello@btcmap.org"
					class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
					bind:value={contact}
				/>
			</div>

			<div>
				<label for="notes" class="mb-2 block font-semibold"
					>Notes <span class="font-normal">(optional)</span></label
				>
				<p class="mb-2 text-sm">
					Is this community part of an organization? Would you like to be associated with a specific
					language? Etc.
				</p>

				<textarea
					disabled={!captchaSecret}
					name="notes"
					placeholder="German speaking - part of Einundzwanzig."
					rows="2"
					class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
					bind:value={notes}
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
					<div class="flex items-center justify-center rounded-2xl border-2 border-input py-1">
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
						class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
						bind:value={captchaValue}
					/>
				</div>
			</div>

			<input
				type="text"
				name="honey"
				placeholder="A nice pot of honey."
				class="hidden"
				bind:value={honeyInput}
			/>

			<PrimaryButton
				loading={submitting}
				disabled={submitting || !captchaSecret}
				style="w-full py-3 rounded-xl"
			>
				Submit Community
			</PrimaryButton>
		</form>
	</section>
{:else}
	<FormSuccess
		type="Community"
		text="Thanks for your initiative to create a bitcoin community. We’ll review your information
	and reach out if we need any more details."
		issue={submissionIssueNumber}
		buttonWidth="w-60"
		on:click={formReset}
	/>
{/if}
