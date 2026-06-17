<script lang="ts">
import axios from "axios";
import DOMPurify from "dompurify";
import type {
	Map as MapLibreMap,
	Marker as MapLibreMarker,
	MapMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { onDestroy, onMount, tick } from "svelte";
import { get } from "svelte/store";

import FormHelperText from "$components/FormHelperText.svelte";
import FormSuccess from "$components/FormSuccess.svelte";
import AddressSearch from "$components/form/AddressSearch.svelte";
import FormSelect from "$components/form/FormSelect.svelte";
import Icon from "$components/Icon.svelte";
import HeaderPlaceholder from "$components/layout/HeaderPlaceholder.svelte";
import MapLoadingEmbed from "$components/MapLoadingEmbed.svelte";
import MapUnsupportedFallback from "$components/MapUnsupportedFallback.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import TextLink from "$components/TextLink.svelte";
import { _, locale } from "$lib/i18n";
import { hasWebGL } from "$lib/map/webgl";
import { theme } from "$lib/theme";
import { errToast, isValidLatitude, isValidLongitude } from "$lib/utils";

import { browser } from "$app/environment";

const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/liberty";
const STYLE_DARK = "https://static.btcmap.org/map-styles/dark.json";

const styleUrlForTheme = (t: "light" | "dark" | undefined): string =>
	t === "dark" ? STYLE_DARK : STYLE_LIGHT;

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
			errToast(get(_)("errors.captchaFetch"));
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
	latInput = "";
	longInput = "";
	latError = "";
	longError = "";
	showAdvanced = false;
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

async function initializeMap() {
	// Clean up any existing map (e.g. resetForm re-init).
	if (map) {
		map.remove();
		map = undefined;
	}
	marker?.remove();
	marker = undefined;
	mapLoaded = false;

	if (!hasWebGL()) {
		webglUnsupported = true;
		return;
	}
	const maplibre = await import("maplibre-gl");
	maplibreRef = maplibre;
	if (destroyed) return;

	lastAppliedTheme = $theme;

	map = new maplibre.Map({
		container: mapElement,
		style: styleUrlForTheme($theme),
		center: [0, 0],
		zoom: 2,
		maxZoom: 21,
		dragRotate: true,
		touchZoomRotate: true,
		pitchWithRotate: false,
		attributionControl: { compact: true },
	});

	map.addControl(
		new maplibre.NavigationControl({
			showCompass: true,
			showZoom: true,
			visualizePitch: false,
		}),
		"top-right",
	);

	const geolocateControl = new maplibre.GeolocateControl({
		positionOptions: { enableHighAccuracy: true },
		trackUserLocation: true,
		showUserLocation: true,
		showAccuracyCircle: true,
		fitBoundsOptions: { maxZoom: 15, linear: true },
	});
	map.addControl(geolocateControl, "top-right");

	map.on("click", (e: MapMouseEvent) => {
		if (!captchaSecret) return;
		placeMarker(e.lngLat.lat, e.lngLat.lng, {
			fly: false,
			syncInputs: true,
		});
	});

	map.on("load", () => {
		mapLoaded = true;
	});
}

let name: HTMLInputElement;
let address: HTMLInputElement;
let addressFilledBySearch = false;
let lat: number | undefined;
let long: number | undefined;
let selected = false;
let showAdvanced = false;
let latInput = "";
let longInput = "";
let latError = "";
let longError = "";
let marker: MapLibreMarker | undefined;
let maplibreRef: typeof import("maplibre-gl") | undefined;

function placeMarker(
	newLat: number,
	newLong: number,
	{ fly, syncInputs }: { fly: boolean; syncInputs: boolean },
) {
	// When syncing from a map click, snap to displayed precision so the
	// reactive parser's equality check (parsedLat !== lat) holds and we
	// don't re-emit a flyTo on the next tick.
	let finalLat = newLat;
	let finalLong = newLong;
	if (syncInputs) {
		latInput = newLat.toFixed(5);
		longInput = newLong.toFixed(5);
		finalLat = Number(latInput);
		finalLong = Number(longInput);
	}
	lat = finalLat;
	long = finalLong;
	selected = true;
	noLocationSelected = false;
	if (!maplibreRef || !map) return;
	if (marker) {
		marker.setLngLat([finalLong, finalLat]);
	} else {
		marker = new maplibreRef.Marker()
			.setLngLat([finalLong, finalLat])
			.addTo(map);
	}
	if (fly) {
		map.flyTo({ center: [finalLong, finalLat], zoom: 17, duration: 800 });
	}
}

function handleAddressSelect(
	e: CustomEvent<{ lat: number; lng: number; displayName: string }>,
) {
	const { lat, lng, displayName } = e.detail;
	placeMarker(lat, lng, { fly: true, syncInputs: true });
	// Fill the Address field if it's empty or was last filled by a previous
	// search. If the user has typed their own address, leave it alone.
	if (address && (address.value.trim() === "" || addressFilledBySearch)) {
		address.value = displayName;
		addressFilledBySearch = true;
	}
}

function toggleAdvanced() {
	showAdvanced = !showAdvanced;
	if (!showAdvanced) {
		// Leaving advanced mode: clear any error state and snap displayed
		// values to the same 5-dp precision used for read-only display.
		latError = "";
		longError = "";
		if (lat !== undefined) latInput = lat.toFixed(5);
		if (long !== undefined) longInput = long.toFixed(5);
	}
}
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

$: if (showAdvanced) {
	const trimmedLat = latInput.trim();
	const trimmedLong = longInput.trim();
	const parsedLat = trimmedLat === "" ? Number.NaN : Number(trimmedLat);
	const parsedLong = trimmedLong === "" ? Number.NaN : Number(trimmedLong);
	const latOk = isValidLatitude(parsedLat);
	const longOk = isValidLongitude(parsedLong);
	latError =
		trimmedLat !== "" && !latOk ? $_("addLocation.latitudeInvalid") : "";
	longError =
		trimmedLong !== "" && !longOk ? $_("addLocation.longitudeInvalid") : "";
	if (latOk && longOk && (parsedLat !== lat || parsedLong !== long)) {
		placeMarker(parsedLat, parsedLong, { fly: true, syncInputs: false });
	}
}

// If the user typed valid coords before the map finished loading,
// placeMarker() returned early (no map yet). Once the map is ready,
// drop the marker that's owed.
$: if (mapLoaded && lat !== undefined && long !== undefined && !marker) {
	placeMarker(lat, long, { fly: true, syncInputs: false });
}

const submitForm = (event: SubmitEvent) => {
	event.preventDefault();
	if (!selected) {
		noLocationSelected = true;
		errToast(get(_)("errors.noLocationSelected"));
	} else if (!onchain.checked && !lightning.checked && !nfc.checked) {
		noMethodSelected = true;
		errToast(get(_)("errors.noPaymentMethod"));
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
					errToast(get(_)("errors.formSubmission"));
				}
				console.error(error);
				submitting = false;
			});
	}
};

