<script lang="ts">
import axios from "axios";
import DOMPurify from "dompurify";
import type {
	GeoJSONSource,
	MapGeoJSONFeature,
	Map as MapLibreMap,
	Marker as MapLibreMarker,
	MapMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { onDestroy, onMount } from "svelte";
import { get } from "svelte/store";

import FormHelperText from "$components/FormHelperText.svelte";
import FormSuccess from "$components/FormSuccess.svelte";
import AddressSearch from "$components/form/AddressSearch.svelte";
import FormSelect from "$components/form/FormSelect.svelte";
import OpeningHoursEditor from "$components/form/OpeningHoursEditor.svelte";
import Icon from "$components/Icon.svelte";
import HeaderPlaceholder from "$components/layout/HeaderPlaceholder.svelte";
import MapLoadingEmbed from "$components/MapLoadingEmbed.svelte";
import MapUnsupportedFallback from "$components/MapUnsupportedFallback.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import TextLink from "$components/TextLink.svelte";
import { API_BASE } from "$lib/api-base";
import { _, locale } from "$lib/i18n";
import { ensureRtlTextPlugin } from "$lib/map/rtl";
import { hasWebGL } from "$lib/map/webgl";
import { places } from "$lib/store";
import { theme } from "$lib/theme";
import { errToast } from "$lib/utils";

import { browser } from "$app/environment";
import { pushState } from "$app/navigation";
import { page } from "$app/stores";

const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/liberty";
const STYLE_DARK = "https://static.btcmap.org/map-styles/dark.json";

const styleUrlForTheme = (t: "light" | "dark" | undefined): string =>
	t === "dark" ? STYLE_DARK : STYLE_LIGHT;

type Step = "intro" | "online" | "map" | "update" | "new" | "success";
type WizardPageState = { wizardStep?: Step };

// The current step lives in the browser history via SvelteKit shallow routing,
// so the back/forward buttons move between wizard steps instead of leaving the
// page. Absent state (first load, SSR) means the intro step.
$: step = (($page.state as WizardPageState).wizardStep ?? "intro") as Step;

function goStep(next: Step) {
	pushState("", { wizardStep: next } satisfies WizardPageState);
}

// Each step is a fresh screen; start it at the top instead of inheriting the
// previous step's scroll position (e.g. the map's select button sits low).
$: if (browser) scrollToTop(step);
function scrollToTop(_step: Step) {
	window.scrollTo({ top: 0, behavior: "auto" });
}

// ---------------------------------------------------------------------------
// Captcha (shared across all forms)
// ---------------------------------------------------------------------------
let captchaContent = "";
let isCaptchaLoading = true;
let captchaSecret: string;

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

// ---------------------------------------------------------------------------
// Submission plumbing
// ---------------------------------------------------------------------------
let submitting = false;
let submissionIssueNumber: number;
let successType = "";
let successText = "";

function collectMethods(
	refs: Partial<Record<"onchain" | "lightning" | "nfc", HTMLInputElement>>,
): string[] {
	const methods: string[] = [];
	if (refs.onchain?.checked) methods.push("onchain");
	if (refs.lightning?.checked) methods.push("lightning");
	if (refs.nfc?.checked) methods.push("nfc");
	return methods;
}

async function submitIssue(payload: Record<string, unknown>): Promise<void> {
	submitting = true;
	try {
		const response = await axios.post("/api/gitea/issue", {
			captchaSecret,
			...payload,
		});
		submissionIssueNumber = response.data.number;
		goStep("success");
	} catch (error) {
		const message =
			axios.isAxiosError(error) && error.response?.data?.message
				? String(error.response.data.message)
				: "";
		if (message.includes("Captcha")) {
			errToast(message);
		} else {
			errToast(get(_)("errors.formSubmission"));
		}
		console.error(error);
	} finally {
		submitting = false;
	}
}

// ===========================================================================
// STEP: intro (physical location yes/no)
// ===========================================================================
function answerPhysical(hasPhysical: boolean) {
	goStep(hasPhysical ? "map" : "online");
}

// ===========================================================================
// STEP: online or mobile (no visitable location)
// ===========================================================================
let onlineName: HTMLInputElement;
let onlineWebsite: HTMLInputElement;
let onlineSocial: HTMLInputElement;
let onlineCategory: HTMLInputElement;
let onlineNotes: HTMLTextAreaElement;
let onlineContact: HTMLInputElement;
let onlineCaptcha: HTMLInputElement;
let onlineHoney: HTMLInputElement;
let onlineOnchain: HTMLInputElement;
let onlineLightning: HTMLInputElement;
let onlineNfc: HTMLInputElement;

function submitOnline(event: SubmitEvent) {
	event.preventDefault();
	const methods = collectMethods({
		onchain: onlineOnchain,
		lightning: onlineLightning,
		nfc: onlineNfc,
	});
	successType = get(_)("addLocationWizard.onlineSuccessType");
	successText = get(_)("addLocationWizard.onlineSuccessText");
	submitIssue({
		type: "online-or-mobile",
		captchaTest: onlineCaptcha.value,
		honey: onlineHoney.value,
		name: onlineName.value,
		website: onlineWebsite.value,
		socialLinks: onlineSocial.value,
		category: onlineCategory.value,
		methods: methods.toString(),
		notes: onlineNotes.value,
		contact: onlineContact.value,
	});
}

// ===========================================================================
// STEP: map (is the business already on the map?)
// ===========================================================================
type ExistingPlace = {
	id: number;
	name: string;
	address: string;
	lat: number;
	lon: number;
	osmType: string;
	osmId: string;
	osmUrl: string;
	website: string;
	phone: string;
	hours: string;
	twitter: string;
	facebook: string;
	instagram: string;
};

let existing: ExistingPlace | undefined;
let loadingExisting = false;

function osmTypeAndId(osmUrl: string, fallbackId: string): [string, string] {
	const m = osmUrl.match(/openstreetmap\.org\/([^/]+)\/(\d+)/);
	if (m) return [m[1], m[2]];
	return ["node", fallbackId];
}

async function selectExisting(placeId: number) {
	loadingExisting = true;
	try {
		const fields =
			"id,name,address,lat,lon,osm_id,osm_url,phone,website,opening_hours,twitter,facebook,instagram";
		const res = await axios.get(
			`${API_BASE}/v4/places/${placeId}?fields=${fields}`,
		);
		const p = res.data;
		const [osmType, osmId] = osmTypeAndId(
			p.osm_url ?? "",
			String(p.osm_id ?? placeId),
		);
		existing = {
			id: p.id,
			name: p.name ?? "",
			address: p.address ?? "",
			lat: p.lat,
			lon: p.lon,
			osmType,
			osmId,
			osmUrl: p.osm_url ?? "",
			website: p.website ?? "",
			phone: p.phone ?? "",
			hours: p.opening_hours ?? "",
			twitter: p.twitter ?? "",
			facebook: p.facebook ?? "",
			instagram: p.instagram ?? "",
		};
		updateHoursValue = existing.hours;
		goStep("update");
	} catch (error) {
		errToast(get(_)("errors.formSubmission"));
		console.error(error);
	} finally {
		loadingExisting = false;
	}
}

// ===========================================================================
// STEP: update (edit an existing OSM merchant)
// ===========================================================================
let updateWebsite: HTMLInputElement;
let updatePhone: HTMLInputElement;
let updateHoursValue = "";
let updateSocial: HTMLInputElement;
let updateNotes: HTMLTextAreaElement;
let updateContact: HTMLInputElement;
let updateCaptcha: HTMLInputElement;
let updateHoney: HTMLInputElement;
let updateOnchain: HTMLInputElement;
let updateLightning: HTMLInputElement;
let updateNfc: HTMLInputElement;

function submitUpdate(event: SubmitEvent) {
	event.preventDefault();
	if (!existing) return;
	const methods = collectMethods({
		onchain: updateOnchain,
		lightning: updateLightning,
		nfc: updateNfc,
	});
	successType = get(_)("addLocationWizard.updateSuccessType");
	successText = get(_)("addLocationWizard.updateSuccessText");
	submitIssue({
		type: "update-location",
		captchaTest: updateCaptcha.value,
		honey: updateHoney.value,
		name: existing.name,
		osmType: existing.osmType,
		osmId: existing.osmId,
		osm: existing.osmUrl,
		lat: String(existing.lat),
		long: String(existing.lon),
		website: updateWebsite.value,
		phone: updatePhone.value,
		hours: updateHoursValue,
		socialLinks: updateSocial.value,
		methods: methods.toString(),
		notes: updateNotes.value,
		contact: updateContact.value,
	});
}

// ===========================================================================
// STEP: new (new physical merchant)
// ===========================================================================
let newName: HTMLInputElement;
let newNameEn: HTMLInputElement;
let newAddress: HTMLInputElement;
let newLocationDescription: HTMLTextAreaElement;
let newCategory: HTMLInputElement;
let newWebsite: HTMLInputElement;
let newPhone: HTMLInputElement;
let newHoursValue = "";
let newNotes: HTMLTextAreaElement;
let newContact: HTMLInputElement;
let newCaptcha: HTMLInputElement;
let newHoney: HTMLInputElement;
let newOnchain: HTMLInputElement;
let newLightning: HTMLInputElement;
let newNfc: HTMLInputElement;
let newSource: "Business Owner" | "Customer" | "Other" | undefined;
let newSourceOther: string | undefined;
let addressFilledBySearch = false;

// A location description is the norm in regions that don't use street
// addresses; default the input order to the user's locale but keep both fields
// always available.
$: descriptionFirst = ["ja", "zh", "ko", "th", "vi", "hi"].includes(
	($locale ?? "en").split("-")[0],
);

let pickLat: number | undefined;
let pickLong: number | undefined;
let pinSelected = false;
let noPinError = false;
let noLocationTextError = false;
let noMethodError = false;

// "It's not on the map yet" — start a blank new-location form (no prefill).
function goToNew() {
	pinSelected = false;
	pickLat = undefined;
	pickLong = undefined;
	pickMarker = undefined;
	prefill = undefined;
	goStep("new");
}

// "This is my business" from a search result — carry the location and any OSM
// POI metadata into the new-location form and drop the pin there automatically.
function useSearchedLocation() {
	if (!searchedLocation) return;
	pickLat = Number(searchedLocation.lat.toFixed(5));
	pickLong = Number(searchedLocation.lng.toFixed(5));
	pinSelected = true;
	prefill = searchedLocation;
	pickMarker = undefined;
	goStep("new");
}

// Fill empty new-location form fields from a selected place. Never overwrites
// what the user has already typed.
function applyPlaceToForm(d: PlaceSelect) {
	const set = (
		el: HTMLInputElement | HTMLTextAreaElement | undefined,
		value: string | undefined,
	) => {
		if (el && value && !el.value) el.value = value;
	};
	if (newAddress && d.displayName && !newAddress.value) {
		newAddress.value = d.displayName;
		addressFilledBySearch = true;
	}
	set(newName, d.name);
	set(newCategory, d.category);
	set(newWebsite, d.website);
	set(newPhone, d.phone);
	if (d.openingHours && !newHoursValue) newHoursValue = d.openingHours;
}

function submitNew(event: SubmitEvent) {
	event.preventDefault();
	noPinError = false;
	noLocationTextError = false;
	noMethodError = false;

	if (!pinSelected) {
		noPinError = true;
		errToast(get(_)("errors.noLocationSelected"));
		return;
	}
	// Address OR description is required — one is enough.
	if (!newAddress.value.trim() && !newLocationDescription.value.trim()) {
		noLocationTextError = true;
		errToast(get(_)("addLocationWizard.locationTextError"));
		return;
	}
	const methods = collectMethods({
		onchain: newOnchain,
		lightning: newLightning,
		nfc: newNfc,
	});
	if (methods.length === 0) {
		noMethodError = true;
		errToast(get(_)("errors.noPaymentMethod"));
		return;
	}

	successType = get(_)("addLocationWizard.newSuccessType");
	successText = get(_)("addLocationWizard.newSuccessText");
	submitIssue({
		type: "add-location-wizard",
		captchaTest: newCaptcha.value,
		honey: newHoney.value,
		name: newName.value,
		nameEn: newNameEn.value,
		address: newAddress.value,
		locationDescription: newLocationDescription.value,
		lat: pickLat ? pickLat.toString() : "",
		long: pickLong ? pickLong.toString() : "",
		osm:
			pickLat && pickLong
				? `https://www.openstreetmap.org/edit#map=21/${pickLat}/${pickLong}`
				: "",
		category: newCategory.value,
		methods: methods.toString(),
		website: newWebsite.value,
		phone: newPhone.value,
		hours: newHoursValue,
		notes: newNotes.value,
		source: newSource,
		sourceOther: newSourceOther ?? "",
		contact: newContact.value,
	});
}

// ---------------------------------------------------------------------------
// Maps
// ---------------------------------------------------------------------------
let maplibreRef: typeof import("maplibre-gl") | undefined;
let webglUnsupported = false;
let destroyed = false;

// Discover map (step "map")
let discoverMap: MapLibreMap | undefined;
let discoverMapLoaded = false;

// Pick map (step "new")
let pickMap: MapLibreMap | undefined;
let pickMapLoaded = false;
let pickMarker: MapLibreMarker | undefined;

// A geocoded search result (with any OSM POI metadata). Dropping a marker for it
// makes the searched place selectable even when it isn't yet a BTC Map merchant
// (no orange dot), so the user can confirm "this is my business" and add it.
type PlaceSelect = {
	lat: number;
	lng: number;
	displayName: string;
	name?: string;
	category?: string;
	website?: string;
	phone?: string;
	openingHours?: string;
	osmType?: string;
	osmId?: string;
};
let searchMarker: MapLibreMarker | undefined;
let searchedLocation: PlaceSelect | undefined;
// Data carried from a search into the new-location form, applied once mounted.
let prefill: PlaceSelect | undefined;

async function ensureMaplibre(): Promise<
	typeof import("maplibre-gl") | undefined
> {
	if (!hasWebGL()) {
		webglUnsupported = true;
		return undefined;
	}
	if (!maplibreRef) {
		const maplibre = await import("maplibre-gl");
		ensureRtlTextPlugin(maplibre);
		maplibreRef = maplibre;
	}
	return maplibreRef;
}

function placesGeoJson() {
	const all = get(places);
	return {
		type: "FeatureCollection" as const,
		features: all
			.filter((p) => p.lat != null && p.lon != null)
			.map((p) => ({
				type: "Feature" as const,
				geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
				properties: { id: p.id, name: p.name ?? "" },
			})),
	};
}

async function initDiscoverMap(node: HTMLDivElement) {
	const maplibre = await ensureMaplibre();
	if (!maplibre || destroyed) return;

	discoverMap = new maplibre.Map({
		container: node,
		style: styleUrlForTheme($theme),
		center: [0, 20],
		zoom: 1.5,
		maxZoom: 21,
		attributionControl: { compact: true },
	});
	discoverMap.addControl(new maplibre.NavigationControl({}), "top-right");
	discoverMap.addControl(
		new maplibre.GeolocateControl({
			positionOptions: { enableHighAccuracy: true },
			trackUserLocation: true,
			fitBoundsOptions: { maxZoom: 15 },
		}),
		"top-right",
	);

	discoverMap.on("load", () => {
		if (!discoverMap) return;
		discoverMap.addSource("places", {
			type: "geojson",
			data: placesGeoJson(),
		});
		discoverMap.addLayer({
			id: "places-layer",
			type: "circle",
			source: "places",
			paint: {
				"circle-radius": 6,
				"circle-color": "#f7931a",
				"circle-stroke-width": 2,
				"circle-stroke-color": "#ffffff",
			},
		});
		discoverMap.on("click", "places-layer", (e) => {
			const feature = e.features?.[0] as MapGeoJSONFeature | undefined;
			const id = feature?.properties?.id;
			if (id != null) selectExisting(Number(id));
		});
		discoverMap.on("mouseenter", "places-layer", () => {
			if (discoverMap) discoverMap.getCanvas().style.cursor = "pointer";
		});
		discoverMap.on("mouseleave", "places-layer", () => {
			if (discoverMap) discoverMap.getCanvas().style.cursor = "";
		});
		discoverMapLoaded = true;
	});
}

function handleDiscoverSearch(e: CustomEvent<PlaceSelect>) {
	if (!discoverMap) return;
	searchedLocation = e.detail;
	// Drop / move a distinct (blue) marker at the search result so it's visible
	// and selectable, separate from the orange BTC Map dots.
	if (maplibreRef) {
		if (searchMarker) {
			searchMarker.setLngLat([e.detail.lng, e.detail.lat]);
		} else {
			searchMarker = new maplibreRef.Marker({ color: "#2563eb" })
				.setLngLat([e.detail.lng, e.detail.lat])
				.addTo(discoverMap);
		}
	}
	discoverMap.flyTo({
		center: [e.detail.lng, e.detail.lat],
		zoom: 16,
		duration: 800,
	});
}

async function initPickMap(node: HTMLDivElement) {
	const maplibre = await ensureMaplibre();
	if (!maplibre || destroyed) return;

	pickMap = new maplibre.Map({
		container: node,
		style: styleUrlForTheme($theme),
		center: [0, 20],
		zoom: 1.5,
		maxZoom: 21,
		attributionControl: { compact: true },
	});
	pickMap.addControl(new maplibre.NavigationControl({}), "top-right");
	pickMap.addControl(
		new maplibre.GeolocateControl({
			positionOptions: { enableHighAccuracy: true },
			trackUserLocation: true,
			fitBoundsOptions: { maxZoom: 15 },
		}),
		"top-right",
	);
	pickMap.on("click", (e: MapMouseEvent) => {
		placePin(e.lngLat.lat, e.lngLat.lng, false);
	});
	pickMap.on("load", () => {
		pickMapLoaded = true;
		// Re-drop a pin carried over from a search result / previous step.
		if (pinSelected && pickLat != null && pickLong != null) {
			placePin(pickLat, pickLong, true);
		}
	});
}

function placePin(lat: number, lng: number, fly: boolean) {
	pickLat = Number(lat.toFixed(5));
	pickLong = Number(lng.toFixed(5));
	pinSelected = true;
	noPinError = false;
	if (!maplibreRef || !pickMap) return;
	if (pickMarker) {
		pickMarker.setLngLat([pickLong, pickLat]);
	} else {
		pickMarker = new maplibreRef.Marker()
			.setLngLat([pickLong, pickLat])
			.addTo(pickMap);
	}
	if (fly) {
		pickMap.flyTo({ center: [pickLong, pickLat], zoom: 17, duration: 800 });
	}
}

function handlePickSearch(e: CustomEvent<PlaceSelect>) {
	placePin(e.detail.lat, e.detail.lng, true);
	// Refresh the address if untouched or previously search-filled, then fill any
	// other empty fields (name/category/contact) from the OSM POI.
	if (newAddress && (newAddress.value.trim() === "" || addressFilledBySearch)) {
		newAddress.value = e.detail.displayName;
		addressFilledBySearch = true;
	}
	applyPlaceToForm(e.detail);
}

// Svelte actions bind map init to the step container's lifecycle.
function discoverMapPortal(node: HTMLDivElement) {
	initDiscoverMap(node);
	return {
		destroy() {
			discoverMap?.remove();
			discoverMap = undefined;
			discoverMapLoaded = false;
			searchMarker = undefined;
		},
	};
}

function pickMapPortal(node: HTMLDivElement) {
	initPickMap(node);
	return {
		destroy() {
			pickMap?.remove();
			pickMap = undefined;
			pickMapLoaded = false;
			pickMarker = undefined;
		},
	};
}

// Refresh the places overlay if the store finishes loading after the map.
$: if (discoverMapLoaded && $places.length) {
	const src = discoverMap?.getSource("places") as GeoJSONSource | undefined;
	src?.setData(placesGeoJson());
}

// Theme sync for whichever map is mounted.
$: if (discoverMap && discoverMapLoaded)
	discoverMap.setStyle(styleUrlForTheme($theme));
$: if (pickMap && pickMapLoaded) pickMap.setStyle(styleUrlForTheme($theme));

// Apply search-derived place data once the new-location form is mounted
// (newName is bound only after the step renders).
$: if (step === "new" && prefill && newName) {
	applyPlaceToForm(prefill);
	prefill = undefined;
}

onMount(() => {
	if (browser) fetchCaptcha();
});

onDestroy(() => {
	destroyed = true;
	discoverMap?.remove();
	pickMap?.remove();
});

function restart() {
	existing = undefined;
	pinSelected = false;
	pickLat = undefined;
	pickLong = undefined;
	pickMarker = undefined;
	searchMarker = undefined;
	searchedLocation = undefined;
	prefill = undefined;
	newHoursValue = "";
	updateHoursValue = "";
	fetchCaptcha();
	goStep("intro");
}

const inputClass =
	"w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/[0.15] dark:disabled:bg-gray-700 dark:disabled:text-gray-400";
</script>

<svelte:head>
	<title>BTC Map - {$_('addLocationWizard.title')}</title>
	<meta property="og:image" content="https://btcmap.org/images/og/add.png" />
	<meta property="og:title" content="BTC Map - {$_('addLocationWizard.title')}" />
</svelte:head>

{#if typeof window !== 'undefined'}
	<h1
		class="{$theme === 'dark'
			? 'text-white'
			: 'gradient'} mt-10 text-center text-4xl font-semibold md:text-5xl"
	>
		{$_('addLocationWizard.title')}
	</h1>
{:else}
	<HeaderPlaceholder />
{/if}

<div class="mx-auto mt-12 max-w-2xl pb-20 text-primary md:pb-32 dark:text-white">
	{#if step === 'intro'}
		<!-- STEP 1: physical location? -->
		<h2 class="mb-6 text-center text-2xl font-semibold md:text-3xl">
			{$_('addLocationWizard.physicalQuestion')}
		</h2>
		<p class="mb-10 text-center text-lg">{$_('addLocationWizard.physicalHint')}</p>
		<div class="mx-auto flex max-w-md flex-col gap-4 sm:flex-row">
			<PrimaryButton style="w-full py-3 rounded-xl" type="button" on:click={() => answerPhysical(true)}>
				{$_('addLocationWizard.yes')}
			</PrimaryButton>
			<PrimaryButton style="w-full py-3 rounded-xl" type="button" on:click={() => answerPhysical(false)}>
				{$_('addLocationWizard.no')}
			</PrimaryButton>
		</div>

	{:else if step === 'online'}
		<!-- STEP: online or mobile business -->
		<h2 class="mb-4 text-2xl font-semibold md:text-3xl">
			{$_('addLocationWizard.onlineHeading')}
		</h2>
		<p class="mb-8">{$_('addLocationWizard.onlineIntro')}</p>
		<form on:submit={submitOnline} class="w-full space-y-5">
			<div>
				<label for="online-name" class="mb-2 block font-semibold">{$_('forms.merchantName')}</label>
				<input id="online-name" required class={inputClass} bind:this={onlineName} disabled={!captchaSecret} />
			</div>
			<div>
				<label for="online-website" class="mb-2 block font-semibold">{$_('forms.website')}</label>
				<input id="online-website" type="url" required class={inputClass} bind:this={onlineWebsite} disabled={!captchaSecret} />
			</div>
			<div>
				<label for="online-social" class="mb-2 block font-semibold">
					{$_('addLocationWizard.socialLabel')}
					<span class="font-normal">{$_('forms.optional')}</span>
				</label>
				<input id="online-social" class={inputClass} bind:this={onlineSocial} disabled={!captchaSecret} placeholder={$_('addLocationWizard.socialPlaceholder')} />
			</div>
			<div>
				<label for="online-category" class="mb-2 block font-semibold">{$_('forms.category')}</label>
				<input id="online-category" class={inputClass} bind:this={onlineCategory} disabled={!captchaSecret} />
			</div>
			<fieldset>
				<legend class="mb-2 block font-semibold">{$_('addLocation.paymentMethodsLegend')}</legend>
				<div class="space-y-3">
					<label class="block"><input type="checkbox" class="mr-2 h-4 w-4 accent-link" bind:this={onlineOnchain} />{$_('addLocation.onchainLabel')}</label>
					<label class="block"><input type="checkbox" class="mr-2 h-4 w-4 accent-link" bind:this={onlineLightning} />{$_('addLocation.lightningLabel')}</label>
					<label class="block"><input type="checkbox" class="mr-2 h-4 w-4 accent-link" bind:this={onlineNfc} />{$_('addLocation.nfcLabel')}</label>
				</div>
			</fieldset>
			<div>
				<label for="online-notes" class="mb-2 block font-semibold">
					{$_('forms.notes')} <span class="font-normal">{$_('forms.optional')}</span>
				</label>
				<textarea id="online-notes" rows="3" class={inputClass} bind:this={onlineNotes} disabled={!captchaSecret} />
			</div>
			<div>
				<label for="online-contact" class="mb-2 block font-semibold">{$_('forms.contact')}</label>
				<p class="mb-2 text-sm">{$_('addLocation.contactDescription')}</p>
				<input id="online-contact" type="email" required class={inputClass} bind:this={onlineContact} disabled={!captchaSecret} />
			</div>
			<div class="hidden"><input bind:this={onlineHoney} name="honey" placeholder="A nice pot of honey." /></div>
			<div>
				<div class="mb-2 flex items-center space-x-2">
					<label for="online-captcha" class="font-semibold">{$_('forms.captcha')} <span class="font-normal">({$_('forms.captchaCaseSensitive')})</span></label>
					{#if captchaSecret}<button type="button" on:click={fetchCaptcha}><Icon type="fa" icon="arrows-rotate" w="16" h="16" /></button>{/if}
				</div>
				<div class="flex items-center justify-center rounded-2xl border-2 border-input py-1">
					{#if isCaptchaLoading}<div class="h-[100px] w-[275px] animate-pulse bg-link/50" />{:else}{@html captchaContent}{/if}
				</div>
				<input id="online-captcha" required class="{inputClass} mt-2" bind:this={onlineCaptcha} disabled={!captchaSecret} />
			</div>
			<PrimaryButton loading={submitting} disabled={submitting || !captchaSecret} style="w-full py-3 rounded-xl">{$_('forms.submit')}</PrimaryButton>
		</form>

	{:else if step === 'map'}
		<!-- STEP: already on the map? -->
		<h2 class="mb-4 text-2xl font-semibold md:text-3xl">{$_('addLocationWizard.mapHeading')}</h2>
		<p class="mb-4">{$_('addLocationWizard.mapIntro')}</p>
		<div class="mb-3">
			<AddressSearch disabled={!discoverMapLoaded} locale={$locale ?? 'en'} on:select={handleDiscoverSearch} />
		</div>
		<div class="relative mb-4">
			<div use:discoverMapPortal class="z-10 h-[350px] w-full rounded-2xl border-2 border-input md:h-[450px]" />
			{#if webglUnsupported}
				<MapUnsupportedFallback />
			{:else if !discoverMapLoaded}
				<MapLoadingEmbed style="h-[350px] md:h-[450px] border-2 border-input rounded-2xl" />
			{/if}
			{#if loadingExisting}
				<div class="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/30">
					<span class="rounded-lg bg-white px-4 py-2 font-semibold text-primary">{$_('addLocationWizard.loadingPlace')}</span>
				</div>
			{/if}
		</div>
		<p class="mb-4 text-center text-sm text-primary/80 dark:text-white/70">{$_('addLocationWizard.mapClickHint')}</p>
		{#if searchedLocation}
			<div class="mb-6 rounded-2xl border-2 border-link/40 bg-link/5 p-4">
				<p class="mb-1 text-sm text-primary/80 dark:text-white/70">{$_('addLocationWizard.searchedResultLabel')}</p>
				<p class="mb-3 font-semibold">{searchedLocation.displayName}</p>
				<PrimaryButton style="w-full py-2 rounded-xl" type="button" on:click={useSearchedLocation}>{$_('addLocationWizard.useSearchedLocation')}</PrimaryButton>
			</div>
		{/if}
		<div class="flex flex-col gap-4 sm:flex-row">
			<button type="button" class="font-semibold text-link hover:text-hover" on:click={() => history.back()}>← {$_('addLocationWizard.back')}</button>
			<PrimaryButton style="w-full py-3 rounded-xl" type="button" on:click={goToNew}>{$_('addLocationWizard.notOnMap')}</PrimaryButton>
		</div>

	{:else if step === 'update' && existing}
		<!-- STEP: update existing merchant -->
		<h2 class="mb-2 text-2xl font-semibold md:text-3xl">{existing.name || $_('addLocationWizard.updateHeading')}</h2>
		<p class="mb-2 text-sm text-primary/80 dark:text-white/70">{existing.address}</p>
		<p class="mb-6">
			{$_('addLocationWizard.updateIntro')}
			{#if existing.osmUrl}<TextLink link={existing.osmUrl} external>OSM {existing.osmType}/{existing.osmId}</TextLink>{/if}
		</p>
		<form on:submit={submitUpdate} class="w-full space-y-5">
			<div>
				<label for="update-website" class="mb-2 block font-semibold">{$_('forms.website')}</label>
				<input id="update-website" type="url" class={inputClass} bind:this={updateWebsite} value={existing.website} disabled={!captchaSecret} />
			</div>
			<div>
				<label for="update-phone" class="mb-2 block font-semibold">{$_('forms.phone')}</label>
				<input id="update-phone" type="tel" class={inputClass} bind:this={updatePhone} value={existing.phone} disabled={!captchaSecret} />
			</div>
			<div>
				<p class="mb-2 block font-semibold">{$_('forms.openingHours')}</p>
				<OpeningHoursEditor bind:value={updateHoursValue} disabled={!captchaSecret} />
			</div>
			<div>
				<label for="update-social" class="mb-2 block font-semibold">
					{$_('addLocationWizard.socialLabel')} <span class="font-normal">{$_('forms.optional')}</span>
				</label>
				<input id="update-social" class={inputClass} bind:this={updateSocial} placeholder={$_('addLocationWizard.socialPlaceholder')} disabled={!captchaSecret} />
			</div>
			<fieldset>
				<legend class="mb-2 block font-semibold">{$_('addLocationWizard.updatePaymentLegend')}</legend>
				<div class="space-y-3">
					<label class="block"><input type="checkbox" class="mr-2 h-4 w-4 accent-link" bind:this={updateOnchain} />{$_('addLocation.onchainLabel')}</label>
					<label class="block"><input type="checkbox" class="mr-2 h-4 w-4 accent-link" bind:this={updateLightning} />{$_('addLocation.lightningLabel')}</label>
					<label class="block"><input type="checkbox" class="mr-2 h-4 w-4 accent-link" bind:this={updateNfc} />{$_('addLocation.nfcLabel')}</label>
				</div>
			</fieldset>
			<div>
				<label for="update-notes" class="mb-2 block font-semibold">
					{$_('forms.notes')} <span class="font-normal">{$_('forms.optional')}</span>
				</label>
				<textarea id="update-notes" rows="3" class={inputClass} bind:this={updateNotes} disabled={!captchaSecret} />
			</div>
			<div>
				<label for="update-contact" class="mb-2 block font-semibold">{$_('forms.contact')}</label>
				<input id="update-contact" type="email" required class={inputClass} bind:this={updateContact} disabled={!captchaSecret} />
			</div>
			<div class="hidden"><input bind:this={updateHoney} name="honey" placeholder="A nice pot of honey." /></div>
			<div>
				<div class="mb-2 flex items-center space-x-2">
					<label for="update-captcha" class="font-semibold">{$_('forms.captcha')} <span class="font-normal">({$_('forms.captchaCaseSensitive')})</span></label>
					{#if captchaSecret}<button type="button" on:click={fetchCaptcha}><Icon type="fa" icon="arrows-rotate" w="16" h="16" /></button>{/if}
				</div>
				<div class="flex items-center justify-center rounded-2xl border-2 border-input py-1">
					{#if isCaptchaLoading}<div class="h-[100px] w-[275px] animate-pulse bg-link/50" />{:else}{@html captchaContent}{/if}
				</div>
				<input id="update-captcha" required class="{inputClass} mt-2" bind:this={updateCaptcha} disabled={!captchaSecret} />
			</div>
			<PrimaryButton loading={submitting} disabled={submitting || !captchaSecret} style="w-full py-3 rounded-xl">{$_('forms.submit')}</PrimaryButton>
		</form>

	{:else if step === 'new'}
		<!-- STEP: new physical merchant -->
		<h2 class="mb-4 text-2xl font-semibold md:text-3xl">{$_('addLocationWizard.newHeading')}</h2>
		<p class="mb-8">{$_('addLocationWizard.newIntro')}</p>
		<form on:submit={submitNew} class="w-full space-y-5">
			<div>
				<label for="new-name" class="mb-2 block font-semibold">{$_('forms.merchantName')}</label>
				<input id="new-name" required class={inputClass} bind:this={newName} disabled={!captchaSecret} />
			</div>
			<div>
				<label for="new-name-en" class="mb-2 block font-semibold">
					{$_('addLocation.nameEnLabel')} <span class="font-normal">{$_('forms.optional')}</span>
				</label>
				<input id="new-name-en" class={inputClass} bind:this={newNameEn} disabled={!captchaSecret} />
			</div>

			<div>
				<label class="mb-2 block font-semibold" for="new-map">{$_('forms.selectLocation')}</label>
				{#if noPinError}<span class="mb-2 block font-semibold text-error">{$_('addLocation.noLocationError')}</span>{/if}
				<div class="mb-3">
					<AddressSearch disabled={!pickMapLoaded} locale={$locale ?? 'en'} on:select={handlePickSearch} />
				</div>
				<div class="relative mb-2">
					<div id="new-map" use:pickMapPortal class="z-10 h-[300px] w-full !cursor-crosshair rounded-2xl border-2 border-input md:h-[400px]" />
					{#if webglUnsupported}
						<MapUnsupportedFallback />
					{:else if !pickMapLoaded}
						<MapLoadingEmbed style="h-[300px] md:h-[400px] border-2 border-input rounded-2xl" />
					{/if}
				</div>
				{#if pinSelected}
					<p class="text-sm text-primary/80 dark:text-white/70">{pickLat}, {pickLong}</p>
				{/if}
			</div>

			<!-- Address OR description: one required. Order adapts to locale. -->
			<div class="flex flex-col gap-5" class:flex-col-reverse={descriptionFirst}>
				<div>
					<div class="mb-2">
						<label for="new-address" class="block font-semibold">{$_('addLocation.addressLabel')}</label>
						<FormHelperText text={$_('addLocationWizard.addressOrDescriptionHint')} />
					</div>
					<input id="new-address" class={inputClass} bind:this={newAddress} on:input={() => (addressFilledBySearch = false)} disabled={!captchaSecret} placeholder={$_('addLocation.addressPlaceholder')} />
				</div>
				<div>
					<label for="new-location-desc" class="mb-2 block font-semibold">{$_('addLocationWizard.locationDescriptionLabel')}</label>
					<FormHelperText text={$_('addLocationWizard.locationDescriptionHint')} />
					<textarea id="new-location-desc" rows="2" class={inputClass} bind:this={newLocationDescription} disabled={!captchaSecret} placeholder={$_('addLocationWizard.locationDescriptionPlaceholder')} />
				</div>
			</div>
			{#if noLocationTextError}<span class="block font-semibold text-error">{$_('addLocationWizard.locationTextError')}</span>{/if}

			<div>
				<label for="new-category" class="mb-2 block font-semibold">{$_('forms.category')}</label>
				<input id="new-category" class={inputClass} bind:this={newCategory} disabled={!captchaSecret} />
			</div>
			<fieldset>
				<legend class="mb-2 block font-semibold">{$_('addLocation.paymentMethodsLegend')}</legend>
				{#if noMethodError}<span class="mb-2 block font-semibold text-error">{$_('addLocation.paymentMethodError')}</span>{/if}
				<div class="space-y-3">
					<label class="block"><input type="checkbox" class="mr-2 h-4 w-4 accent-link" bind:this={newOnchain} on:click={() => (noMethodError = false)} />{$_('addLocation.onchainLabel')}</label>
					<label class="block"><input type="checkbox" class="mr-2 h-4 w-4 accent-link" bind:this={newLightning} on:click={() => (noMethodError = false)} />{$_('addLocation.lightningLabel')}</label>
					<label class="block"><input type="checkbox" class="mr-2 h-4 w-4 accent-link" bind:this={newNfc} on:click={() => (noMethodError = false)} />{$_('addLocation.nfcLabel')}</label>
				</div>
			</fieldset>
			<div>
				<label for="new-website" class="mb-2 block font-semibold">{$_('forms.website')} <span class="font-normal">{$_('forms.optional')}</span></label>
				<input id="new-website" type="url" class={inputClass} bind:this={newWebsite} disabled={!captchaSecret} />
			</div>
			<div>
				<label for="new-phone" class="mb-2 block font-semibold">{$_('forms.phone')} <span class="font-normal">{$_('forms.optional')}</span></label>
				<input id="new-phone" type="tel" class={inputClass} bind:this={newPhone} disabled={!captchaSecret} />
			</div>
			<div>
				<p class="mb-2 block font-semibold">{$_('forms.openingHours')} <span class="font-normal">{$_('forms.optional')}</span></p>
				<OpeningHoursEditor bind:value={newHoursValue} disabled={!captchaSecret} />
			</div>
			<div>
				<label for="new-notes" class="mb-2 block font-semibold">{$_('forms.notes')} <span class="font-normal">{$_('forms.optional')}</span></label>
				<textarea id="new-notes" rows="3" class={inputClass} bind:this={newNotes} disabled={!captchaSecret} />
			</div>
			<div>
				<label for="new-source" class="mb-2 block font-semibold">{$_('addLocation.dataSourceLabel')}</label>
				<FormSelect id="new-source" name="source" required bind:value={newSource} disabled={!captchaSecret}>
					<option value="">{$_('addLocation.dataSourcePlaceholder')}</option>
					<option value="Business Owner">{$_('addLocation.dataSourceOwner')}</option>
					<option value="Customer">{$_('addLocation.dataSourceCustomer')}</option>
					<option value="Other">{$_('addLocation.dataSourceOther')}</option>
				</FormSelect>
				{#if newSource === 'Other'}
					<textarea class="{inputClass} mt-2" required bind:value={newSourceOther} placeholder={$_('addLocation.dataSourceOtherPlaceholder')} />
				{/if}
			</div>
			<div>
				<label for="new-contact" class="mb-2 block font-semibold">{$_('forms.contact')}</label>
				<p class="mb-2 text-sm">{$_('addLocation.contactDescription')}</p>
				<input id="new-contact" type="email" required class={inputClass} bind:this={newContact} disabled={!captchaSecret} />
			</div>
			<div class="hidden"><input bind:this={newHoney} name="honey" placeholder="A nice pot of honey." /></div>
			<div>
				<div class="mb-2 flex items-center space-x-2">
					<label for="new-captcha" class="font-semibold">{$_('forms.captcha')} <span class="font-normal">({$_('forms.captchaCaseSensitive')})</span></label>
					{#if captchaSecret}<button type="button" on:click={fetchCaptcha}><Icon type="fa" icon="arrows-rotate" w="16" h="16" /></button>{/if}
				</div>
				<div class="flex items-center justify-center rounded-2xl border-2 border-input py-1">
					{#if isCaptchaLoading}<div class="h-[100px] w-[275px] animate-pulse bg-link/50" />{:else}{@html captchaContent}{/if}
				</div>
				<input id="new-captcha" required class="{inputClass} mt-2" bind:this={newCaptcha} disabled={!captchaSecret} />
			</div>
			<PrimaryButton loading={submitting} disabled={submitting || !captchaSecret} style="w-full py-3 rounded-xl">{$_('forms.submitLocation')}</PrimaryButton>
		</form>

	{:else if step === 'success'}
		<FormSuccess type={successType} text={successText} issue={submissionIssueNumber} on:click={restart} />
	{/if}
</div>
