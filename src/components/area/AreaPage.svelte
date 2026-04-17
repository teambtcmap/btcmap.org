<script lang="ts">
import { _ } from "svelte-i18n";

import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import { page } from "$app/stores";

export let type: "country" | "community";
export let data: AreaPageProps;

import rewind from "@mapbox/geojson-rewind";
import { geoContains } from "d3-geo";
import { differenceInMonths } from "date-fns/differenceInMonths";
import { onMount } from "svelte";

import AreaActivity from "$components/area/AreaActivity.svelte";
import AreaMap from "$components/area/AreaMap.svelte";
import AreaMerchantHighlights from "$components/area/AreaMerchantHighlights.svelte";
import AreaStats from "$components/area/AreaStats.svelte";
import AreaTickets from "$components/area/AreaTickets.svelte";
import VerifyCommunityForm from "$components/area/VerifyCommunityForm.svelte";
import Boost from "$components/Boost.svelte";
import Icon from "$components/Icon.svelte";
import IssuesTable from "$components/IssuesTable.svelte";
import OrgBadge from "$components/OrgBadge.svelte";
import SaveButton from "$components/SaveButton.svelte";
import Socials from "$components/Socials.svelte";
import SponsorBadge from "$components/SponsorBadge.svelte";
import Tip from "$components/Tip.svelte";
import { API_BASE } from "$lib/api-base";
import api from "$lib/axios";
import {
	areaError,
	areas,
	eventError,
	places,
	placesError,
	reportError,
	reports,
	userError,
} from "$lib/store";
import { areasSync } from "$lib/sync/areas";
import { batchSync } from "$lib/sync/batchSync";
import { eventsSync } from "$lib/sync/events";
import { reportsSync } from "$lib/sync/reports";
import { usersSync } from "$lib/sync/users";
import type {
	AreaPageProps,
	AreaTags,
	Place,
	RpcIssue,
	Tagger,
} from "$lib/types.js";
import { TipType } from "$lib/types.js";
import {
	errToast,
	formatVerifiedHuman,
	parseDateSafely,
	validateContinents,
} from "$lib/utils";

onMount(() => {
	batchSync([areasSync, reportsSync, eventsSync, usersSync]);
});

// alert for user errors
$: $userError && errToast($userError);
// alert for event errors
$: $eventError && errToast($eventError);
// alert for element errors
$: $placesError && errToast($placesError);
// alert for area errors
$: $areaError && errToast($areaError);
// alert for report errors
$: $reportError && errToast($reportError);

enum Sections {
	merchants = "merchants",
	stats = "stats",
	activity = "activity",
	maintain = "maintain",
}

const sectionKeys: Record<Sections, string> = {
	[Sections.merchants]: "area.sections.merchants",
	[Sections.stats]: "area.sections.stats",
	[Sections.activity]: "area.sections.activity",
	[Sections.maintain]: "area.sections.maintain",
};

const sections = Object.values(Sections);
let scrolled = false;

// Map section names to URL-friendly slugs
const sectionSlugs: Record<Sections, string> = {
	[Sections.merchants]: "merchants",
	[Sections.stats]: "stats",
	[Sections.activity]: "activity",
	[Sections.maintain]: "maintain",
};

// Reverse mapping from slugs to sections
const slugToSection: Record<string, Sections> = {
	merchants: Sections.merchants,
	stats: Sections.stats,
	activity: Sections.activity,
	maintain: Sections.maintain,
};

// Get the current section from the route parameter
$: currentSection = $page.params.section || "merchants";
$: activeSection = slugToSection[currentSection] || Sections.merchants;

// Handle section change
const handleSectionChange = (section: Sections) => {
	const slug = sectionSlugs[section];
	const areaId = encodeURIComponent(data.id);
	goto(`/${type}/${areaId}/${slug}`);
};

// No need for hash handling anymore - sections are handled by route parameters

let dataInitialized = false;
// Two flags: taggersInFlight prevents re-fire during the async fetch,
// taggersLoaded gates the UI so the skeleton stays up until the fetch
// completes. Per-request transient failures are handled by axiosRetry
// on the shared $lib/axios instance, so a single attempt is sufficient.
let taggersInFlight = false;
let taggersLoaded = false;

