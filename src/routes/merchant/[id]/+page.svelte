<script lang="ts">
export let data: MerchantPageData;

import "maplibre-gl/dist/maplibre-gl.css";

import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { onDestroy, onMount } from "svelte";
import Time from "svelte-time";
import tippy from "tippy.js";

import Boost from "$components/Boost.svelte";
import BoostButton from "$components/BoostButton.svelte";
import Card from "$components/Card.svelte";
import CompanionAppPill from "$components/CompanionAppPill.svelte";
import Icon from "$components/Icon.svelte";
import MapLoadingEmbed from "$components/MapLoadingEmbed.svelte";
import MapUnsupportedFallback from "$components/MapUnsupportedFallback.svelte";
import PaymentMethodPills from "$components/PaymentMethodPills.svelte";
import PrimaryButton from "$components/PrimaryButton.svelte";
import ShowTags from "$components/ShowTags.svelte";
import TaggerSkeleton from "$components/TaggerSkeleton.svelte";
import TaggingIssues from "$components/TaggingIssues.svelte";
import { _, getDisplayLang, locale } from "$lib/i18n";
import {
	ensureSprite,
	installPlaceholderHandler,
} from "$lib/map/maplibreSprites";
import { hasWebGL } from "$lib/map/webgl";
import { placesById } from "$lib/store";
import { theme } from "$lib/theme";
import type { MerchantActivityEvent, MerchantPageData } from "$lib/types";
import { formatVerifiedHuman, isBoosted } from "$lib/utils";
import { isRecentlyVerified } from "$lib/verification";

import CommentAddButton from "./components/CommentAddButton.svelte";
import MerchantActionChips from "./components/MerchantActionChips.svelte";
import MerchantComment from "./components/MerchantComment.svelte";
import MerchantDetailsPanel from "./components/MerchantDetailsPanel.svelte";
import MerchantEvent from "./components/MerchantEvent.svelte";
import MerchantHero from "./components/MerchantHero.svelte";
import MerchantTabs from "./components/MerchantTabs.svelte";
import { browser } from "$app/environment";

const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/liberty";
const STYLE_DARK = "https://static.btcmap.org/map-styles/dark.json";

const styleUrlForTheme = (t: "light" | "dark" | undefined): string =>
	t === "dark" ? STYLE_DARK : STYLE_LIGHT;

type MerchantFeatureProps = {
	id: number;
	icon: string;
	boosted: boolean;
	comments: number;
};

type MerchantFeatureCollection = {
	type: "FeatureCollection";
	features: Array<{
		type: "Feature";
		geometry: { type: "Point"; coordinates: [number, number] };
		properties: MerchantFeatureProps;
	}>;
};

const EMPTY_COLLECTION: MerchantFeatureCollection = {
	type: "FeatureCollection",
	features: [],
};

let dataInitialized = false;
let initialRenderComplete = false;
let destroyed = false;
let styleLoaded = false;
let lastAppliedTheme: "light" | "dark" | undefined;

const currentIcon = (): string =>
	data.placeData.deleted_at
		? "skull"
		: icon && icon !== "question_mark"
			? icon
			: "currency_bitcoin";

const buildFeatureCollection = (): MerchantFeatureCollection => {
	if (typeof lat !== "number" || typeof long !== "number")
		return EMPTY_COLLECTION;
	return {
		type: "FeatureCollection",
		features: [
			{
				type: "Feature",
				geometry: { type: "Point", coordinates: [long, lat] },
				properties: {
					id: Number(data.id),
					icon: currentIcon(),
					boosted: !!boosted,
					comments: comments.length,
				},
			},
		],
	};
};

