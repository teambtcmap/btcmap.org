<script lang="ts">
	export let data: MerchantPageData;

	import { browser } from '$app/environment';
	import Boost from '$components/Boost.svelte';
	import BoostButton from '$components/BoostButton.svelte';
	import Card from '$components/Card.svelte';
	import CommentAddButton from './components/CommentAddButton.svelte';
	import Icon from '$components/Icon.svelte';
	import MapLoadingEmbed from '$components/MapLoadingEmbed.svelte';
	import MerchantButton from './components/MerchantButton.svelte';
	import MerchantEvent from './components/MerchantEvent.svelte';
	import MerchantComment from './components/MerchantComment.svelte';
	import MerchantLink from './components/MerchantLink.svelte';
	import PaymentMethodIcon from '$components/PaymentMethodIcon.svelte';
	import PrimaryButton from '$components/PrimaryButton.svelte';
	import ShowTags from '$components/ShowTags.svelte';
	import TaggerSkeleton from '$components/TaggerSkeleton.svelte';
	import TaggingIssues from '$components/TaggingIssues.svelte';
	import TopButton from '$components/TopButton.svelte';
	import { updateSinglePlace } from '$lib/sync/places';
	import { loadMapDependencies } from '$lib/map/imports';
	import {
		attribution,
		calcVerifiedDate,
		changeDefaultIcons,
		generateIcon,
		geolocate,
		layers,
		toggleMapButtons
	} from '$lib/map/setup';
	import {
		areaError,
		areas,
		placesById,
		placesError,
		eventError,
		events,
		reportError,
		reports,
		showTags,
		taggingIssues,
		theme,
		userError,
		users
	} from '$lib/store';
	import { areasSync } from '$lib/sync/areas';
	import { eventsSync } from '$lib/sync/events';
	import { reportsSync } from '$lib/sync/reports';
	import { usersSync } from '$lib/sync/users';
	import { batchSync } from '$lib/sync/batchSync';
	import type {
		Area,
		BaseMaps,
		DomEventType,
		Event,
		Leaflet,
		PayMerchant,
		MerchantPageData
	} from '$lib/types.js';
	import type { Marker } from 'leaflet';
	import {
		errToast,
		successToast,
		formatOpeningHours,
		formatVerifiedHuman,
		isBoosted
	} from '$lib/utils';
	import rewind from '@mapbox/geojson-rewind';
	import { geoContains } from 'd3-geo';
	import type { Map } from 'leaflet';
	import { onDestroy, onMount } from 'svelte';
	import Time from 'svelte-time';
	import tippy from 'tippy.js';
	import { resolve } from '$app/paths';

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

	let dataInitialized = false;
	let initialRenderComplete = false;

	let leaflet: Leaflet;
	let DomEvent: DomEventType;
	let LocateControl: typeof import('leaflet.locatecontrol').LocateControl;

	const initializeData = () => {
		if (dataInitialized) return;

		// Use server data directly instead of store lookup
		icon = data.icon;
		address = data.address;
		description = data.description;
		note = data.note;
		hours = data.hours;
		payment = data.payment;
		phone = data.phone;
		website = data.website;
		email = data.email;
		twitter = data.twitter;
		instagram = data.instagram;
		facebook = data.facebook;
		thirdParty = data.thirdParty;
		paymentMethod = data.paymentMethod;

		lat = data.lat;
		long = data.lon;

		const commentsCount = comments.length;

		const communities = $areas.filter(
			(area) =>
				area.tags.type === 'community' &&
				area.tags.geo_json &&
				area.tags.name &&
				area.tags['icon:square'] &&
				area.tags.continent &&
				Object.keys(area.tags).find((key) => key.includes('contact')) &&
				$reports.find((report) => report.area_id === area.id)
		);

		// filter communities containing element
		filteredCommunities = communities.filter((community) => {
			let rewoundPoly = rewind(community.tags.geo_json, true);

			if (typeof lat === 'number' && typeof long === 'number') {
				if (geoContains(rewoundPoly, [long, lat])) {
					return true;
				}
			}
			return false;
		});

		merchantEvents = $events.filter((event) => event.element_id === data.placeData.osm_id);

		merchantEvents.sort((a, b) => Date.parse(b['created_at']) - Date.parse(a['created_at']));

		const setupMap = () => {
			// add map
			map = leaflet.map(mapElement, { attributionControl: false, maxZoom: 19 });

			// add tiles and basemaps
			const layersResult = layers(leaflet, map);
			baseMaps = layersResult.baseMaps;

			// change broken marker image path in prod
			leaflet.Icon.Default.prototype.options.imagePath = '/icons/';

			// add OSM attribution
			attribution(leaflet, map);

			leaflet.control.layers(baseMaps).addTo(map);

			// add locate button to map
			geolocate(leaflet, map, LocateControl);

			// change default icons
			changeDefaultIcons(true, leaflet, mapElement, DomEvent);

			// add element to map
			const divIcon = generateIcon(
				leaflet,
				data.placeData.deleted_at ? 'skull' : icon || 'question_mark',
				boosted ? true : false,
				commentsCount
			);

			if (typeof lat === 'number' && typeof long === 'number') {
				merchantMarker = leaflet.marker([lat, long], { icon: divIcon });
				map.addLayer(merchantMarker);
				map.fitBounds([[lat, long]]);
			}

			mapLoaded = true;
		};
		setupMap();

		dataInitialized = true;
	};

	// Initialize data when component mounts, only need areas/reports/events for communities/activity
	$: $users &&
		$users.length &&
		$events &&
		$events.length &&
		$areas &&
		$areas.length &&
		$reports &&
		$reports.length &&
		initialRenderComplete &&
		!dataInitialized &&
		initializeData();

	// merchant variable no longer needed - using server data directly

	const name = data.name;
	let icon: string | undefined;
	let address: string | undefined;
	let description: string | undefined;
	let note: string | undefined;
	let hours: string | undefined;
	let payment: PayMerchant;
	let boosted: string | undefined;
	let verified: string[] = [];
	const verifiedDate = calcVerifiedDate();

	// Make comments reactive to server data updates (from invalidateAll() after adding comment)
	let comments = data.comments;
	$: comments = data.comments;

	// Initialize verified and boosted immediately from server data (don't wait for store sync)
	$: verified = data.verified || [];
	// Make boosted reactive to both server data and store updates, but only if boost is still active
	$: {
		const placeInStore = $placesById.get(Number(data.id));
		const mergedPlace = placeInStore || data.placeData;
		// Only set boosted if the place is actually boosted (expiry in future)
		boosted = mergedPlace && isBoosted(mergedPlace) ? mergedPlace.boosted_until : undefined;
	}
	let phone: string | undefined;
	let website: string | undefined;
	let email: string | undefined;
	let twitter: string | undefined;
	let instagram: string | undefined;
	let facebook: string | undefined;

	let thirdParty: boolean | undefined;
	let paymentMethod: string | undefined;

	let thirdPartyTooltip: HTMLAnchorElement;
	let onchainTooltip: HTMLImageElement;
	let lnTooltip: HTMLImageElement;
	let nfcTooltip: HTMLImageElement;
	let verifiedTooltip: HTMLSpanElement;
	let outdatedTooltip: HTMLSpanElement;

	$: thirdPartyTooltip &&
		data &&
		tippy([thirdPartyTooltip], {
			content: 'Third party app required'
		});

	$: onchainTooltip &&
		data &&
		tippy([onchainTooltip], {
			content:
				data.osmTags?.['payment:onchain'] === 'yes'
					? 'On-chain accepted'
					: data.osmTags?.['payment:onchain'] === 'no'
						? 'On-chain not accepted'
						: 'On-chain unknown'
		});

	$: lnTooltip &&
		data &&
		tippy([lnTooltip], {
			content:
				data.osmTags?.['payment:lightning'] === 'yes'
					? 'Lightning accepted'
					: data.osmTags?.['payment:lightning'] === 'no'
						? 'Lightning not accepted'
						: 'Lightning unknown'
		});

	$: nfcTooltip &&
		data &&
		tippy([nfcTooltip], {
			content:
				data.osmTags?.['payment:lightning_contactless'] === 'yes'
					? 'Lightning Contactless accepted'
					: data.osmTags?.['payment:lightning_contactless'] === 'no'
						? 'Lightning contactless not accepted'
						: 'Lightning contactless unknown'
		});

	$: verifiedTooltip &&
		tippy([verifiedTooltip], {
			content: 'Verified within the last year'
		});

	$: outdatedTooltip &&
		tippy([outdatedTooltip], {
			content: 'Outdated please re-verify'
		});

	let lat: number | undefined;
	let long: number | undefined;

	let filteredCommunities: Area[] = [];

	let hideArrow = false;
	let activityDiv;

	let merchantEvents: Event[] = [];

	let eventCount = 50;
	$: eventsPaginated = merchantEvents.slice(0, eventCount);

	const findUser = (tagger: Event) => {
		let foundUser = $users.find((user) => user.id == tagger['user_id']);

		if (foundUser) {
			return foundUser;
		} else {
			return undefined;
		}
	};

	let mapElement: HTMLDivElement;
	let map: Map;
	let mapLoaded = false;
	let merchantMarker: Marker | undefined; // Store marker reference for reactive updates

	let baseMaps: BaseMaps;

	onMount(async () => {
		batchSync([eventsSync, usersSync, areasSync, reportsSync]);

		if (browser) {
			const deps = await loadMapDependencies();
			leaflet = deps.leaflet;
			DomEvent = deps.DomEvent;
			LocateControl = deps.LocateControl;

			initialRenderComplete = true;

			// Update localforage with fresh place data to sync comment counts, boosts, etc.
			// This ensures the map shows current data when navigating back
			try {
				await updateSinglePlace(data.id);
			} catch (error) {
				// Silent failure - page still works with server data even if cache update fails
				console.error('Could not update place in localforage:', error);
			}
		}
	});

	const toggleTheme = () => {
		if ($theme === 'dark') {
			baseMaps['OpenFreeMap Liberty'].remove();
			baseMaps['OpenFreeMap Dark'].addTo(map);
		} else {
			baseMaps['OpenFreeMap Dark'].remove();
			baseMaps['OpenFreeMap Liberty'].addTo(map);
		}
	};

	$: $theme !== undefined && mapLoaded && toggleMapButtons();

	$: $theme !== undefined && mapLoaded && toggleTheme();

	// Update marker icon when boost or comment state changes
	$: if (merchantMarker && leaflet && mapLoaded && icon) {
		const commentsCount = comments.length;
		const displayIcon = data.placeData.deleted_at
			? 'skull'
			: icon !== 'question_mark'
				? icon
				: 'currency_bitcoin';
		const newIcon = generateIcon(leaflet, displayIcon, boosted ? true : false, commentsCount);
		merchantMarker.setIcon(newIcon);
	}

	onDestroy(async () => {
		if (map) {
			console.info('Unloading Leaflet map.');
			map.remove();
		}
	});

	const ogImage = `https://api.btcmap.org/og/element/${data.osmType}:${data.osmId}`;
