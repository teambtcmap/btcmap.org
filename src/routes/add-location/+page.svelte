<script lang="ts">
	import { browser } from '$app/environment';
	import FormSuccess from '$components/FormSuccess.svelte';
	import HeaderPlaceholder from '$components/layout/HeaderPlaceholder.svelte';
	import Icon from '$components/Icon.svelte';
	import InfoTooltip from '$components/InfoTooltip.svelte';
	import MapLoadingEmbed from '$components/MapLoadingEmbed.svelte';
	import PrimaryButton from '$components/PrimaryButton.svelte';
	import { loadMapDependencies } from '$lib/map/imports';
	import { attribution, changeDefaultIcons, geolocate, toggleMapButtons } from '$lib/map/setup';
	import { theme } from '$lib/store';
	import { detectTheme, errToast } from '$lib/utils';

	import axios from 'axios';

	import type { Map, MaplibreGL, Marker } from 'leaflet';
	import { onDestroy, onMount, tick } from 'svelte';
	import DOMPurify from 'dompurify';

	let captchaContent = '';
	let isCaptchaLoading = true;
	let captchaSecret: string;
	let captchaInput: HTMLInputElement;
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

	function resetForm() {
		submitted = false;
		submitting = false;
		methods = [];
		selected = false;
		noLocationSelected = false;
		noMethodSelected = false;
		lat = undefined;
		long = undefined;
		source = undefined;
		sourceOther = undefined;

		// Wait for the DOM to update with the form back in place
		tick().then(async () => {
			// Clear form fields
			if (name) name.value = '';
			if (address) address.value = '';
			if (category) category.value = '';
			if (website) website.value = '';
			if (phone) phone.value = '';
			if (hours) hours.value = '';
			if (notes) notes.value = '';
			if (contact) contact.value = '';
			if (captchaInput) captchaInput.value = '';
			if (onchain) onchain.checked = false;
			if (lightning) lightning.checked = false;
			if (nfc) nfc.checked = false;

			// Refresh captcha
			fetchCaptcha();

			// Reinitialize the map
			await initializeMap();
		});
	}

	/**
	 * Initialize the map with all required settings and controls
	 */
	async function initializeMap() {
		const deps = await loadMapDependencies();
		const leaflet = deps.leaflet;
		const DomEvent = deps.DomEvent;
		const LocateControl = deps.LocateControl;

		// Create map instance
		if (map) map.remove(); // Clean up any existing map
		map = leaflet.map(mapElement, { attributionControl: false, maxZoom: 19 }).setView([0, 0], 2);

		// Create map styles
		openFreeMapLiberty = window.L.maplibreGL({
			style: 'https://tiles.openfreemap.org/styles/liberty'
		});

		openFreeMapDark = window.L.maplibreGL({
			style: 'https://static.btcmap.org/map-styles/dark.json'
		});

		// Apply appropriate theme
		const currentTheme = $theme || detectTheme();

		if (currentTheme === 'dark') {
			openFreeMapDark.addTo(map);
		} else {
			openFreeMapLiberty.addTo(map);
		}

		// Add marker on click
		let marker: Marker;
		map.on('click', (e) => {
			if (captchaSecret) {
				lat = e.latlng.lat;
				long = e.latlng.lng;

				if (marker) {
					map.removeLayer(marker);
				}

				marker = leaflet.marker([lat, long]).addTo(map);
				selected = true;
			}
		});

		// Add map controls and settings
		try {
			geolocate(leaflet, map, LocateControl);
		} catch (e) {
			console.error('Error adding locate control:', e);
		}

		changeDefaultIcons(false, leaflet, mapElement, DomEvent);
		attribution(leaflet, map);

		// Force a resize to ensure proper rendering
		map.invalidateSize();

		mapLoaded = true;
		return leaflet; // Return leaflet for any additional setup
	}

	let name: HTMLInputElement;
	let address: HTMLInputElement;
	let lat: number | undefined = undefined;
	let long: number | undefined = undefined;
	let selected = false;
	let category: HTMLInputElement;
	let methods: ('onchain' | 'lightning' | 'nfc')[] = [];
	let onchain: HTMLInputElement;
	let lightning: HTMLInputElement;
	let nfc: HTMLInputElement;
	let website: HTMLInputElement;
	let phone: HTMLInputElement;
	let hours: HTMLInputElement;
	let notes: HTMLTextAreaElement;
	let contact: HTMLInputElement;
	let source: 'Business Owner' | 'Customer' | 'Other' | undefined = undefined;
	let sourceOther: string | undefined = undefined;
	let sourceOtherElement: HTMLTextAreaElement;
	let noLocationSelected = false;
	let noMethodSelected = false;
	let submitted = false;
	let submitting = false;
	let submissionIssueNumber: number;

	const handleCheckboxClick = () => {
		noMethodSelected = false;
	};

	$: latFixed = lat && lat.toFixed(5);
	$: longFixed = long && long.toFixed(5);

	const submitForm = () => {
		if (!selected) {
			noLocationSelected = true;
			errToast('Please select a location...');
		} else if (!onchain.checked && !lightning.checked && !nfc.checked) {
			noMethodSelected = true;
			errToast('Please select at least one payment method...');
		} else {
			submitting = true;
			if (onchain.checked) {
				methods.push('onchain');
			}
			if (lightning.checked) {
				methods.push('lightning');
			}
			if (nfc.checked) {
				methods.push('nfc');
			}

			axios
				.post('/add-location/endpoint', {
					captchaSecret,
					captchaTest: captchaInput.value,
					honey: honeyInput.value,
					name: name.value,
					address: address.value,
					lat: lat ? lat.toString() : '',
					long: long ? long.toString() : '',
					osm: lat && long ? `https://www.openstreetmap.org/edit#map=21/${lat}/${long}` : '',
					category: category.value,
					methods: methods.toString(),
					website: website.value,
					phone: phone.value,
					hours: hours.value,
					notes: notes.value,
					source,
					sourceOther: sourceOther ? sourceOther : '',
					contact: contact.value
				})
				.then(function (response) {
					submissionIssueNumber = response.data.number;
					submitted = true;
				})
				.catch(function (error) {
					methods = [];
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

	// location picker map
	let mapElement: HTMLDivElement;
	let map: Map;
	let mapLoaded = false;

	let openFreeMapLiberty: MaplibreGL;
	let openFreeMapDark: MaplibreGL;

	onMount(async () => {
		if (browser) {
			// fetch and add captcha
			fetchCaptcha();

			// Initialize the map
			await initializeMap();
		}
	});

	onDestroy(async () => {
		if (map) {
			console.info('Unloading Leaflet map.');
			map.remove();
		}
	});

	$: $theme !== undefined && mapLoaded === true && toggleMapButtons();

	const toggleTheme = () => {
		if ($theme === 'dark') {
			openFreeMapLiberty.remove();
			openFreeMapDark.addTo(map);
		} else {
			openFreeMapDark.remove();
			openFreeMapLiberty.addTo(map);
		}
	};

	$: $theme !== undefined && mapLoaded === true && toggleTheme();
</script>

<svelte:head>
	<title>BTC Map - Add Location</title>
	<meta property="og:image" content="https://btcmap.org/images/og/add.png" />
	<meta property="twitter:title" content="BTC Map - Add Location" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/add.png" />
</svelte:head>

{#if !submitted}
	{#if typeof window !== 'undefined'}
		<h1
			class="{detectTheme() === 'dark' || $theme === 'dark'
				? 'text-white'
				: 'gradient'} mt-10 text-center text-4xl font-semibold md:text-5xl"
		>
			Accept bitcoin? Get found.
		</h1>
	{:else}
		<HeaderPlaceholder />
	{/if}

	<p class="mt-10 text-center text-lg font-semibold text-primary md:text-xl dark:text-white">
		If you're a business owner, please read our <a
			href="https://gitea.btcmap.org/teambtcmap/btcmap-general/wiki/Merchant-Best-Practices"
			target="_blank"
			rel="noreferrer"
			class="text-link transition-colors hover:text-hover">Merchant Best Practices</a
		> guide.
	</p>

	<div class="mt-16 pb-20 md:pb-32 lg:flex lg:justify-between lg:gap-10">
		<section id="form" class="mx-auto w-full lg:w-1/2 lg:border-r lg:border-input lg:pr-10">
			<div class="mx-auto max-w-xl">
				<h2
					class="mb-5 text-center text-3xl font-semibold text-primary md:text-left dark:text-white"
				>
					Done-for-you
				</h2>

				<p class="mb-10 w-full text-justify text-primary dark:text-white">
					Fill out the following form and one of our volunteer community members will add your
					location to the map. <InfoTooltip
						tooltip="All additions are completed on a volunteer basis and so we can't guarantee when your location will be added."
					/>
				</p>

				<form
					on:submit|preventDefault={submitForm}
					class="w-full space-y-5 text-primary dark:text-white"
				>
					<div>
						<label for="name" class="mb-2 block font-semibold">Merchant Name</label>
						<input
							disabled={!captchaSecret || !mapLoaded}
							type="text"
							name="name"
							id="name"
							placeholder="Satoshi's Comics"
							required
							class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
							bind:this={name}
						/>
					</div>

					<div>
						<label for="location-picker" class="mb-2 block font-semibold">Select Location</label>
						{#if selected}
							<span class="font-semibold text-green-500">Location selected!</span>
						{:else if noLocationSelected}
							<span class="font-semibold text-error">Please select a location...</span>
						{/if}
						<div class="relative mb-2">
							<div
								bind:this={mapElement}
								class="z-10 h-[300px] !cursor-crosshair rounded-2xl border-2 border-input !bg-teal md:h-[400px] dark:!bg-dark"
							/>
							{#if !mapLoaded}
								<MapLoadingEmbed style="h-[300px] md:h-[400px] border-2 border-input rounded-2xl" />
							{/if}
						</div>
						<div class="flex space-x-2">
							<!-- 	eslint-disable svelte/no-reactive-reassign -->
							<input
								required
								disabled
								bind:value={latFixed}
								readonly
								type="number"
								name="lat"
								placeholder="Latitude"
								class="w-full rounded-2xl border-2 border-input p-3 focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
							/>
							<input
								required
								disabled
								bind:value={longFixed}
								readonly
								type="number"
								name="long"
								placeholder="Longitude"
								class="w-full rounded-2xl border-2 border-input p-3 focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
							/>
							<!-- 	eslint-enable svelte/no-reactive-reassign -->
						</div>
					</div>

					<div>
						<label for="address" class="mb-2 block font-semibold"
							>Address (Optional) <InfoTooltip
								tooltip="All locations are required to have a physical
										presence. Optionally enter an address here if that makes sense where the merchant is located. Services without locations are not map-able."
							/></label
						>
						<input
							disabled={!captchaSecret || !mapLoaded}
							type="text"
							name="address"
							id="address"
							placeholder="2100 Freedom Drive..."
							class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
							bind:this={address}
						/>
					</div>

					<div>
						<label for="category" class="mb-2 block font-semibold">Category</label>
						<input
							disabled={!captchaSecret || !mapLoaded}
							type="text"
							name="category"
							id="category"
							placeholder="Restaurant etc."
							class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
							bind:this={category}
						/>
					</div>

					<fieldset>
						<legend class="mb-2 block font-semibold">Select accepted payment methods</legend>
						{#if noMethodSelected}
							<span class="font-semibold text-error">Please fix this...</span>
						{/if}
						<div class="space-y-4">
							<div>
								<input
									class="h-4 w-4 accent-link"
									disabled={!captchaSecret || !mapLoaded}
									type="checkbox"
									name="onchain"
									id="onchain"
									bind:this={onchain}
									on:click={handleCheckboxClick}
								/>
								<label for="onchain" class="ml-1 cursor-pointer">
									{#if typeof window !== 'undefined'}
										<img
											src={detectTheme() === 'dark' || $theme === 'dark'
												? '/icons/btc-highlight-dark.svg'
												: '/icons/btc-primary.svg'}
											alt="onchain"
											class="inline"
										/>
									{/if}
									On-chain
								</label>
							</div>
							<div>
								<input
									class="h-4 w-4 accent-link"
									disabled={!captchaSecret || !mapLoaded}
									type="checkbox"
									name="lightning"
									id="lightning"
									bind:this={lightning}
									on:click={handleCheckboxClick}
								/>
								<label for="lightning" class="ml-1 cursor-pointer">
									{#if typeof window !== 'undefined'}
										<img
											src={detectTheme() === 'dark' || $theme === 'dark'
												? '/icons/ln-highlight-dark.svg'
												: '/icons/ln-primary.svg'}
											alt="lightning"
											class="inline"
										/>
									{/if}
									Lightning
								</label>
							</div>
							<div>
								<input
									class="h-4 w-4 accent-link"
									disabled={!captchaSecret || !mapLoaded}
									type="checkbox"
									name="nfc"
									id="nfc"
									bind:this={nfc}
									on:click={handleCheckboxClick}
								/>
								<label for="nfc" class="ml-1 cursor-pointer">
									{#if typeof window !== 'undefined'}
										<img
											src={detectTheme() === 'dark' || $theme === 'dark'
												? '/icons/nfc-highlight-dark.svg'
												: '/icons/nfc-primary.svg'}
											alt="nfc"
											class="inline"
										/>
									{/if}
									Lightning Contactless
								</label>
							</div>
						</div>
					</fieldset>

					<div>
						<label for="website" class="mb-2 block font-semibold"
							>Website <span class="font-normal">(optional)</span></label
						>
						<input
							disabled={!captchaSecret || !mapLoaded}
							type="url"
							name="website"
							placeholder="https://bitcoin.org"
							class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
							bind:this={website}
						/>
					</div>

					<div>
						<label for="phone" class="mb-2 block font-semibold"
							>Phone <span class="font-normal">(optional)</span></label
						>
						<input
							disabled={!captchaSecret || !mapLoaded}
							type="tel"
							name="phone"
							placeholder="Number"
							class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
							bind:this={phone}
						/>
					</div>

					<div>
						<label for="hours" class="mb-2 block font-semibold"
							>Opening Hours <span class="font-normal">(optional)</span></label
						>
						<input
							disabled={!captchaSecret || !mapLoaded}
							type="text"
							name="hours"
							placeholder="Mo-Fr 08:30-20:00"
							class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
							bind:this={hours}
						/>
					</div>

					<div>
						<label for="notes" class="mb-2 block font-semibold"
							>Notes <span class="font-normal">(optional)</span></label
						>
						<textarea
							disabled={!captchaSecret || !mapLoaded}
							name="notes"
							placeholder="Please add further details here like additional merchant details, contacts, socials, etc."
							rows="3"
							class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
							bind:this={notes}
						/>
					</div>

					<div>
						<label for="source" class="mb-2 block font-semibold">Data Source</label>
						<select
							id="source"
							disabled={!captchaSecret || !mapLoaded}
							name="source"
							required
							class="w-full rounded-2xl border-2 border-input bg-white px-2 py-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
							bind:value={source}
							on:change={async () => {
								if (source === 'Other') {
									await tick();
									sourceOtherElement.focus();
								}
							}}
						>
							<option value="">Please select an option</option>
							<option value="Business Owner">I am the business owner</option>
							<option value="Customer">I visited as a customer</option>
							<option value="Other">Other method</option>
						</select>
						{#if source === 'Other'}
							<p class="my-2 text-justify text-sm">
								How did you verify this information? Please provide as much detail as possible.
							</p>
							<textarea
								disabled={!captchaSecret || !mapLoaded}
								required
								name="source-other"
								placeholder="Local knowledge, online etc."
								class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
								bind:value={sourceOther}
								bind:this={sourceOtherElement}
							/>
						{/if}
					</div>

					<div>
						<label for="contact" class="mb-2 block font-semibold">Public Contact</label>
						<p class="mb-2 text-justify text-sm">
							If we have any follow-up questions we will contact you in order to add this location
							successfully. To speed up the process please check your spam folder in case it ends up
							there.
						</p>
						<input
							disabled={!captchaSecret || !mapLoaded}
							required
							type="email"
							name="contact"
							placeholder="hello@btcmap.org"
							class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
							bind:this={contact}
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
								disabled={!captchaSecret || !mapLoaded}
								required
								type="text"
								name="captcha"
								placeholder="Please enter the captcha text."
								class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
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
						disabled={submitting || !captchaSecret || !mapLoaded}
						style="w-full py-3 rounded-xl"
					>
						Submit Location
					</PrimaryButton>
				</form>
			</div>
		</section>

		<section
			id="supertagger"
			class="mx-auto mt-14 w-full border-t border-input pt-14 lg:mt-0 lg:w-1/2 lg:border-t-0 lg:pt-0 lg:pl-10"
		>
			<div class="lg:flex lg:justify-start">
				<div class="mx-auto max-w-xl text-primary dark:text-white">
					<h2 class="mb-5 text-center text-3xl font-semibold md:text-left">Shadowy Supertagger?</h2>
					<p class="mb-10 w-full text-justify md:text-left">
						Contribute changes directly to OSM - like a 😎 boss. Who needs forms anyway.
					</p>
					<img
						src="/images/supertagger.svg"
						alt="shadowy supertagger"
						class="mx-auto mb-10 h-[220px] w-[220px]"
					/>
					<PrimaryButton
						style="w-full py-3 rounded-xl"
						link="https://gitea.btcmap.org/teambtcmap/btcmap-general/wiki/Tagging-Merchants#shadowy-supertaggers-"
						external={true}
					>
						See Wiki for instructions
					</PrimaryButton>
				</div>
			</div>
		</section>
	</div>
{:else}
	<FormSuccess
		type="Location"
		text="We'll review your information and add it ASAP."
		issue={submissionIssueNumber}
		on:click={resetForm}
	/>
{/if}
