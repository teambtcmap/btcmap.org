<script lang="ts">
import axios from "axios";
import DOMPurify from "dompurify";
import type { Map, MaplibreGL, Marker } from "leaflet";
import { onDestroy, onMount, tick } from "svelte";

import FormSuccess from "$components/FormSuccess.svelte";
import FormSelect from "$components/form/FormSelect.svelte";
import Icon from "$components/Icon.svelte";
import InfoTooltip from "$components/InfoTooltip.svelte";
import HeaderPlaceholder from "$components/layout/HeaderPlaceholder.svelte";
import MapLoadingEmbed from "$components/MapLoadingEmbed.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import { _ } from "$lib/i18n";
import { loadMapDependencies } from "$lib/map/imports";
import {
	attribution,
	changeDefaultIcons,
	generateLocationIcon,
	geolocate,
} from "$lib/map/setup";
import { theme } from "$lib/theme";
import { errToast } from "$lib/utils";

import { browser } from "$app/environment";

let captchaContent = "";
let isCaptchaLoading = true;
let captchaSecret: string;
let captchaInput: HTMLInputElement;
let honeyInput: HTMLInputElement;

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
		if (name) name.value = "";
		if (address) address.value = "";
		if (category) category.value = "";
		if (website) website.value = "";
		if (phone) phone.value = "";
		if (hours) hours.value = "";
		if (notes) notes.value = "";
		if (contact) contact.value = "";
		if (captchaInput) captchaInput.value = "";
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
	map = leaflet
		.map(mapElement, { attributionControl: false, maxZoom: 19 })
		.setView([0, 0], 2);

	// Create map styles
	openFreeMapLiberty = window.L.maplibreGL({
		style: "https://tiles.openfreemap.org/styles/liberty",
	});

	openFreeMapDark = window.L.maplibreGL({
		style: "https://static.btcmap.org/map-styles/dark.json",
	});

	// Apply appropriate theme
	const currentTheme = theme.current;

	if (currentTheme === "dark") {
		openFreeMapDark.addTo(map);
	} else {
		openFreeMapLiberty.addTo(map);
	}

	// Add marker on click
	let marker: Marker;
	map.on("click", (e) => {
		if (captchaSecret) {
			lat = e.latlng.lat;
			long = e.latlng.lng;

			if (marker) {
				map.removeLayer(marker);
			}

			const locationIcon = generateLocationIcon(leaflet);
			marker = leaflet.marker([lat, long], { icon: locationIcon }).addTo(map);
			selected = true;
		}
	});

	// Add map controls and settings
	try {
		geolocate(leaflet, map, LocateControl);
	} catch (e) {
		console.error("Error adding locate control:", e);
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
let lat: number | undefined;
let long: number | undefined;
let selected = false;
let category: HTMLInputElement;
let methods: ("onchain" | "lightning" | "nfc")[] = [];
let onchain: HTMLInputElement;
let lightning: HTMLInputElement;
let nfc: HTMLInputElement;
let website: HTMLInputElement;
let phone: HTMLInputElement;
let hours: HTMLInputElement;
let notes: HTMLTextAreaElement;
let contact: HTMLInputElement;
let source: "Business Owner" | "Customer" | "Other" | undefined;
let sourceOther: string | undefined;
let sourceOtherElement: HTMLTextAreaElement;
let noLocationSelected = false;
let noMethodSelected = false;
let submitted = false;
let submitting = false;
let submissionIssueNumber: number;

const handleCheckboxClick = () => {
	noMethodSelected = false;
};

$: latFixed = lat?.toFixed(5);
$: longFixed = long?.toFixed(5);

const submitForm = (event: SubmitEvent) => {
	event.preventDefault();
	if (!selected) {
		noLocationSelected = true;
		errToast("Please select a location...");
	} else if (!onchain.checked && !lightning.checked && !nfc.checked) {
		noMethodSelected = true;
		errToast("Please select at least one payment method...");
	} else {
		submitting = true;
		if (onchain.checked) {
			methods.push("onchain");
		}
		if (lightning.checked) {
			methods.push("lightning");
		}
		if (nfc.checked) {
			methods.push("nfc");
		}

		axios
			.post("/api/gitea/issue", {
				type: "add-location",
				captchaSecret,
				captchaTest: captchaInput.value,
				honey: honeyInput.value,
				name: name.value,
				address: address.value,
				lat: lat ? lat.toString() : "",
				long: long ? long.toString() : "",
				osm:
					lat && long
						? `https://www.openstreetmap.org/edit#map=21/${lat}/${long}`
						: "",
				category: category.value,
				methods: methods.toString(),
				website: website.value,
				phone: phone.value,
				hours: hours.value,
				notes: notes.value,
				source,
				sourceOther: sourceOther ? sourceOther : "",
				contact: contact.value,
			})
			.then((response) => {
				submissionIssueNumber = response.data.number;
				submitted = true;
			})
			.catch((error) => {
				methods = [];
				if (error.response.data.message.includes("Captcha")) {
					errToast(error.response.data.message);
				} else {
					errToast(
						"Form submission failed, please try again or contact BTC Map.",
					);
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
		console.info("Unloading Leaflet map.");
		map.remove();
	}
});

const toggleTheme = () => {
	if ($theme === "dark") {
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
			class="{$theme === 'dark'
				? 'text-white'
				: 'gradient'} mt-10 text-center text-4xl font-semibold md:text-5xl"
		>
			{$_('addLocation.hero')}
		</h1>
	{:else}
		<HeaderPlaceholder />
	{/if}

	<p class="mt-10 text-center text-lg font-semibold text-primary md:text-xl dark:text-white">
		{$_('addLocation.businessOwner')} <a
			href="https://gitea.btcmap.org/teambtcmap/btcmap-general/wiki/Merchant-Best-Practices"
			target="_blank"
			rel="noreferrer"
			class="text-link transition-colors hover:text-hover">{$_('addLocation.bestPractices')}</a
		>{$_('addLocation.guide')}
	</p>

	<div class="mt-16 pb-20 md:pb-32 lg:flex lg:justify-between lg:gap-10">
		<section id="form" class="mx-auto w-full lg:w-1/2 lg:border-r lg:border-input lg:pr-10">
			<div class="mx-auto max-w-xl">
				<h2
					class="mb-5 text-center text-3xl font-semibold text-primary md:text-left dark:text-white"
				>
					{$_('addLocation.heading')}
				</h2>

				<p class="mb-10 w-full text-justify text-primary dark:text-white">
					{$_('addLocation.description')} <InfoTooltip
						tooltip={$_('addLocation.tooltip')}
					/>
				</p>

				<form on:submit={submitForm} class="w-full space-y-5 text-primary dark:text-white">
				<div>
					<label for="name" class="mb-2 block font-semibold">{$_('forms.merchantName')}</label>
					<input
						disabled={!captchaSecret || !mapLoaded}
						type="text"
						name="name"
						id="name"
						placeholder={$_('addLocation.merchantNamePlaceholder')}
						required
						class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
						bind:this={name}
					/>
				</div>

				<div>
					<label for="location-picker" class="mb-2 block font-semibold">{$_('forms.selectLocation')}</label>
					{#if selected}
						<span class="font-semibold text-green-500">{$_('forms.locationSelected')}</span>
					{:else if noLocationSelected}
						<span class="font-semibold text-error">{$_('addLocation.noLocationError')}</span>
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
								placeholder={$_('addLocation.latitude')}
								class="w-full rounded-2xl border-2 border-input p-3 focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
							/>
							<input
								required
								disabled
								bind:value={longFixed}
								readonly
								type="number"
								name="long"
								placeholder={$_('addLocation.longitude')}
								class="w-full rounded-2xl border-2 border-input p-3 focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
							/>
							<!-- 	eslint-enable svelte/no-reactive-reassign -->
						</div>
					</div>

				<div>
					<label for="address" class="mb-2 block font-semibold"
						>{$_('addLocation.addressLabel')} <InfoTooltip
							tooltip={$_('addLocation.addressTooltip')}
						/></label
					>
					<input
						disabled={!captchaSecret || !mapLoaded}
						type="text"
						name="address"
						id="address"
						placeholder={$_('addLocation.addressPlaceholder')}
						class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
						bind:this={address}
					/>
				</div>

				<div>
					<label for="category" class="mb-2 block font-semibold">{$_('forms.category')}</label>
					<input
						disabled={!captchaSecret || !mapLoaded}
						type="text"
						name="category"
						id="category"
						placeholder={$_('addLocation.categoryPlaceholder')}
						class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
						bind:this={category}
					/>
				</div>

				<fieldset>
					<legend class="mb-2 block font-semibold">{$_('addLocation.paymentMethodsLegend')}</legend>
					{#if noMethodSelected}
						<span class="font-semibold text-error">{$_('addLocation.paymentMethodError')}</span>
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
									src={$theme === 'dark'
										? '/icons/btc-highlight-dark.svg'
										: '/icons/btc-primary.svg'}
									alt=""
									class="inline"
								/>
								{/if}
								{$_('addLocation.onchainLabel')}
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
									src={$theme === 'dark'
										? '/icons/ln-highlight-dark.svg'
										: '/icons/ln-primary.svg'}
									alt=""
									class="inline"
								/>
								{/if}
								{$_('addLocation.lightningLabel')}
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
									src={$theme === 'dark'
										? '/icons/nfc-highlight-dark.svg'
										: '/icons/nfc-primary.svg'}
									alt=""
									class="inline"
								/>
								{/if}
								{$_('addLocation.nfcLabel')}
							</label>
						</div>
					</div>
				</fieldset>

				<div>
					<label for="website" class="mb-2 block font-semibold"
						>{$_('forms.website')} <span class="font-normal">({$_('forms.optional')})</span></label
					>
					<input
						disabled={!captchaSecret || !mapLoaded}
						type="url"
						name="website"
						placeholder={$_('addLocation.websitePlaceholder')}
						class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
						bind:this={website}
					/>
				</div>

				<div>
					<label for="phone" class="mb-2 block font-semibold"
						>{$_('forms.phone')} <span class="font-normal">({$_('forms.optional')})</span></label
					>
					<input
						disabled={!captchaSecret || !mapLoaded}
						type="tel"
						name="phone"
						placeholder={$_('addLocation.phonePlaceholder')}
						class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
						bind:this={phone}
					/>
				</div>

				<div>
					<label for="hours" class="mb-2 block font-semibold"
						>{$_('forms.openingHours')} <span class="font-normal">({$_('forms.optional')})</span></label
					>
					<input
						disabled={!captchaSecret || !mapLoaded}
						type="text"
						name="hours"
						placeholder={$_('addLocation.hoursPlaceholder')}
						class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
						bind:this={hours}
					/>
				</div>

				<div>
					<label for="notes" class="mb-2 block font-semibold"
						>{$_('forms.notes')} <span class="font-normal">({$_('forms.optional')})</span></label
					>
					<textarea
						disabled={!captchaSecret || !mapLoaded}
						name="notes"
						placeholder={$_('addLocation.notesPlaceholder')}
						rows="3"
						class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
						bind:this={notes}
					/>
				</div>

				<div>
					<label for="source" class="mb-2 block font-semibold">{$_('addLocation.dataSourceLabel')}</label>
					<FormSelect
						id="source"
						disabled={!captchaSecret || !mapLoaded}
						name="source"
						required
						bind:value={source}
						on:change={async () => {
							if (source === 'Other') {
								await tick();
								sourceOtherElement.focus();
							}
						}}
					>
						<option value="">{$_('addLocation.dataSourcePlaceholder')}</option>
						<option value="Business Owner">{$_('addLocation.dataSourceOwner')}</option>
						<option value="Customer">{$_('addLocation.dataSourceCustomer')}</option>
						<option value="Other">{$_('addLocation.dataSourceOther')}</option>
					</FormSelect>
					{#if source === 'Other'}
						<p class="my-2 text-justify text-sm">
							{$_('addLocation.dataSourceOtherPrompt')}
						</p>
						<textarea
							disabled={!captchaSecret || !mapLoaded}
							required
							name="source-other"
							placeholder={$_('addLocation.dataSourceOtherPlaceholder')}
							class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
							bind:value={sourceOther}
							bind:this={sourceOtherElement}
						/>
					{/if}
				</div>

				<div>
					<label for="contact" class="mb-2 block font-semibold">{$_('forms.contact')}</label>
					<p class="mb-2 text-justify text-sm">
						{$_('addLocation.contactDescription')}
					</p>
					<input
						disabled={!captchaSecret || !mapLoaded}
						required
						type="email"
						name="contact"
						placeholder={$_('addLocation.contactPlaceholder')}
						class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
						bind:this={contact}
					/>
				</div>

				<div>
					<div class="mb-2 flex items-center space-x-2">
						<label for="captcha" class="font-semibold"
							>{$_('forms.captcha')} <span class="font-normal">({$_('forms.captchaCaseSensitive')})</span></label
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
							placeholder={$_('addLocation.captchaPlaceholder')}
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
					{$_('forms.submitLocation')}
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
					<h2 class="mb-5 text-center text-3xl font-semibold md:text-left">{$_('addLocation.supertaggerHeading')}</h2>
					<p class="mb-10 w-full text-justify md:text-left">
						{$_('addLocation.supertaggerDescription')}
					</p>
					<img
						src="/images/supertagger.svg"
						alt={$_('addLocation.supertaggerImageAlt')}
						class="mx-auto mb-10 h-[220px] w-[220px]"
					/>
					<PrimaryButton
						style="w-full py-3 rounded-xl"
						link="https://gitea.btcmap.org/teambtcmap/btcmap-general/wiki/Tagging-Merchants#shadowy-supertaggers-"
						external={true}
					>
						{$_('addLocation.supertaggerWikiButton')}
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