const fetchAreaTopEditors = async () => {
	if (taggersInFlight || taggersLoaded || !data?.id) return;

	// Capture the area id at start. If the user navigates to a different area
	// mid-fetch, the lastAreaId reactive resets our flags but cannot cancel an
	// in-flight promise; without this guard the stale completion would
	// overwrite the new area's taggers and stomp its loading state.
	const startAreaId = data.id;
	taggersInFlight = true;
	try {
		const url = `${API_BASE}/v4/areas/${encodeURIComponent(data.id)}/top-editors?limit=100`;
		const response = await api.get<Tagger[]>(url);
		if (data.id !== startAreaId) return;
		taggers = response.data;
	} catch (error) {
		if (data.id !== startAreaId) return;
		console.warn("Failed to fetch area top editors:", error);
	} finally {
		// Only flip flags if we're still the current area. Stale completions
		// return silently above; the new area's fetch owns its own state.
		// Mark loaded after any completed attempt (success OR final failure
		// after axiosRetry exhausts its retries) so the UI falls through to
		// the empty state instead of hanging on the skeleton. User can retry
		// by navigating to a different area (lastAreaId reactive resets
		// taggersLoaded).
		if (data.id === startAreaId) {
			taggersLoaded = true;
			taggersInFlight = false;
		}
	}
};

const initializeData = async () => {
	if (dataInitialized) return;

	const areaFound = $areas.find((area) => {
		if (type === "community") {
			return (
				area.id === data.id &&
				area.tags.type === "community" &&
				area.tags.geo_json &&
				area.tags.name &&
				area.tags["icon:square"] &&
				area.tags.continent
			);
		} else {
			return (
				area.id === data.id &&
				area.tags.type === "country" &&
				area.id.length === 2 &&
				area.tags.geo_json &&
				area.tags.name &&
				area.tags.continent &&
				validateContinents(area.tags.continent)
			);
		}
	});

	if (!areaFound) {
		console.error(
			`Could not find ${type}, please try again or contact BTC Map.`,
		);
		goto("/404");
		return;
	}

	area = areaFound.tags;

	avatar =
		type === "community"
			? `https://btcmap.org/.netlify/images?url=${area["icon:square"]}&fit=cover&w=256&h=256`
			: `https://static.btcmap.org/images/countries/${areaFound.id}.svg`;
	description = area.description;

	if (type === "community") {
		org = area.organization;
		sponsor = area.sponsor;
		website = area["contact:website"];
		email = area["contact:email"];
		phone = area["contact:phone"];
		nostr = area["contact:nostr"];
		twitter = area["contact:twitter"];
		meetup = area["contact:meetup"];
		telegram = area["contact:telegram"];
		discord = area["contact:discord"];
		youtube = area["contact:youtube"];
		github = area["contact:github"];
		matrix = area["contact:matrix"];
		geyser = area["contact:geyser"];
		satlantis = area["contact:satlantis"];
		eventbrite = area["contact:eventbrite"];
		reddit = area["contact:reddit"];
		simplex = area["contact:simplex"];
		instagram = area["contact:instagram"];
		whatsapp = area["contact:whatsapp"];
		facebook = area["contact:facebook"];
		linkedin = area["contact:linkedin"];
		rss = area["contact:rss"];
		signal = area["contact:signal"];
		hasContact = !!(
			website ||
			email ||
			phone ||
			nostr ||
			twitter ||
			meetup ||
			telegram ||
			discord ||
			youtube ||
			github ||
			matrix ||
			geyser ||
			satlantis ||
			eventbrite ||
			reddit ||
			simplex ||
			instagram ||
			whatsapp ||
			facebook ||
			linkedin ||
			rss ||
			signal
		);
		verifiedDate = data.verifiedDate || area["verified:date"];
		isVerifiedDateStale = calculateStaleness(verifiedDate);

		if (area["tips:lightning_address"]) {
			lightning = {
				destination: area["tips:lightning_address"],
				type: TipType.Address,
			};
		} else if (area["tips:url"]) {
			lightning = { destination: area["tips:url"], type: TipType.Url };
		}
	}

	const rewoundPoly = rewind(area.geo_json, true);

	// For AreaMap, filter places from client store
	filteredPlaces = $places.filter((place: Place) => {
		if (geoContains(rewoundPoly, [place.lon, place.lat])) {
			return true;
		} else {
			return false;
		}
	});

	issues = data.issues;

	dataInitialized = true;
};