// location picker map
let mapElement: HTMLDivElement;
let map: MapLibreMap | undefined;
let mapLoaded = false;
let webglUnsupported = false;
let destroyed = false;
let lastAppliedTheme: "light" | "dark" | undefined;

onMount(async () => {
	if (browser) {
		// fetch and add captcha
		fetchCaptcha();

		// Initialize the map
		await initializeMap();
	}
});

onDestroy(() => {
	destroyed = true;
	if (map) {
		map.remove();
		map = undefined;
	}
});

const applyTheme = (next: "light" | "dark" | undefined) => {
	if (!map || !mapLoaded) return;
	if (next === lastAppliedTheme) return;
	lastAppliedTheme = next;
	// setStyle preserves added markers (managed outside the style) but drops
	// any source/layer overrides. We don't add custom layers here, so a plain
	// setStyle() is sufficient.
	map.setStyle(styleUrlForTheme(next));
};

$: if (map && mapLoaded) {
	applyTheme($theme);
}
</script>

<svelte:head>
	<title>BTC Map - {$_('addLocation.title')}</title>
	<meta property="og:image" content="https://btcmap.org/images/og/add.png" />
	<meta property="og:title" content="BTC Map - {$_('addLocation.title')}" />
	<meta name="twitter:title" content="BTC Map - {$_('addLocation.title')}" />
	<meta name="twitter:image" content="https://btcmap.org/images/og/add.png" />
</svelte:head>