</script>

<svelte:head>
	<title>{name ? name + ' - ' : ''}BTC Map Merchant</title>
	<meta property="og:image" content={ogImage} />
	<meta property="twitter:title" content="{name ? name + ' - ' : ''}BTC Map Merchant" />
	<meta property="twitter:image" content={ogImage} />
</svelte:head>

{#if data.placeData.deleted_at}
	<div class="bg-red-600 py-4 text-center text-white">
		<p class="text-lg font-semibold">
			<Icon w="20" h="20" style="inline-block text-white mr-2" icon="skull" type="material" />
			This merchant has been removed from BTC Map and may no longer accept Bitcoin.
		</p>
		<p class="mt-1 text-sm">The data shown below is outdated and for reference only.</p>
	</div>
{/if}
<main class="my-10 space-y-16 text-center md:my-20">
	<section id="profile" class="space-y-8">
		<div class="space-y-2">
			{#if icon}
				<div
					class="mx-auto flex h-32 w-32 items-center justify-center rounded-full {data.placeData
						.deleted_at
						? 'bg-gray-400 dark:bg-gray-600'
						: boosted
							? 'bg-bitcoin hover:animate-wiggle'
							: 'bg-link'}"
				>
					<Icon
						w="60"
						h="60"
						style="text-white"
						icon={data.placeData.deleted_at
							? 'skull'
							: icon !== 'question_mark'
								? icon
								: 'currency_bitcoin'}
						type="material"
					/>
				</div>
			{:else}
				<div class="mx-auto h-32 w-32 animate-pulse rounded-full bg-link/50" />
			{/if}

			<h1 class="text-4xl !leading-tight font-semibold text-primary dark:text-white">
				{name || 'BTC Map Merchant'}
				{#if data.placeData.deleted_at}
					<span class="text-2xl text-red-600 dark:text-red-400">(Deleted)</span>
				{/if}
			</h1>

			{#if address}
				<h2 class="text-xl text-primary dark:text-white">
					{address}
				</h2>
			{/if}

			{#if lat && long}
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href={`/map#18/${lat}/${long}`}
					class="inline-flex items-center justify-center text-xs text-link transition-colors hover:text-hover"
				>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
					View on main map
					<svg
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
					</svg>
				</a>
			{:else}
				<div class="mx-auto h-4 w-28 animate-pulse rounded bg-link/50" />
			{/if}
		</div>

		<div class="grid-cols-3 gap-12 space-y-12 lg:grid lg:space-y-0">
			{#if phone}
				<div class="text-primary dark:text-white">
					<h4 class="text-primary uppercase dark:text-white">
						<Icon
							w="16"
							h="16"
							style="text-primary dark:text-white inline-block"
							icon="phone"
							type="material"
						/>
						Contact
					</h4>

					<div class="flex items-center justify-center">
						{phone}
					</div>
				</div>
			{:else}
				<div></div>
				<!-- Placeholder for alignment -->
			{/if}

			{#if (paymentMethod || thirdParty) && data}
				<div class="text-primary dark:text-white">
					<h4 class="text-primary uppercase dark:text-white">Accepted Payments</h4>
					<div class="mt-1 flex items-center justify-center space-x-2">
						{#if !paymentMethod}
							<!-- eslint-disable svelte/no-navigation-without-resolve -->
							<a
								bind:this={thirdPartyTooltip}
								href={data.osmTags?.['payment:lightning:companion_app_url']}
								target="_blank"
								rel="noreferrer"
							>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
								<Icon
									type="fa"
									icon="mobile-screen-button"
									w="32"
									h="32"
									style="text-primary transition-colors hover:text-link dark:text-white dark:hover:text-link"
								/>
							</a>
						{:else if typeof window !== 'undefined'}
							<PaymentMethodIcon
								bind:element={onchainTooltip}
								status={data.osmTags?.['payment:onchain']}
								method="btc"
								label="On-chain"
								variant="teal"
								size="md"
							/>

							<PaymentMethodIcon
								bind:element={lnTooltip}
								status={data.osmTags?.['payment:lightning']}
								method="ln"
								label="Lightning"
								variant="teal"
								size="md"
							/>

							<PaymentMethodIcon
								bind:element={nfcTooltip}
								status={data.osmTags?.['payment:lightning_contactless']}
								method="nfc"
								label="Lightning contactless"
								variant="teal"
								size="md"
							/>
						{/if}
					</div>
				</div>
			{/if}

			{#if hours}
				<div class="text-primary dark:text-white">
					<h4 class="text-primary uppercase dark:text-white">
						<Icon
							w="16"
							h="16"
							style="text-primary dark:text-white inline"
							icon="schedule"
							type="material"
						/>
						Hours
					</h4>

					<div class="flex items-start justify-center">
						<!-- eslint-disable-next-line svelte/no-at-html-tags - we even sanitize the captcha content above -->
						<time class="flex flex-col items-start">{@html formatOpeningHours(hours)}</time>
					</div>
				</div>
			{/if}
		</div>

		<div class="flex flex-wrap items-center justify-center gap-4">
			{#if dataInitialized}
				<MerchantLink link={`geo:${lat},${long}`} icon="compass" text="Navigate" />

				<MerchantLink
					link={`https://www.openstreetmap.org/edit?${data.osmType}=${data.osmId}`}
					icon="pencil"
					text="Edit"
				/>

				<MerchantButton
					on:click={() => {
						navigator.clipboard.writeText(`https://btcmap.org/merchant/${data.id}`);
						successToast('Link copied to clipboard!');
					}}
					icon="share"
					text="Share"
				/>

				{#if payment}
					<MerchantLink
						link={payment.type === 'uri'
							? payment.url || '#'
							: payment.type === 'pouch'
								? `https://app.pouch.ph/${payment.username}`
								: payment.type === 'coinos'
									? `https://coinos.io/${payment.username}`
									: '#'}
						icon="bolt"
						text="Pay Merchant"
					/>
				{/if}

				{#if phone}
					<MerchantLink link={`tel:${phone}`} icon="phone" text="Call" />
				{/if}

				{#if email}
					<MerchantLink link={`mailto:${email}`} icon="email" text="Email" />
				{/if}

				{#if website}
					<MerchantLink
						link={website.startsWith('http') ? website : `https://${website}`}
						icon="globe"
						text="Website"
					/>
				{/if}

				{#if twitter}
					<MerchantLink
						link={twitter.startsWith('http') ? twitter : `https://twitter.com/${twitter}`}
						icon="x"
						text="X"
					/>
				{/if}

				{#if instagram}
					<MerchantLink
						link={instagram.startsWith('http') ? instagram : `https://instagram.com/${instagram}`}
						icon="instagram"
						text="Instagram"
					/>
				{/if}

				{#if facebook}
					<MerchantLink
						link={facebook.startsWith('http') ? facebook : `https://facebook.com/${facebook}`}
						icon="facebook"
						text="Facebook"
					/>
				{/if}

				<span id="show-tags">
					<MerchantButton
						on:click={() => ($showTags = data.osmTags)}
						icon="tags"
						text="Show Tags"
					/>
				</span>

				<span id="tagging-issues">
					<MerchantButton
						on:click={() => ($taggingIssues = data.osmTags?.issues || [])}
						icon="issues"
						text="Tag Issues"
					/>
				</span>

				<MerchantLink
					link={`https://www.openstreetmap.org/${data.osmType}/${data.osmId}`}
					icon="external"
					text="View OSM"
				/>
			{:else}
				{#each Array(5) as _, i (i)}
					<div class="h-20 w-24 animate-pulse rounded-lg bg-link/50" />
				{/each}
			{/if}
		</div>

		{#if description}
			<p class="mx-auto max-w-[600px] text-primary dark:text-white">{description}</p>
		{/if}

		{#if note}
			<p class="mx-auto max-w-[600px] text-primary dark:text-white">{note}</p>
		{/if}

		<!-- Three cards: Last Surveyed, Boost, Comments (use server data, don't wait for store sync) -->
		<div class="grid-cols-3 gap-12 space-y-12 lg:grid lg:space-y-0">
			<Card headerAlign="center">
				<h3 slot="header" class="text-2xl font-semibold">Last Surveyed</h3>

				<div slot="body" class="p-4">
					{#if verified.length}
						<div class="flex items-center justify-center dark:text-white">
							{#if Date.parse(verified[0]) > verifiedDate}
								<span bind:this={verifiedTooltip}>
									<Icon
										w="30"
										h="30"
										style="text-primary dark:text-white mr-2"
										icon="verified"
										type="material"
									/>
								</span>
							{:else}
								<span bind:this={outdatedTooltip}>
									<Icon
										w="30"
										h="30"
										style="text-primary dark:text-white mr-2"
										icon="error_outline"
										type="material"
									/>
								</span>
							{/if}
							<strong>{formatVerifiedHuman(verified?.[0])}</strong>
						</div>
					{:else}
						<p class="font-semibold dark:text-white">This location needs to be surveyed!</p>
					{/if}
				</div>

				<PrimaryButton
					slot="footer"
					link={`/verify-location?id=${data.id}`}
					style="rounded-xl p-3 w-40"
				>
					Verify Location
				</PrimaryButton>
			</Card>

			<Card headerAlign="center">
				<h3 slot="header" class="text-2xl font-semibold">Boost</h3>

				<div slot="body" class="p-4">
					<p class="mx-auto font-semibold dark:text-white">
						{boosted
							? 'This location is boosted!'
							: "Boost this location to improve it's visibility on the map."}
					</p>

					{#if boosted}
						<p class="dark:text-white">
							Boost Expires:
							<span class="underline decoration-bitcoin decoration-4 underline-offset-8">
								<Time live={3000} relative={true} timestamp={boosted} />
							</span>
						</p>
					{/if}
				</div>

				<BoostButton slot="footer" merchant={data.placeData} {boosted} />
			</Card>

			<Card headerAlign="center">
				<h3 slot="header" class="text-2xl font-semibold">
					Comments {#if comments.length}({comments.length}){/if}
				</h3>

				<div slot="body" class="p-4">
					<p class="mx-auto font-semibold dark:text-white">
						{#if comments.length}
							Let others know your thoughts about this merchant.
						{:else}
							No comments yet. Be the first to leave a comment!
						{/if}
					</p>
				</div>

				<div slot="footer">
					{#if comments.length}
						<PrimaryButton link="#comments" style="w-40 rounded-xl p-3">
							View Comments
						</PrimaryButton>
					{:else}
						<CommentAddButton elementId={data.id} />
					{/if}
				</div>
			</Card>
		</div>
	</section>

	<section id="map-section">
		<Card>
			<h3 slot="header" class="text-lg font-semibold">
				{name || 'Merchant'} Location
			</h3>

			<div slot="body" class="w-full">
				<div class="relative overflow-hidden">
					<div
						bind:this={mapElement}
						class="z-10 h-[300px] rounded-b-3xl !bg-teal text-left md:h-[600px] dark:!bg-[#202f33]"
					/>
					{#if !mapLoaded}
						<MapLoadingEmbed style="h-[300px] md:h-[600px]  rounded-b-3xl" />
					{/if}
				</div>
			</div>
		</Card>
	</section>

	<section id="comments">
		<Card>
			<div slot="header" class="flex items-center justify-between">
				<h3 class="text-lg font-semibold">
					{name || 'Merchant'} Comments
				</h3>
				<CommentAddButton elementId={data.id} />
			</div>

			<div slot="body" class="w-full">
				<div class="hide-scroll relative max-h-[300px] space-y-2 overflow-y-scroll">
					<div class="relative space-y-2">
						{#if comments && comments.length}
							{#each [...comments].reverse() as comment (comment.id)}
								<MerchantComment text={comment.text} time={comment['created_at']} />
							{/each}
						{:else}
							<p class="p-5 text-body dark:text-white">No comments yet.</p>
						{/if}
					</div>
				</div>
			</div>
		</Card>
	</section>

	<section id="activity">
		<Card>
			<h3 slot="header" class="text-lg font-semibold">
				{name || 'Merchant'} Activity
			</h3>

			<div slot="body" class="w-full">
				<div
					bind:this={activityDiv}
					class="hide-scroll relative max-h-[300px] space-y-2 overflow-y-scroll"
					on:scroll={() => {
						if (dataInitialized && !hideArrow) {
							hideArrow = true;
						}
					}}
				>
					{#if merchantEvents && merchantEvents.length}
						{#each eventsPaginated as event (event['created_at'])}
							<MerchantEvent
								action={event.type}
								user={findUser(event)}
								time={event['created_at']}
								latest={event === merchantEvents[0] ? true : false}
							/>
						{/each}

						{#if eventsPaginated.length !== merchantEvents.length}
							<button
								class="mx-auto !mb-5 block text-xl font-semibold text-link transition-colors hover:text-hover"
								on:click={() => (eventCount = eventCount + 50)}>Load More</button
							>
						{:else if merchantEvents.length > 10}
							<TopButton scroll={activityDiv} style="!mb-5" />
						{/if}

						{#if !hideArrow && merchantEvents.length > 5}
							<svg
								class="absolute bottom-4 left-[calc(50%-8px)] z-20 h-4 w-4 animate-bounce text-primary dark:text-white"
								fill="currentColor"
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 512 512"
								><!--! Font Awesome Pro 6.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path
									d="M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z"
								/></svg
							>
						{/if}
					{:else if !dataInitialized}
						{#each Array(5) as _, i (i)}
							<TaggerSkeleton />
						{/each}
					{:else}
						<p class="p-5 text-body dark:text-white">No activity to display.</p>
					{/if}
				</div>
			</div>
		</Card>
	</section>

	<section id="communities">
		<Card>
			<h3 slot="header" class="text-lg font-semibold">
				{name || 'Merchant'} Communities
			</h3>

			<div slot="body" class="w-full">
				<div
					class="hide-scroll flex max-h-[300px] flex-wrap items-center justify-center overflow-scroll"
				>
					{#if filteredCommunities && filteredCommunities.length}
						{#each filteredCommunities as community (community.id)}
							<div class="m-4 space-y-1 transition-transform hover:scale-110">
								<a href={resolve(`/community/${community.id}`)}>
									<img
										src={`https://btcmap.org/.netlify/images?url=${community.tags['icon:square']}&fit=cover&w=256&h=256`}
										alt="logo"
										class="mx-auto h-20 w-20 rounded-full object-cover"
										on:error={function () {
											this.src = '/images/bitcoin.svg';
										}}
									/>
									<p class="text-center font-semibold text-body dark:text-white">
										{community.tags.name}
									</p>
								</a>
							</div>
						{/each}
					{:else if !dataInitialized}
						<p class="p-5 text-body dark:text-white">Loading communities...</p>
					{:else}
						<p class="p-5 text-body dark:text-white">
							This location is not part of a communtiy, but one can be <a
								href={resolve('/communities')}
								class="text-link transition-colors hover:text-hover">created</a
							> to help maintain this local area.
						</p>
					{/if}
				</div>
			</div>
		</Card>
	</section>

	<p class="text-center text-sm text-body md:text-left dark:text-white">
		*More information on bitcoin mapping tags can be found <a
			href="https://gitea.btcmap.org/teambtcmap/btcmap-general/wiki/Tagging-Merchants#tagging-guidance"
			target="_blank"
			rel="noreferrer"
			class="text-link transition-colors hover:text-hover">here</a
		>.
	</p>
</main>

{#if browser}
	<Boost />
{/if}

<ShowTags />
<TaggingIssues />
