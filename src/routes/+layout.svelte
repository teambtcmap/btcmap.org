<script lang="ts">
import localforage from "localforage";
import { onDestroy, onMount } from "svelte";
import { Toaster } from "svelte-sonner";

import { startActivityPolling } from "#lib/activityNotifier.js";
import { trackBrowserLanguage } from "#lib/analytics.js";
import { session } from "#lib/session.js";
import {
	placesLoadingProgress,
	placesLoadingStatus,
	syncStatus,
} from "#lib/store.js";
import { elementsSync } from "#lib/sync/places.js";
import { theme } from "#lib/theme.js";
import LoadingIndicator from "$components/LoadingIndicator.svelte";
import Header from "$components/layout/Header.svelte";

import { dev } from "$app/env";
import "#lib/icons/registerOfflineIcons.js";
import "tippy.js/dist/tippy.css";
import "../app.css";

import { _, isLoading } from "svelte-i18n";

import { isSupportedLocale, locale, localeFailed } from "#lib/i18n/index.js";
import Footer from "$components/layout/Footer.svelte";

import type { LayoutProps } from "./$types";
import { afterNavigate } from "$app/navigation";
import { page } from "$app/state";

let { data, children }: LayoutProps = $props();

// Apply language from URL param site-wide (e.g. /map?language=bg for embedded maps).
// On /communities/map, ?communityLang= filters communities; ?language= sets UI locale.
// afterNavigate fires on mount and after every client-side navigation — the
// same cadence the old `$: if (browser)` block with its $page store dep had
// (a bare page.url read in a legacy $: would only ever run once).
afterNavigate(() => {
	const langParam = page.url.searchParams.get("language");
	if (langParam && isSupportedLocale(langParam)) {
		locale.set(langParam);
		localStorage.setItem("language", langParam);
	}
});

// Update HTML lang attribute dynamically when locale changes. Effects never
// run during SSR, so the old `browser &&` guard is dropped.
$effect(() => {
	if ($locale) document.documentElement.lang = $locale;
});

// Show sync progress only while actively loading (1-99%), hide when complete (100%)
const layoutSyncVisible = $derived(
	$placesLoadingProgress > 0 && $placesLoadingProgress < 100,
);
const layoutLoadingStatus = $derived(
	layoutSyncVisible ? $placesLoadingStatus : null,
);

let dataSyncInterval: ReturnType<typeof setInterval>;
let stopActivityPolling: (() => void) | null = null;

onMount(async () => {
	// Initialize theme from SSR/data attribute or localStorage
	theme.init();

	// Restore saved session (throwaway account + saved places) from localStorage
	session.init();

	// Start the saved-activity background poller. Internally subscribes to
	// the session store; no-ops while logged out or while no items are saved.
	stopActivityPolling = startActivityPolling(session);

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
		// Other syncs (events, users, areas) are lazy-loaded by pages that need them
		await elementsSync();

		$syncStatus = false;
	};

	dataSync();
	dataSyncInterval = setInterval(dataSync, 600000);
});

onDestroy(() => {
	clearInterval(dataSyncInterval);
	stopActivityPolling?.();
});
</script>

<svelte:head>
	{#if !data.pathname.startsWith('/community/') && !data.pathname.startsWith('/country/')}
		<meta
			name="description"
			content="Find places to spend sats wherever you are."
		/>
		<meta
			name="twitter:description"
			content="Find places to spend sats wherever you are."
		/>
		<meta
			property="og:description"
			content="Find places to spend sats wherever you are."
		/>
	{/if}
	{#if ['/map', '/communities/map'].includes(data.pathname)}
		<!-- Fullscreen map routes have no scrollbar; skip the reserved gutter so the map fills the viewport -->
		<style>html { scrollbar-gutter: auto; }</style>
	{/if}
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

<!-- No locale file could load: no $_ either, so plain English and a reload button.
     No locale yet (a failed load, until the fallback texts are in): any $_ would throw. -->
{#if $localeFailed}
	<div class="min-h-screen bg-teal dark:bg-dark">
		<div class="mx-auto w-10/12 space-y-6 py-20 text-center xl:w-[1200px]">
			<img src="/images/logo.svg" alt="BTC Map" class="mx-auto w-32" />
			<h1 class="text-2xl font-semibold text-primary dark:text-white">BTC Map could not load its texts</h1>
			<p class="text-primary dark:text-white">Please check your connection and reload the page.</p>
			<button
				type="button"
				class="text-xl font-semibold text-link transition-colors hover:text-hover"
				onclick={() => location.reload()}>Reload</button
			>
		</div>
	</div>
{:else if $isLoading || !$locale}
	<LoadingIndicator visible status="Loading..." />
{:else}
	{#if !['/', '/map', '/communities/map', '/communities', '/countries'].includes(data.pathname)}
		<div class="bg-teal dark:bg-dark">
			<Header />
			<main class="mx-auto w-full px-4 xl:w-[1200px] xl:px-0">
				<LoadingIndicator
					visible={layoutSyncVisible}
					status={layoutLoadingStatus ? $_(layoutLoadingStatus.key, { values: layoutLoadingStatus.values }) : ""}
					progress={$placesLoadingProgress}
				/>
				{@render children()}
				<Footer />
			</main>
		</div>
	{:else}
		<main>
			{@render children()}
		</main>
	{/if}

	<!-- 8rem bottom clearance keeps toasts above the map's bottom UI (same
	     offset the previous svelte-toast container used); expand keeps
	     concurrent toasts fully readable instead of collapsed behind the
	     front one — the activity page can fire 3 error toasts at once -->
	<Toaster
		position="bottom-center"
		richColors
		closeButton
		expand
		theme={$theme}
		offset={{ bottom: "8rem" }}
		mobileOffset={{ bottom: "8rem" }}
	/>
{/if}