const loadCommentBadgeSprite = (m: MapLibreMap): void => {
	if (m.hasImage("comment-badge-bg")) return;
	// 2× rasterization for crispness on retina/phone DPRs — see /map's
	// equivalent for rationale.
	const SIZE = 16;
	const SCALE = 2;
	const canvas = document.createElement("canvas");
	canvas.width = SIZE * SCALE;
	canvas.height = SIZE * SCALE;
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	ctx.fillStyle = "#16A34A";
	ctx.beginPath();
	ctx.arc(
		(SIZE * SCALE) / 2,
		(SIZE * SCALE) / 2,
		(SIZE * SCALE) / 2,
		0,
		Math.PI * 2,
	);
	ctx.fill();
	m.addImage(
		"comment-badge-bg",
		ctx.getImageData(0, 0, SIZE * SCALE, SIZE * SCALE),
		{ pixelRatio: SCALE },
	);
};

const addMerchantLayers = (m: MapLibreMap) => {
	if (!m.getSource("merchant")) {
		m.addSource("merchant", {
			type: "geojson",
			data: EMPTY_COLLECTION,
		});
	}

	if (!m.getLayer("merchant-pin")) {
		m.addLayer({
			id: "merchant-pin",
			type: "symbol",
			source: "merchant",
			layout: {
				"icon-image": [
					"concat",
					"pin-",
					["case", ["coalesce", ["get", "boosted"], false], "b", "r"],
					"-",
					["coalesce", ["get", "icon"], "currency_bitcoin"],
				],
				"icon-size": 1,
				"icon-anchor": "bottom",
				"icon-allow-overlap": true,
				"icon-ignore-placement": true,
				"icon-rotation-alignment": "viewport",
				"icon-pitch-alignment": "viewport",
			},
		});
	}

	if (!m.getLayer("merchant-comment-badge")) {
		m.addLayer({
			id: "merchant-comment-badge",
			type: "symbol",
			source: "merchant",
			filter: [">", ["coalesce", ["get", "comments"], 0], 0],
			layout: {
				"icon-image": "comment-badge-bg",
				"icon-size": 1,
				"icon-allow-overlap": true,
				"icon-ignore-placement": true,
				"icon-rotation-alignment": "viewport",
				"icon-pitch-alignment": "viewport",
				"icon-offset": [10, -36],
			},
		});
	}

	if (!m.getLayer("merchant-comment-badge-count")) {
		m.addLayer({
			id: "merchant-comment-badge-count",
			type: "symbol",
			source: "merchant",
			filter: [">", ["coalesce", ["get", "comments"], 0], 0],
			layout: {
				"text-field": ["to-string", ["coalesce", ["get", "comments"], 0]],
				"text-font": ["Noto Sans Bold"],
				"text-size": 11,
				"text-allow-overlap": true,
				"text-ignore-placement": true,
				"text-rotation-alignment": "viewport",
				"text-pitch-alignment": "viewport",
				"text-offset": [10 / 11, -36 / 11],
			},
			paint: {
				"text-color": "#fff",
			},
		});
	}
};

const syncMerchantSource = (m: MapLibreMap) => {
	const source = m.getSource("merchant") as GeoJSONSource | undefined;
	if (!source) return;
	source.setData(buildFeatureCollection());
	ensureSprite(m, currentIcon(), !!boosted);
};

// Sources + layers + sprites — called both on initial load AND on
// theme-driven style.load. Camera placement is intentionally NOT done
// here so theme swaps preserve the user's pan/zoom; centerOnMerchant
// is called from the initial-load path only.
const initializeMapContents = (m: MapLibreMap) => {
	loadCommentBadgeSprite(m);
	addMerchantLayers(m);
	syncMerchantSource(m);
};

const centerOnMerchant = (m: MapLibreMap) => {
	if (typeof lat === "number" && typeof long === "number") {
		m.jumpTo({ center: [long, lat], zoom: 16 });
	}
};

const applyTheme = (next: "light" | "dark" | undefined) => {
	if (!map) return;
	if (!styleLoaded) return;
	if (next === lastAppliedTheme) return;
	lastAppliedTheme = next;
	styleLoaded = false;
	const onStyleLoad = () => {
		if (!map) return;
		initializeMapContents(map);
		styleLoaded = true;
	};
	map.once("style.load", onStyleLoad);
	map.setStyle(styleUrlForTheme(next));
};