// Reset area-scoped state when the user navigates client-side to a different area.
// SvelteKit reuses the +page.svelte instance (and this AreaPage) across
// /country/X/* → /country/Y/* transitions, and initializeData has an early
// `if (dataInitialized) return` guard — so without this reset the previous area's
// state would leak into the next one. Must run before the initializeData reactive
// below so dataInitialized=false is observed on the same tick.
let lastAreaId: string | undefined;
$: if (data?.id !== lastAreaId) {
	lastAreaId = data.id;
	dataInitialized = false;
	taggersInFlight = false;
	taggersLoaded = false;
	taggers = [];
	filteredPlaces = [];
}

$: $areas?.length && $places?.length && !dataInitialized && initializeData();

// Fire the area top-editors fetch only when the user actually lands on /activity.
// One REST call replaces the previous per-place enrichment shim.
$: if (
	browser &&
	activeSection === Sections.activity &&
	!taggersInFlight &&
	!taggersLoaded
) {
	fetchAreaTopEditors();
}

// Calculate areaReports reactively based on data initialization and reports store
// Returns undefined while loading, empty array if no reports for this area, or filtered reports
$: areaReports =
	dataInitialized && data?.id && $reports.length > 0
		? $reports
				.filter((report) => report.area_id === data.id)
				.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
		: undefined;

let area: AreaTags;
let filteredPlaces: Place[] = [];

let avatar: string;
const alias = data.id;
const name = data.name;
let description: string | undefined;
let org: string | undefined;
let sponsor: boolean | undefined;
let website: string | undefined;
let email: string | undefined;
let phone: string | undefined;
let nostr: string | undefined;
let twitter: string | undefined;
let meetup: string | undefined;
let telegram: string | undefined;
let discord: string | undefined;
let youtube: string | undefined;
let github: string | undefined;
let matrix: string | undefined;
let geyser: string | undefined;
let satlantis: string | undefined;
let eventbrite: string | undefined;
let reddit: string | undefined;
let simplex: string | undefined;
let instagram: string | undefined;
let whatsapp: string | undefined;
let facebook: string | undefined;
let linkedin: string | undefined;
let rss: string | undefined;
let signal: string | undefined;
let verifiedDate: string | undefined = data.verifiedDate;
let hasContact = false;

const calculateStaleness = (dateStr: string | undefined): boolean => {
	if (!dateStr) return false;
	const date = parseDateSafely(dateStr);
	if (!date) return false;
	return differenceInMonths(new Date(), date) > 12;
};

let isVerifiedDateStale: boolean = calculateStaleness(data.verifiedDate);
let lightning: { destination: string; type: TipType } | undefined;

let taggers: Tagger[] = [];

let issues: RpcIssue[] = [];
</script>

