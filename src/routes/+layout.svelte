<script lang="ts">
import { SvelteToast } from "@zerodevx/svelte-toast";

import LoadingIndicator from "$components/LoadingIndicator.svelte";
import Header from "$components/layout/Header.svelte";
import { trackBrowserLanguage } from "$lib/analytics";
import { session } from "$lib/session";
import {
	placesLoadingProgress,
	placesLoadingStatus,
	syncStatus,
} from "$lib/store";
import { elementsSync } from "$lib/sync/places";
import { theme } from "$lib/theme";

import { browser, dev } from "$app/environment";
import "leaflet.locatecontrol/dist/L.Control.Locate.min.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet/dist/leaflet.css";
import localforage from "localforage";
import { onDestroy, onMount } from "svelte";
import "tippy.js/dist/tippy.css";
import "../app.css";

import { isLoading, locale } from "svelte-i18n";

import Footer from "$components/layout/Footer.svelte";
import { isSupportedLocale } from "$lib/i18n";

import { page } from "$app/stores";

// Apply language from URL param site-wide (e.g. /map?language=bg for embedded maps).
// On /communities/map, ?communityLang= filters communities; ?language= sets UI locale.
$: if (browser) {
	const langParam = $page.url.searchParams.get("language");
	if (langParam && isSupportedLocale(langParam)) {
		locale.set(langParam);
		localStorage.setItem("language", langParam);
	}
}

// Update HTML lang attribute dynamically when locale changes
$: if (browser && $locale) {
	document.documentElement.lang = $locale;
}

const options = {
	reversed: true,
	intro: { y: 192 },
	pausable: true,
};

let layoutSyncVisible = false;
let layoutLoadingStatus = "";

$: {
	// Show sync progress only while actively loading (1-99%), hide when complete (100%)
	if ($placesLoadingProgress > 0 && $placesLoadingProgress < 100) {
		layoutSyncVisible = true;
		layoutLoadingStatus = $placesLoadingStatus;
	} else {
		layoutSyncVisible = false;
		layoutLoadingStatus = "";
	}
}

let dataSyncInterval: ReturnType<typeof setInterval>;

onMount(async () => {
	// Initialize theme from SSR/data attribute or localStorage
	theme.init();

	// Restore saved session (throwaway account + saved places) from localStorage
	session.init();

	// Track browser language for translation insights
	trackBrowserLanguage();

	localforage.config({
		name: "BTC Map",
		description:
			"The Times 03/Jan/2009 Chancellor on brink of second bailout for banks",
	});

	const dataSync = async () => {
		$syncStatus = true;

		// Load places (map is primary use case)
		// Other syncs (events, users, areas, reports) are lazy-loaded by pages that need them
		await elementsSync();

		$syncStatus = false;
	};

	dataSync();
	dataSyncInterval = setInterval(dataSync, 600000);
});

onDestroy(() => {
	clearInterval(dataSyncInterval);
});

export let data;
</script>

<svelte:head>
	<meta
		name="lightning"
		content="lnurlp:LNURL1DP68GURN8GHJ7CM0WFJJUCN5VDKKZUPWDAEXWTMVDE6HYMRS9ARKXVN4W5EQPSYZ34"
	/>
	<meta property="alby:image" content="/images/logo.svg" />
	<meta property="alby:name" content="BTC Map" />
	<!-- Umami Analytics - privacy-focused, no cookies, production only -->
	{#if !dev}
		<script
			defer
			src="https://umami.btcmap.org/script.js"
			data-website-id="01d98748-38ef-4cda-b7d9-6eaece0f74bd"
		></script>
	{/if}
</svelte:head>

{#if $isLoading}
	<LoadingIndicator visible={$isLoading} status="Loading..." />
{:else}
	{#if !['/', '/map', '/communities/map', '/communities', '/countries'].includes(data.pathname)}
		<div class="bg-teal dark:bg-dark">
			<Header />
			<main class="mx-auto w-10/12 xl:w-[1200px]">
				<LoadingIndicator visible={layoutSyncVisible} status={layoutLoadingStatus} progress={$placesLoadingProgress} />
				<slot />
				<Footer />
			</main>
		</div>
	{:else}
		<main>
			<slot />
		</main>
	{/if}

	<SvelteToast {options} />
{/if}

<style>
	:root {
		--toastContainerTop: auto;
		--toastContainerRight: auto;
		--toastContainerBottom: 8rem;
		--toastContainerLeft: calc(50vw - 8rem);
	}
</style>