const initializeMap = async () => {
	if (dataInitialized) return;
	dataInitialized = true;

	if (!hasWebGL()) {
		webglUnsupported = true;
		return;
	}
	const maplibre = await import("maplibre-gl");
	if (destroyed) return;

	lastAppliedTheme = $theme;

	map = new maplibre.Map({
		container: mapElement,
		style: styleUrlForTheme($theme),
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

	installPlaceholderHandler(map);

	map.on("load", () => {
		if (!map) return;
		initializeMapContents(map);
		centerOnMerchant(map);
		styleLoaded = true;
		mapLoaded = true;
	});
};

// Kick off map init once the component has mounted in the browser.
$: if (initialRenderComplete && !dataInitialized) {
	initializeMap();
}

$: if (map && styleLoaded) {
	applyTheme($theme);
}

// merchant variable no longer needed - using server data directly

// Use server data directly via reactive declarations.
// Contact/social/hours/payment details are consumed straight from `data`
// inside MerchantDetailsPanel, so only the fields the page itself renders
// (hero, payment indicator, map, action chips) are mirrored here.
let icon: string | undefined;
let address: string | undefined;
let description: string | undefined;
let phone: string | undefined;
let paymentMethod: string | undefined;
let lat: number;
let long: number;
let merchantEvents: MerchantActivityEvent[] = [];
let name: string | undefined;

let localizedName: string | undefined;

$: localizedName = data.localizedName?.[getDisplayLang($locale)];

$: icon = data.icon;
$: address = data.address;
$: description = data.description;
$: phone = data.phone;
$: companionAppUrl =
	data.osmTags?.["payment:lightning:companion_app_url"] ||
	data.placeData.required_app_url;
$: paymentMethod = data.paymentMethod;
$: lat = data.lat;
$: long = data.lon;
$: merchantEvents = data.activity;
$: name = data.name;

$: displayName = localizedName || name || "BTC Map Merchant";
$: deletedAt = data.placeData.deleted_at;
$: heroIcon = deletedAt
	? "skull"
	: icon && icon !== "question_mark"
		? icon
		: "currency_bitcoin";

let boosted: string | undefined;

// Make comments reactive to server data updates (from invalidateAll() after adding comment)
let comments: typeof data.comments;
$: comments = data.comments;

$: verifiedAt = data.placeData?.verified_at;
// Make boosted reactive to both server data and store updates, but only if boost is still active
$: {
	const placeInStore = $placesById.get(Number(data.id));
	const mergedPlace = placeInStore || data.placeData;
	// Only set boosted if the place is actually boosted (expiry in future)
	boosted =
		mergedPlace && isBoosted(mergedPlace)
			? mergedPlace.boosted_until
			: undefined;
}
let verifiedTooltip: HTMLSpanElement;
let outdatedTooltip: HTMLSpanElement;

$: verifiedTooltip &&
	tippy([verifiedTooltip], {
		content: $_("verification.verifiedTooltip"),
	});

$: outdatedTooltip &&
	tippy([outdatedTooltip], {
		content: $_("verification.outdatedTooltip"),
	});

let eventCount = 50;
$: eventsPaginated = merchantEvents.slice(0, eventCount);

let mapElement: HTMLDivElement;
let map: MapLibreMap | undefined;
let mapLoaded = false;
let webglUnsupported = false;

onMount(async () => {
	if (browser) {
		initialRenderComplete = true;

		// Update localforage with fresh place data to sync comment counts, boosts, etc.
		// This ensures the map shows current data when navigating back
		try {
			const { updatePlaceInCache } = await import("$lib/sync/places");
			await updatePlaceInCache(data.placeData);
		} catch (error) {
			// Silent failure - page still works with server data even if cache update fails
			console.error("Could not update place in localforage:", error);
		}
	}
});

// Update marker source when boost / comment / icon state changes.
$: if (map && styleLoaded && (icon || boosted || comments)) {
	syncMerchantSource(map);
}

onDestroy(() => {
	destroyed = true;
	map?.remove();
	map = undefined;
});

const ogImage = `https://api.btcmap.org/og/element/${data.id}`;
</script>

<svelte:head>
	<title>{localizedName || name ? (localizedName || name) + ' - ' : ''}BTC Map - {$_('meta.merchant')}</title>
	<meta property="og:image" content={ogImage} />
	<meta property="og:title" content="{localizedName || name ? (localizedName || name) + ' - ' : ''}BTC Map - {$_('meta.merchant')}" />
	<meta name="twitter:title" content="{localizedName || name ? (localizedName || name) + ' - ' : ''}BTC Map - {$_('meta.merchant')}" />
	<meta name="twitter:image" content={ogImage} />
</svelte:head>

{#if data.placeData.deleted_at}
	<div class="bg-red-600 py-4 text-center text-white">
		<p class="text-lg font-semibold">
			<Icon w="20" h="20" class="mr-2 inline-block text-white" icon="skull" type="material" />
			{$_('merchant.deletedNotice')}
		</p>
		<p class="mt-1 text-sm">{$_('merchant.deletedDetail')}</p>
	</div>
{/if}
<div class="mx-auto my-10 max-w-xl space-y-4 px-4 text-left md:my-16">
	<MerchantHero
		id={data.id}
		name={displayName}
		{address}
		icon={heroIcon}
		{lat}
		{long}
		boosted={!!boosted}
		deleted={!!deletedAt}
	/>

	{#if paymentMethod || companionAppUrl}
		<div class="rounded-2xl border border-gray-300 p-4 dark:border-white/20 dark:bg-white/5">
			<div class="flex flex-wrap items-center gap-2">
				{#if paymentMethod}
					<PaymentMethodPills
						onchain={data.osmTags?.['payment:onchain']}
						lightning={data.osmTags?.['payment:lightning']}
						contactless={data.osmTags?.['payment:lightning_contactless']}
					/>
				{/if}
				{#if companionAppUrl}
					<CompanionAppPill url={companionAppUrl} />
				{/if}
			</div>
		</div>
	{/if}

	<MerchantActionChips
		merchantId={data.id}
		{lat}
		{long}
		{phone}
		osmEditUrl={data.osmEditUrl}
	/>

	{#if description}
		<p class="text-primary dark:text-white">{description}</p>
	{/if}

	<!-- Last surveyed / verify -->
	<Card headerAlign="center">
		<h3 slot="header" class="text-2xl font-semibold">{$_('verification.lastSurveyed')}</h3>

		<div slot="body" class="p-4">
			{#if verifiedAt}
				<div class="flex items-center justify-center dark:text-white">
					{#if isRecentlyVerified(verifiedAt)}
						<span bind:this={verifiedTooltip}>
							<Icon w="30" h="30" class="mr-2 text-primary dark:text-white" icon="verified" type="material" />
						</span>
					{:else}
						<span bind:this={outdatedTooltip}>
							<Icon w="30" h="30" class="mr-2 text-primary dark:text-white" icon="error_outline" type="material" />
						</span>
					{/if}
					<strong>{formatVerifiedHuman(verifiedAt)}</strong>
				</div>
			{:else}
				<p class="font-semibold dark:text-white">{$_('verification.notSurveyed')}</p>
			{/if}
		</div>

		<PrimaryButton slot="footer" link={`/verify-location?id=${data.id}`} style="rounded-xl p-3 w-40">
			{$_('verification.verifyLocation')}
		</PrimaryButton>
	</Card>

	<!-- Boost -->
	<div
		class="flex w-full flex-col rounded-3xl border border-amber-200 bg-amber-50/50 dark:border-amber-700/30 dark:bg-amber-900/10"
	>
		<div
			class="flex items-center justify-center gap-2 border-b border-amber-200 p-5 dark:border-amber-700/30"
		>
			<Icon
				w="20"
				h="20"
				class="text-amber-800 dark:text-amber-300"
				icon={boosted ? 'auto_awesome' : 'rocket_launch'}
				type="material"
			/>
			<h3 class="text-2xl font-semibold text-amber-800 dark:text-amber-300">
				{$_('boost.title')}
			</h3>
		</div>

		<div class="flex flex-1 flex-col justify-between gap-4">
			<div class="flex flex-col items-center gap-4 p-4">
				<p class="font-semibold text-amber-800 dark:text-amber-300">
					{boosted ? $_('boost.isBoosted') : $_('boost.getVisibility')}
				</p>
				{#if !boosted}
					<p class="text-sm text-amber-700 dark:text-amber-400/80">
						{$_('boost.boostPromo')}
					</p>
				{/if}

				{#if boosted}
					<p class="text-amber-700 dark:text-amber-400/80">
						{$_('boost.expires')}:
						<span class="font-semibold">
							<Time live={3000} relative={true} timestamp={boosted} />
						</span>
					</p>
				{/if}
			</div>

			<div class="flex justify-center pb-4">
				<BoostButton merchant={data.placeData} {boosted} />
			</div>
		</div>
	</div>

	<!-- Interactive location map (kept) -->
	<section id="map-section">
		<Card>
			<h3 slot="header" class="text-lg font-semibold">
				{$_('merchant.location', { values: { name: displayName } })}
			</h3>

			<div slot="body" class="w-full">
				<div class="relative overflow-hidden">
					<div
						bind:this={mapElement}
						class="z-10 h-[300px] rounded-b-3xl !bg-teal text-left md:h-[420px] dark:!bg-[#202f33]"
					/>
					{#if webglUnsupported}
						<MapUnsupportedFallback />
					{:else if !mapLoaded}
						<MapLoadingEmbed style="h-[300px] md:h-[420px]  rounded-b-3xl" />
					{/if}
				</div>
			</div>
		</Card>
	</section>

	<!-- Comments / Activity / Details -->
	<MerchantTabs commentsCount={comments.length} activityCount={merchantEvents.length}>
		<svelte:fragment slot="comments">
			<div class="mb-4 flex justify-center lg:justify-start">
				<CommentAddButton elementId={data.id} />
			</div>
			{#if comments && comments.length}
				<div class="divide-y divide-gray-200 dark:divide-white/10">
					{#each [...comments].reverse() as comment (comment.id)}
						<MerchantComment text={comment.text} time={comment['created_at']} compact />
					{/each}
				</div>
			{:else}
				<p class="text-body dark:text-white">{$_('comments.none')}</p>
			{/if}
		</svelte:fragment>

		<svelte:fragment slot="activity">
			{#if merchantEvents && merchantEvents.length}
				<div class="divide-y divide-gray-200 dark:divide-white/10">
					{#each eventsPaginated as event (event['created_at'])}
						<MerchantEvent
							action={event.type}
							user_id={event.user_id}
							user_name={event.user_name}
							user_tip={event.user_tip}
							time={event['created_at']}
							latest={event === merchantEvents[0]}
						/>
					{/each}
				</div>

				{#if eventsPaginated.length !== merchantEvents.length}
					<button
						class="mx-auto mt-4 block text-xl font-semibold text-link transition-colors hover:text-hover"
						on:click={() => (eventCount = eventCount + 50)}>{$_('info.loadMore')}</button
					>
				{/if}
			{:else if !dataInitialized}
				<div class="space-y-2">
					{#each Array(5) as _, i (i)}
						<TaggerSkeleton />
					{/each}
				</div>
			{:else}
				<p class="text-body dark:text-white">{$_('info.noActivity')}</p>
			{/if}
		</svelte:fragment>

		<svelte:fragment slot="details">
			<MerchantDetailsPanel {data} />
		</svelte:fragment>
	</MerchantTabs>

	<p class="text-sm text-body md:text-left dark:text-white">
		*More information on bitcoin mapping tags can be found <a
			href="https://wiki.btcmap.org/Tagging-Merchants#tagging-guidance"
			target="_blank"
			rel="noreferrer"
			class="text-link transition-colors hover:text-hover">here</a
		>.
	</p>
</div>

{#if browser}
	<Boost />
{/if}

<ShowTags />
<TaggingIssues />