<main class="my-10 space-y-16 text-center md:my-20">
	<section id="profile" class="space-y-8">
		<div class="space-y-2">
			{#if avatar}
				<img
					src={avatar}
					alt={$_('aria.avatarAlt')}
					class="mx-auto h-32 w-32 rounded-full object-cover"
					on:error={function () {
						this.src = '/images/bitcoin.svg';
					}}
				/>
			{:else}
				<div class="mx-auto h-32 w-32 animate-pulse rounded-full bg-link/50" />
			{/if}
			<h1 class="text-4xl !leading-tight font-semibold text-primary dark:text-white">
				{name || $_('area.defaultName')}
			</h1>
			<SaveButton id={data.numericId} type="area" />
			{#if org}
				<OrgBadge {org} />
			{/if}
			{#if sponsor}
				<SponsorBadge />
			{/if}
			{#if description}
				<p class="text-xl text-primary dark:text-white">{description}</p>
			{/if}
			{#if alias && type === 'community'}
				<a
					href={`/communities/map?community=${encodeURIComponent(alias)}`}
					class="inline-flex items-center justify-center text-xs text-link transition-colors hover:text-hover"
					>{$_('area.viewOnCommunityMap')} <svg
						class="ml-1 w-3"
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M3 13L13 3M13 3H5.5M13 3V10.5"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg></a
				>
			{/if}
			{#if type === 'community'}
				{#if verifiedDate}
					<div class="flex items-center justify-center gap-2 text-sm font-semibold">
						{#if isVerifiedDateStale}
							<div
								class="flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
							>
								<Icon type="fa" icon="circle-exclamation" w="14" h="14" />
								<span>{$_('area.verifiedOverYearAgo')}</span>
							</div>
						{:else}
							<div
								class="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-green-700 dark:bg-green-900/30 dark:text-green-300"
							>
								<Icon type="material" icon="verified" w="14" h="14" />
								<span>{$_('area.verified')}: {formatVerifiedHuman(verifiedDate)}</span>
							</div>
						{/if}
					</div>
				{:else}
					<div class="flex items-center justify-center gap-2 text-sm font-semibold">
						<div
							class="flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-red-700 dark:bg-red-900/30 dark:text-red-300"
						>
							<Icon type="fa" icon="circle-xmark" w="14" h="14" />
							<span>{$_('area.notRecentlyVerified')}</span>
						</div>
					</div>
				{/if}
				{#if type === 'community'}
					<a
						href={`/community/${encodeURIComponent(alias)}/maintain#verify-form`}
						class="inline-flex items-center justify-center text-xs text-link transition-colors hover:text-hover"
						on:click|preventDefault={() => {
							activeSection = Sections.maintain;
							setTimeout(() => {
								const form = document.getElementById('verify-form');
								if (form) {
									form.scrollIntoView({ behavior: 'smooth', block: 'center' });
								}
							}, 100);
						}}>{$_('area.verifyCommunity')}</a
					>
				{/if}
			{/if}
		</div>

		{#if type === 'community'}
			{#if dataInitialized && hasContact}
				<Socials
					{website}
					{email}
					{phone}
					{nostr}
					{twitter}
					{meetup}
					{telegram}
					{discord}
					{youtube}
					{github}
					{matrix}
					{geyser}
					{satlantis}
					{eventbrite}
					{reddit}
					{simplex}
					{instagram}
					{whatsapp}
					{facebook}
					{linkedin}
					{rss}
					{signal}
				/>
			{:else if !dataInitialized}
				<div class="flex flex-wrap items-center justify-center">
					{#each Array(3) as _, index (index)}
						<div class="m-1 h-10 w-10 animate-pulse rounded-full bg-link/50" />
					{/each}
				</div>
			{/if}

			{#if lightning}
				<Tip destination={lightning.destination} type={lightning.type} user={name} />
			{/if}
		{/if}
	</section>

	<div
		on:scroll={() => (scrolled = true)}
		class="hide-scroll relative grid w-full auto-cols-[minmax(150px,_1fr)] grid-flow-col overflow-x-auto"
	>
		{#each sections as section, index (index)}
			<button
				on:click={() => handleSectionChange(section)}
				class="border-b-4 pb-3 text-center text-lg text-link transition-colors hover:border-link {activeSection ===
				section
					? 'border-link font-bold'
					: 'border-link/25'}"
			>
				{$_(sectionKeys[section])}
			</button>
		{/each}

		{#if !scrolled}
			<div
				class="absolute top-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-[#cce3e6] sm:hidden"
			>
				<Icon type="fa" icon="chevron-right" w="16" h="16" class="text-link" />
			</div>
		{/if}
	</div>

	{#if activeSection === Sections.merchants}
		<AreaMap {name} geoJSON={area?.geo_json} {filteredPlaces} />
		<AreaMerchantHighlights {dataInitialized} {filteredPlaces} />
		{#if browser}
			<Boost />
		{/if}
	{:else if activeSection === Sections.stats}
		{#if $reportError}
			<div class="text-center text-primary dark:text-white">
				<p>{$_('area.errorLoadingData')}</p>
			</div>
		{:else if areaReports === undefined}
			<div class="text-center text-primary dark:text-white">
				<p>{$_('area.loadingData')}</p>
			</div>
		{:else if areaReports.length > 0}
			<AreaStats {name} {areaReports} areaTags={area} />
		{:else}
			<div class="text-center text-primary dark:text-white">
				<p class="text-xl">{$_('area.dataWithin24Hours')}</p>
			</div>
		{/if}
	{:else if activeSection === Sections.activity}
		<AreaActivity
			{alias}
			{name}
			dataInitialized={dataInitialized && taggersLoaded}
			{taggers}
		/>
	{:else if activeSection === Sections.maintain}
		<IssuesTable
			title={$_('area.taggingIssues', { values: { name: name || $_('area.defaultName') } })}
			{issues}
			loading={!dataInitialized}
		/>
		<AreaTickets tickets={data.tickets} title={$_('area.openTickets', { values: { name: name || $_('area.defaultName') } })} />
		{#if type === 'community'}
			<div
				id="verify-form"
				class="mx-auto w-full max-w-[1000px] rounded-3xl border border-link/25 p-8 xl:w-[1000px]"
			>
				<VerifyCommunityForm communityName={name} communityAlias={alias} />
			</div>
		{/if}
	{/if}
</main>
