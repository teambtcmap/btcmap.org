<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	export let type: 'country' | 'community';
	export let data: AreaPageProps;

	import {
		AreaActivity,
		AreaMap,
		AreaMerchantHighlights,
		AreaStats,
		AreaTickets,
		Boost,
		IssuesTable,
		OrgBadge,
		Socials,
		SponsorBadge,
		Tip
	} from '$lib/comp';

	import {
		areaError,
		areas,
		placesError,
		places,
		eventError,
		events,
		reportError,
		reports,
		userError,
		users
	} from '$lib/store';
	import {
		TipType,
		type ActivityEvent,
		type AreaPageProps,
		type AreaTags,
		type Element,
		type Event,
		type Place,
		type Report,
		type RpcIssue,
		type User
	} from '$lib/types.js';
	import { errToast, formatElementID, validateContinents } from '$lib/utils';
	import rewind from '@mapbox/geojson-rewind';
	import { geoContains } from 'd3-geo';

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
		merchants = 'Merchants',
		stats = 'Stats',
		activity = 'Activity',
		maintain = 'Maintain'
	}

	const sections = Object.values(Sections);
	let scrolled = false;

	// Map section names to URL-friendly slugs
	const sectionSlugs: Record<Sections, string> = {
		[Sections.merchants]: 'merchants',
		[Sections.stats]: 'stats',
		[Sections.activity]: 'activity',
		[Sections.maintain]: 'maintain'
	};

	// Reverse mapping from slugs to sections
	const slugToSection: Record<string, Sections> = {
		merchants: Sections.merchants,
		stats: Sections.stats,
		activity: Sections.activity,
		maintain: Sections.maintain
	};

	// Get the current section from the route parameter
	$: currentSection = $page.params.section || 'merchants';
	$: activeSection = slugToSection[currentSection] || Sections.merchants;

	// Handle section change
	const handleSectionChange = (section: Sections) => {
		const slug = sectionSlugs[section];
		const areaId = data.id;
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(`/${type}/${areaId}/${slug}`);
	};

	// No need for hash handling anymore - sections are handled by route parameters

	let dataInitialized = false;
	let elementsLoading = false;

	// Fetch places for area using geographic filtering (no API calls needed)
	const fetchPlacesForArea = async (areaId: string): Promise<Place[]> => {
		try {
			elementsLoading = true;

			// Find the area by ID
			const area = $areas.find((a) => a.id === areaId);
			if (!area || !area.tags.geo_json) {
				console.error('Area not found or missing geo_json:', areaId);
				return [];
			}

			// Use existing global places from the store for geographic filtering
			const allPlaces = $places;

			// Use geographic filtering to get places in the area
			const rewoundPoly = rewind(area.tags.geo_json, true);
			const areaPlaces = allPlaces.filter((place: Place) => {
				return place.lat && place.lon && geoContains(rewoundPoly, [place.lon, place.lat]);
			});

			console.log(`Geographic filtering found ${areaPlaces.length} places for ${areaId}`);
			return areaPlaces;
		} catch (error) {
			console.error('Failed to fetch places for area:', areaId, error);
			return [];
		} finally {
			elementsLoading = false;
		}
	};

	const initializeData = async () => {
		if (dataInitialized) return;

		const areaFound = $areas.find((area) => {
			if (type === 'community') {
				return (
					area.id == data.id &&
					area.tags.type === 'community' &&
					area.tags.geo_json &&
					area.tags.name &&
					area.tags['icon:square'] &&
					area.tags.continent &&
					Object.keys(area.tags).find((key) => key.includes('contact'))
				);
			} else {
				return (
					area.id == data.id &&
					area.tags.type === 'country' &&
					area.id.length === 2 &&
					area.tags.geo_json &&
					area.tags.name &&
					area.tags.continent &&
					validateContinents(area.tags.continent)
				);
			}
		});

		if (!areaFound) {
			console.error(`Could not find ${type}, please try again or contact BTC Map.`);
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			goto('/404');
			return;
		}

		areaReports = $reports
			? $reports
					.filter((report) => report.area_id === data.id)
					.sort((a, b) => Date.parse(b['created_at']) - Date.parse(a['created_at']))
			: [];

		area = areaFound.tags;

		avatar =
			type === 'community'
				? `https://btcmap.org/.netlify/images?url=${area['icon:square']}&fit=cover&w=256&h=256`
				: `https://static.btcmap.org/images/countries/${areaFound.id}.svg`;
		description = area.description;

		if (type === 'community') {
			org = area.organization;
			sponsor = area.sponsor;
			website = area['contact:website'];
			email = area['contact:email'];
			nostr = area['contact:nostr'];
			twitter = area['contact:twitter'];
			secondTwitter = area['contact:second_twitter'];
			meetup = area['contact:meetup'];
			eventbrite = area['contact:eventbrite'];
			telegram = area['contact:telegram'];
			discord = area['contact:discord'];
			youtube = area['contact:youtube'];
			github = area['contact:github'];
			reddit = area['contact:reddit'];
			instagram = area['contact:instagram'];
			whatsapp = area['contact:whatsapp'];
			facebook = area['contact:facebook'];
			linkedin = area['contact:linkedin'];
			rss = area['contact:rss'];
			signal = area['contact:signal'];
			simplex = area['contact:simplex'];

			if (area['tips:lightning_address']) {
				lightning = {
					destination: area['tips:lightning_address'],
					type: TipType.Address
				};
			} else if (area['tips:url']) {
				lightning = { destination: area['tips:url'], type: TipType.Url };
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

		// Fetch places in the background for rich components
		if (browser) {
			const places = await fetchPlacesForArea(areaFound.id);
			filteredPlaces = places;

			// Process events after elements are loaded, only if events and users stores are populated
			if ($events.length && $users.length) {
				const areaEvents = $events.filter((event) =>
					filteredElements.find((element) => element.id === event.element_id)
				);

				areaEvents.sort((a, b) => Date.parse(b['created_at']) - Date.parse(a['created_at']));

				const findUser = (tagger: Event) => {
					let foundUser = $users.find((user) => user.id == tagger['user_id']);

					if (foundUser) {
						if (!taggers.find((tagger) => tagger.id === foundUser?.id)) {
							taggers.push(foundUser);
						}

						return foundUser;
					} else {
						return undefined;
					}
				};

				areaEvents.forEach((event) => {
					let elementMatch = filteredElements.find((element) => element.id === event['element_id']);

					let location = elementMatch?.osm_json.tags?.name || undefined;

					let tagger = findUser(event);

					eventElements.push({
						...event,
						location: location || formatElementID(event['element_id']),
						merchantId: event['element_id'],
						tagger
					});
				});

				eventElements = eventElements;
				taggers = taggers;
			}
		}
	};

	$: $areas && $areas.length && $places && $places.length && !dataInitialized && initializeData();

	let area: AreaTags;
	let filteredElements: Element[] = [];
	let filteredPlaces: Place[] = [];
	let areaReports: Report[];

	let avatar: string;
	const alias = data.id;
	const name = data.name;
	let description: string | undefined;
	let org: string | undefined;
	let sponsor: boolean | undefined;
	let website: string | undefined;
	let email: string | undefined;
	let nostr: string | undefined;
	let twitter: string | undefined;
	let secondTwitter: string | undefined;
	let meetup: string | undefined;
	let eventbrite: string | undefined;
	let telegram: string | undefined;
	let discord: string | undefined;
	let youtube: string | undefined;
	let github: string | undefined;
	let reddit: string | undefined;
	let instagram: string | undefined;
	let whatsapp: string | undefined;
	let facebook: string | undefined;
	let linkedin: string | undefined;
	let rss: string | undefined;
	let signal: string | undefined;
	let simplex: string | undefined;
	let lightning: { destination: string; type: TipType } | undefined;

	let eventElements: ActivityEvent[] = [];
	let taggers: User[] = [];

	let issues: RpcIssue[] = [];
</script>

<main class="my-10 space-y-16 text-center md:my-20">
	<section id="profile" class="space-y-8">
		<div class="space-y-2">
			{#if avatar}
				<img
					src={avatar}
					alt="avatar"
					class="mx-auto h-32 w-32 rounded-full object-cover"
					on:error={function () {
						this.src = '/images/bitcoin.svg';
					}}
				/>
			{:else}
				<div class="mx-auto h-32 w-32 animate-pulse rounded-full bg-link/50" />
			{/if}
			<h1 class="text-4xl font-semibold !leading-tight text-primary dark:text-white">
				{name || 'BTC Map Area'}
			</h1>
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
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href={`/communities/map?community=${alias}`}
					class="inline-flex items-center justify-center text-xs text-link transition-colors hover:text-hover"
					>View on community map <svg
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
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/if}
		</div>

		{#if type === 'community'}
			{#if dataInitialized}
				<Socials
					{website}
					{email}
					{nostr}
					{twitter}
					{secondTwitter}
					{meetup}
					{eventbrite}
					{telegram}
					{discord}
					{youtube}
					{github}
					{reddit}
					{instagram}
					{whatsapp}
					{facebook}
					{linkedin}
					{rss}
					{signal}
					{simplex}
				/>
			{:else}
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
				{section}
			</button>
		{/each}

		{#if !scrolled}
			<div
				class="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-[#cce3e6] sm:hidden"
			>
				<i class="fa-solid fa-chevron-right text-link" />
			</div>
		{/if}
	</div>

	{#if activeSection === Sections.merchants}
		<AreaMap {name} geoJSON={area?.geo_json} {filteredPlaces} />
		<AreaMerchantHighlights
			dataInitialized={dataInitialized && !elementsLoading}
			{filteredPlaces}
		/>
		{#if browser}
			<Boost />
		{/if}
	{:else if activeSection === Sections.stats}
		{#if areaReports && areaReports.length > 0}
			<AreaStats {name} {filteredElements} {areaReports} areaTags={area} />
		{:else}
			<div class="text-center text-primary dark:text-white">
				<p class="text-xl">Data will appear within 24 hours.</p>
			</div>
		{/if}
	{:else if activeSection === Sections.activity}
		<AreaActivity
			{alias}
			{name}
			dataInitialized={dataInitialized && !elementsLoading}
			{eventElements}
			{taggers}
		/>
	{:else if activeSection === Sections.maintain}
		<IssuesTable
			title="{name || 'BTC Map Area'} Tagging Issues"
			{issues}
			loading={!(dataInitialized && !elementsLoading)}
		/>
		<AreaTickets tickets={data.tickets} title="{name || 'BTC Map Area'} Open Tickets" />
	{/if}
</main>