{#if !submitted}
	{#if typeof window !== 'undefined'}
		<h1
			class="{$theme === 'dark'
				? 'text-white'
				: 'gradient'} mt-10 text-center text-4xl font-semibold md:text-5xl"
		>
			{$_('addLocation.title')}
		</h1>
	{:else}
		<HeaderPlaceholder />
	{/if}

	<p class="mt-10 text-center text-2xl font-semibold text-primary md:text-3xl dark:text-white">
		{$_('addLocation.subheading')}
	</p>

	<p class="mt-10 text-center text-lg font-semibold text-primary md:text-xl dark:text-white">
		{$_('addLocation.businessOwner')} <TextLink
			link="https://wiki.btcmap.org/Merchant-Best-Practices"
			external>{$_('addLocation.bestPractices')}</TextLink
		> {$_('addLocation.guide')}
	</p>

	<div class="mt-16 pb-20 md:pb-32 lg:flex lg:justify-between lg:gap-10">
		<section id="form" class="mx-auto w-full lg:w-1/2 lg:border-r lg:border-input lg:pr-10">
			<div class="mx-auto max-w-xl">
				<h2
					class="mb-5 text-center text-3xl font-semibold text-primary md:text-left dark:text-white"
				>
					{$_('addLocation.heading')}
				</h2>

				<div class="mb-10 w-full text-justify text-primary dark:text-white">
					<p>
						{$_('addLocation.description')}
					</p>
					<FormHelperText text={$_('addLocation.tooltip')} />
				</div>
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
					{#if noLocationSelected}
						<span class="font-semibold text-error">{$_('addLocation.noLocationError')}</span>
					{/if}
						<p class="mt-2 mb-1 text-sm font-semibold text-primary/80 dark:text-white/80">
							{$_('addLocation.searchByAddressLabel')}
						</p>
						<div class="mb-3">
							<AddressSearch
								disabled={!captchaSecret || !mapLoaded}
								locale={$locale ?? 'en'}
								on:select={handleAddressSelect}
							/>
						</div>
						<p class="mt-2 mb-1 text-sm font-semibold text-primary/80 dark:text-white/80">
							{$_('addLocation.orSelectOnMapLabel')}
						</p>
						<div class="relative mb-2">
							<div
								bind:this={mapElement}
								class="z-10 h-[300px] !cursor-crosshair rounded-2xl border-2 border-input !bg-teal md:h-[400px] dark:!bg-dark"
							/>
							{#if webglUnsupported}
								<MapUnsupportedFallback />
							{:else if !mapLoaded}
								<MapLoadingEmbed style="h-[300px] md:h-[400px] border-2 border-input rounded-2xl" />
							{/if}
						</div>
						<div class="flex space-x-2">
							<div class="w-full">
								<input
									id="lat"
									aria-label={$_('addLocation.latitude')}
									aria-invalid={!!latError}
									aria-describedby={latError ? 'lat-error' : undefined}
									readonly={!showAdvanced}
									bind:value={latInput}
									type="text"
									inputmode="decimal"
									name="lat"
									placeholder={$_('addLocation.latitude')}
									class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link read-only:cursor-default read-only:bg-gray-100 read-only:text-gray-500 dark:bg-white/[0.15] dark:read-only:bg-gray-700 dark:read-only:text-gray-400"
								/>
								{#if latError}
									<span id="lat-error" class="block font-semibold text-error">
										{latError}
									</span>
								{/if}
							</div>
							<div class="w-full">
								<input
									id="long"
									aria-label={$_('addLocation.longitude')}
									aria-invalid={!!longError}
									aria-describedby={longError ? 'long-error' : undefined}
									readonly={!showAdvanced}
									bind:value={longInput}
									type="text"
									inputmode="decimal"
									name="long"
									placeholder={$_('addLocation.longitude')}
									class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link read-only:cursor-default read-only:bg-gray-100 read-only:text-gray-500 dark:bg-white/[0.15] dark:read-only:bg-gray-700 dark:read-only:text-gray-400"
								/>
								{#if longError}
									<span id="long-error" class="block font-semibold text-error">
										{longError}
									</span>
								{/if}
							</div>
						</div>
						<div class="mt-2">
							<button
								type="button"
								class="text-sm font-semibold text-link hover:text-hover focus:outline-link"
								aria-expanded={showAdvanced}
								on:click={toggleAdvanced}
							>
								{showAdvanced ? '▾' : '▸'} {$_('addLocation.advancedToggle')}
							</button>
							{#if showAdvanced}
								<p class="mt-2 text-sm text-primary/80 dark:text-white/70">
									{$_('addLocation.advancedHint')}
								</p>
							{/if}
						</div>
					</div>

				<div>
					
					
					<div class="mb-10 w-full text-justify text-primary dark:text-white">
						<p>
							{$_('addLocation.addressLabel')}
						</p>
						<FormHelperText text={$_('addLocation.addressTooltip')} />
					</div>
					
					<input
						disabled={!captchaSecret || !mapLoaded}
						type="text"
						name="address"
						id="address"
						placeholder={$_('addLocation.addressPlaceholder')}
						class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
						bind:this={address}
						on:input={() => (addressFilledBySearch = false)}
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
						>{$_('forms.website')} <span class="font-normal">{$_('forms.optional')}</span></label
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
						>{$_('forms.phone')} <span class="font-normal">{$_('forms.optional')}</span></label
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
						>{$_('forms.openingHours')} <span class="font-normal">{$_('forms.optional')}</span></label
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
						>{$_('forms.notes')} <span class="font-normal">{$_('forms.optional')}</span></label
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
						link="https://wiki.btcmap.org/Tagging-Merchants#shadowy-supertaggers-"
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
		type={$_("addLocation.formSuccessType")}
		text={$_("addLocation.formSuccessText")}
		issue={submissionIssueNumber}
		on:click={resetForm}
	/>
{/if}
