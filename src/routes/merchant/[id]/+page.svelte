<script lang="ts">
	export let data: MerchantPageData;

	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import {
		Boost,
		BoostButton,
		CommentAddButton,
		Footer,
		Header,
		Icon,
		MapLoadingEmbed,
		MerchantButton,
		MerchantEvent,
		MerchantComment,
		MerchantLink,
		PrimaryButton,
		ShowTags,
		TaggerSkeleton,
		TaggingIssues,
		TopButton
	} from '$lib/comp';
	import {
		attribution,
		calcVerifiedDate,
		changeDefaultIcons,
		checkAddress,
		generateIcon,
		geolocate,
		latCalc,
		layers,
		longCalc,
		toggleMapButtons,
		verifiedArr
	} from '$lib/map/setup';
	import {
		areaError,
		areas,
		elementError,
		elements,
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
	import type {
		Area,
		BaseMaps,
		DomEventType,
		Element,
		Event,
		Leaflet,
		PayMerchant,
		MerchantPageData
	} from '$lib/types.js';
	import { detectTheme, errToast, successToast } from '$lib/utils';
	import rewind from '@mapbox/geojson-rewind';
	import { geoContains } from 'd3-geo';
	import type { Map } from 'leaflet';
	import { onDestroy, onMount } from 'svelte';
	import Time from 'svelte-time';
	import tippy from 'tippy.js';

	// alert for user errors
	$: $userError && errToast($userError);
	// alert for event errors
	$: $eventError && errToast($eventError);
	// alert for element errors
	$: $elementError && errToast($elementError);
	// alert for area errors
	$: $areaError && errToast($areaError);
	// alert for report errors
	$: $reportError && errToast($reportError);

	const formatWithLineBreaks = (str: string): string => {
		return str.replace(/;\s*/g, '\n');
	};

	let dataInitialized = false;
	let initialRenderComplete = false;

	let leaflet: Leaflet;
	let DomEvent: DomEventType;

	const initializeData = () => {
		if (dataInitialized) return;

		merchant = $elements.find((element) => element.id == data.id);

		if (!merchant) {
			console.error('Could not find merchant, please try again or contact BTC Map.');
			goto('/404');
			return;
		}

		icon = merchant.tags['icon:android'];
		address = merchant.osm_json.tags && checkAddress(merchant.osm_json.tags);
		description = merchant.osm_json.tags?.description;
		note = merchant.osm_json.tags?.note;
		hours = merchant.osm_json.tags?.['opening_hours'];
		payment = merchant.tags['payment:uri']
			? { type: 'uri', url: merchant.tags['payment:uri'] }
			: merchant.tags['payment:pouch']
				? { type: 'pouch', username: merchant.tags['payment:pouch'] }
				: merchant.tags['payment:coinos']
					? { type: 'coinos', username: merchant.tags['payment:coinos'] }
					: undefined;
		boosted =
			merchant.tags['boost:expires'] && Date.parse(merchant.tags['boost:expires']) > Date.now()
				? merchant.tags['boost:expires']
				: undefined;
		verified = verifiedArr(merchant.osm_json);
		phone = merchant.osm_json.tags?.phone || merchant.osm_json.tags?.['contact:phone'];
		website = merchant.osm_json.tags?.website || merchant.osm_json.tags?.['contact:website'];
		email = merchant.osm_json.tags?.email || merchant.osm_json.tags?.['contact:email'];
		twitter = merchant.osm_json.tags?.twitter || merchant.osm_json.tags?.['contact:twitter'];
		instagram = merchant.osm_json.tags?.instagram || merchant.osm_json.tags?.['contact:instagram'];
		facebook = merchant.osm_json.tags?.facebook || merchant.osm_json.tags?.['contact:facebook'];

		thirdParty =
			merchant.osm_json.tags?.['payment:lightning:requires_companion_app'] === 'yes' &&
			merchant.osm_json.tags['payment:lightning:companion_app_url'];

		paymentMethod =
			merchant.osm_json.tags &&
			(merchant.osm_json.tags['payment:onchain'] ||
				merchant.osm_json.tags['payment:lightning'] ||
				merchant.osm_json.tags['payment:lightning_contactless']);

		lat = latCalc(merchant['osm_json']);
		long = longCalc(merchant['osm_json']);

		const commentsCount = merchant.tags.comments || 0;

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

		merchantEvents = $events.filter((event) => event.element_id === merchant?.id);

		merchantEvents.sort((a, b) => Date.parse(b['created_at']) - Date.parse(a['created_at']));

		const setupMap = () => {
			// add map
			map = leaflet.map(mapElement, { attributionControl: false, maxZoom: 19 });

			// add tiles and basemaps
			baseMaps = layers(leaflet, map);

			// change broken marker image path in prod
			leaflet.Icon.Default.prototype.options.imagePath = '/icons/';

			// add OSM attribution
			attribution(leaflet, map);

			leaflet.control.layers(baseMaps).addTo(map);

			// add locate button to map
			geolocate(leaflet, map);

			// change default icons
			changeDefaultIcons(true, leaflet, mapElement, DomEvent);

			// add element to map
			const divIcon = generateIcon(
				leaflet,
				icon || 'question_mark',
				boosted ? true : false,
				commentsCount
			);

			if (typeof lat === 'number' && typeof long === 'number') {
				const marker = leaflet.marker([lat, long], { icon: divIcon });
				map.addLayer(marker);
				map.fitBounds([[lat, long]]);
			}

			mapLoaded = true;
		};
		setupMap();

		dataInitialized = true;
	};

	$: $users &&
		$users.length &&
		$events &&
		$events.length &&
		$elements &&
		$elements.length &&
		$areas &&
		$areas.length &&
		$reports &&
		$reports.length &&
		initialRenderComplete &&
		!dataInitialized &&
		initializeData();

	let merchant: Element | undefined;

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
		merchant &&
		tippy([thirdPartyTooltip], {
			content: 'Third party app required'
		});

	$: onchainTooltip &&
		merchant &&
		tippy([onchainTooltip], {
			content:
				merchant.osm_json.tags?.['payment:onchain'] === 'yes'
					? 'On-chain accepted'
					: merchant.osm_json.tags?.['payment:onchain'] === 'no'
						? 'On-chain not accepted'
						: 'On-chain unknown'
		});

	$: lnTooltip &&
		merchant &&
		tippy([lnTooltip], {
			content:
				merchant.osm_json.tags?.['payment:lightning'] === 'yes'
					? 'Lightning accepted'
					: merchant.osm_json.tags?.['payment:lightning'] === 'no'
						? 'Lightning not accepted'
						: 'Lightning unknown'
		});

	$: nfcTooltip &&
		merchant &&
		tippy([nfcTooltip], {
			content:
				merchant.osm_json.tags?.['payment:lightning_contactless'] === 'yes'
					? 'Lightning Contactless accepted'
					: merchant.osm_json.tags?.['payment:lightning_contactless'] === 'no'
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

	let baseMaps: BaseMaps;

	onMount(async () => {
		if (browser) {
			//import packages
			leaflet = await import('leaflet');
			DomEvent = await import('leaflet/src/dom/DomEvent');
			/* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
			const maplibreGl = await import('maplibre-gl');
			const maplibreGlLeaflet = await import('@maplibre/maplibre-gl-leaflet');
			const leafletLocateControl = await import('leaflet.locatecontrol');
			/* eslint-enable no-unused-vars, @typescript-eslint/no-unused-vars */

			initialRenderComplete = true;
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

	onDestroy(async () => {
		if (map) {
			console.info('Unloading Leaflet map.');
			map.remove();
		}
	});

	const ogImage = `https://api.btcmap.org/og/element/${data.id}`;
</script>

<svelte:head>
	<title>{name ? name + ' - ' : ''}BTC Map Merchant</title>
	<meta property="og:image" content={ogImage} />
	<meta property="twitter:title" content="{name ? name + ' - ' : ''}BTC Map Merchant" />
	<meta property="twitter:image" content={ogImage} />
</svelte:head>

<div class="bg-teal dark:bg-dark">
	<Header />
	<div class="mx-auto w-10/12 xl:w-[1200px]">
		<main class="my-10 space-y-16 text-center md:my-20">
			<section id="profile" class="space-y-8">
				<div class="space-y-2">
					{#if icon}
						<div
							class="mx-auto flex h-32 w-32 items-center justify-center rounded-full {boosted
								? 'bg-bitcoin hover:animate-wiggle'
								: 'bg-link'}"
						>
							<Icon
								w="60"
								h="60"
								style="text-white"
								icon={icon !== 'question_mark' ? icon : 'currency_bitcoin'}
								type="material"
							/>
						</div>
					{:else}
						<div class="mx-auto h-32 w-32 animate-pulse rounded-full bg-link/50" />
					{/if}

					<h1 class="text-4xl font-semibold !leading-tight text-primary dark:text-white">
						{name || 'BTC Map Merchant'}
					</h1>

					{#if address}
						<h2 class="text-xl text-primary dark:text-white">
							{address}
						</h2>
					{/if}

					{#if lat && long}
						<a
							href={`/map?lat=${lat}&long=${long}`}
							class="inline-flex items-center justify-center text-xs text-link transition-colors hover:text-hover"
						>
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

				<div class="flex flex-wrap items-center justify-center gap-4">
					{#if dataInitialized}
						<MerchantLink link={`geo:${lat},${long}`} icon="compass" text="Navigate" />

						<MerchantLink
							link={`https://www.openstreetmap.org/edit?${merchant?.osm_json.type}=${merchant?.osm_json.id}`}
							icon="pencil"
							text="Edit"
						/>

						<MerchantButton
							on:click={() => {
								navigator.clipboard.writeText(`https://btcmap.org/merchant/${merchant?.id}`);
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
								icon="twitter"
								text="Twitter"
							/>
						{/if}

						{#if instagram}
							<MerchantLink
								link={instagram.startsWith('http')
									? instagram
									: `https://instagram.com/${instagram}`}
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
								on:click={() => ($showTags = merchant?.osm_json.tags || {})}
								icon="tags"
								text="Show Tags"
							/>
						</span>

						<span id="tagging-issues">
							<MerchantButton
								on:click={() => ($taggingIssues = merchant?.tags?.issues || [])}
								icon="issues"
								text="Tag Issues"
							/>
						</span>

						<MerchantLink
							link={`https://www.openstreetmap.org/${merchant?.osm_json.type}/${merchant?.osm_json.id}`}
							icon="external"
							text="View OSM"
						/>
					{:else}
						{#each Array(5) as _, i (i)}
							<div class="h-20 w-24 animate-pulse rounded-lg bg-link/50" />
						{/each}
					{/if}
				</div>

				<div class="grid-cols-3 gap-12 space-y-12 lg:grid lg:space-y-0">
					{#if phone}
						<div class="text-primary dark:text-white">
							<h4 class="uppercase text-primary dark:text-white">Contact</h4>

							<div class="flex items-center justify-center">
								<Icon
									w="30"
									h="30"
									style="text-primary dark:text-white mr-2"
									icon="phone"
									type="popup"
								/>
								<span>{phone}</span>
							</div>
						</div>
					{:else}
						<div></div>
						<!-- Placeholder for alignment -->
					{/if}

					{#if (paymentMethod || thirdParty) && merchant}
						<div class="text-primary dark:text-white">
							<h4 class="uppercase text-primary dark:text-white">Accepted Payments</h4>
							<div class="mt-1 flex items-center justify-center space-x-2">
								{#if !paymentMethod}
									<a
										bind:this={thirdPartyTooltip}
										href={merchant.osm_json.tags?.['payment:lightning:companion_app_url']}
										target="_blank"
										rel="noreferrer"
									>
										<i
											class="fa-solid fa-mobile-screen-button h-8 w-8 text-primary transition-colors hover:text-link dark:text-white dark:hover:text-link"
										>
										</i>
									</a>
								{:else if typeof window !== 'undefined'}
									<img
										bind:this={onchainTooltip}
										src={merchant.osm_json.tags?.['payment:onchain'] === 'yes'
											? detectTheme() === 'dark' || $theme === 'dark'
												? '/icons/btc-highlight-dark.svg'
												: '/icons/btc-highlight.svg'
											: merchant.osm_json.tags?.['payment:onchain'] === 'no'
												? detectTheme() === 'dark' || $theme === 'dark'
													? '/icons/btc-no-dark.svg'
													: '/icons/btc-no-teal.svg'
												: detectTheme() === 'dark' || $theme === 'dark'
													? '/icons/btc-dark.svg'
													: '/icons/btc.svg'}
										alt="bitcoin"
										class="h-8 w-8"
									/>

									<img
										bind:this={lnTooltip}
										src={merchant.osm_json.tags?.['payment:lightning'] === 'yes'
											? detectTheme() === 'dark' || $theme === 'dark'
												? '/icons/ln-highlight-dark.svg'
												: '/icons/ln-highlight.svg'
											: merchant.osm_json.tags?.['payment:lightning'] === 'no'
												? detectTheme() === 'dark' || $theme === 'dark'
													? '/icons/ln-no-dark.svg'
													: '/icons/ln-no-teal.svg'
												: detectTheme() === 'dark' || $theme === 'dark'
													? '/icons/ln-dark.svg'
													: '/icons/ln.svg'}
										alt="lightning"
										class="h-8 w-8"
									/>

									<img
										bind:this={nfcTooltip}
										src={merchant.osm_json.tags?.['payment:lightning_contactless'] === 'yes'
											? detectTheme() === 'dark' || $theme === 'dark'
												? '/icons/nfc-highlight-dark.svg'
												: '/icons/nfc-highlight.svg'
											: merchant.osm_json.tags?.['payment:lightning_contactless'] === 'no'
												? detectTheme() === 'dark' || $theme === 'dark'
													? '/icons/nfc-no-dark.svg'
													: '/icons/nfc-no-teal.svg'
												: detectTheme() === 'dark' || $theme === 'dark'
													? '/icons/nfc-dark.svg'
													: '/icons/nfc.svg'}
										alt="nfc"
										class="h-8 w-8"
									/>
								{/if}
							</div>
						</div>
					{/if}

					{#if hours}
						<div class="text-primary dark:text-white">
							<h4 class="uppercase text-primary dark:text-white">Hours</h4>

							<div class="justify-center justify-items-start md:flex">
								<Icon
									w="30"
									h="30"
									style="text-primary dark:text-white mx-auto md:mx-0 mb-2 md:mb-0 md:mr-2"
									icon="clock"
									type="popup"
								/>
								<time class="whitespace-pre-line">{formatWithLineBreaks(hours)}</time>
							</div>
						</div>
					{/if}
				</div>

				{#if description}
					<p class="mx-auto max-w-[600px] text-primary dark:text-white">{description}</p>
				{/if}

				{#if note}
					<p class="mx-auto max-w-[600px] text-primary dark:text-white">{note}</p>
				{/if}

				{#if dataInitialized}
					<div class="grid-cols-3 gap-12 space-y-12 lg:grid lg:space-y-0">
						<div class="flex flex-col justify-between text-primary dark:text-white">
							<h3 class="text-2xl font-semibold">Last Surveyed</h3>

							{#if verified.length}
								<div class="flex items-center justify-center">
									{#if Date.parse(verified[0]) > verifiedDate}
										<span bind:this={verifiedTooltip}>
											<Icon
												w="30"
												h="30"
												style="text-primary dark:text-white mr-2"
												icon="verified"
												type="popup"
											/>
										</span>
									{:else}
										<span bind:this={outdatedTooltip}>
											<Icon
												w="30"
												h="30"
												style="text-primary dark:text-white mr-2"
												icon="outdated"
												type="popup"
											/>
										</span>
									{/if}
									<strong>{verified[0]}</strong>
								</div>
							{:else}
								<p class="font-semibold">This location needs to be surveyed!</p>
							{/if}

							<PrimaryButton
								link={`/verify-location?id=${merchant?.id}`}
								style="rounded-xl p-3 w-40 mx-auto"
							>
								Verify Location
							</PrimaryButton>
						</div>

						<div class="space-y-4 text-primary dark:text-white">
							<h3 class="text-2xl font-semibold">Boost</h3>

							<p class="mx-auto max-w-[300px] font-semibold">
								{boosted
									? 'This location is boosted!'
									: "Boost this location to improve it's visibility on the map."}
							</p>

							{#if boosted}
								<p>
									Boost Expires: <span
										class="underline decoration-bitcoin decoration-4 underline-offset-8"
										><Time live={3000} relative={true} timestamp={boosted} /></span
									>
								</p>
							{/if}

							<BoostButton {merchant} {boosted} />
						</div>

						<div class="flex flex-col items-center space-y-4 text-primary dark:text-white">
							<a href="#comments" class="underline transition-colors hover:text-link">
								<h3 class="text-2xl font-semibold">
									Comments {#if data.comments.length}({data.comments.length}){/if}
								</h3>
							</a>

							<p class="mx-auto max-w-[300px] font-semibold">
								{#if data.comments.length}
									Let others know your toughts about this merchant
								{:else}
									No comments yet. Be the first to leave a comment!
								{/if}
							</p>

							{#if merchant}
								<CommentAddButton elementId={merchant.id} />
							{/if}
						</div>
					</div>
				{/if}
			</section>

			<section id="map-section">
				<h3
					class="rounded-t-3xl border border-b-0 border-statBorder p-5 text-center text-lg font-semibold text-primary dark:bg-white/10 dark:text-white lg:text-left"
				>
					{name || 'Merchant'} Location
				</h3>

				<div class="relative">
					<div
						bind:this={mapElement}
						class="z-10 h-[300px] rounded-b-3xl border border-statBorder !bg-teal text-left dark:!bg-[#202f33] md:h-[600px]"
					/>
					{#if !mapLoaded}
						<MapLoadingEmbed
							style="h-[300px] md:h-[600px] border border-statBorder rounded-b-3xl"
						/>
					{/if}
				</div>
			</section>

			<section id="comments">
				<div class="w-full rounded-3xl border border-statBorder dark:bg-white/10">
					<h3
						class="border-b border-statBorder p-5 text-center text-lg font-semibold text-primary dark:text-white lg:text-left"
					>
						{name || 'Merchant'} Comments
					</h3>

					<div class="hide-scroll relative max-h-[375px] space-y-2 overflow-y-scroll">
						<div class="relative space-y-2">
							{#if data.comments && data.comments.length}
								{#each [...data.comments].reverse() as comment (comment.id)}
									<MerchantComment text={comment.text} time={comment['created_at']} />
								{/each}
							{:else}
								<p class="p-5 text-body dark:text-white">No comments yet.</p>
							{/if}
						</div>
					</div>
				</div>
			</section>

			<section id="activity">
				<div class="w-full rounded-3xl border border-statBorder dark:bg-white/10">
					<h3
						class="border-b border-statBorder p-5 text-center text-lg font-semibold text-primary dark:text-white lg:text-left"
					>
						{name || 'Merchant'} Activity
					</h3>

					<div
						bind:this={activityDiv}
						class="hide-scroll relative max-h-[375px] space-y-2 overflow-y-scroll"
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
			</section>

			<section id="communities">
				<div class="w-full rounded-3xl border border-statBorder dark:bg-white/10">
					<h3
						class="border-b border-statBorder p-5 text-center text-lg font-semibold text-primary dark:text-white lg:text-left"
					>
						{name || 'Merchant'} Communities
					</h3>
					<div
						class="hide-scroll flex max-h-[375px] flex-wrap items-center justify-center overflow-scroll p-1"
					>
						{#if filteredCommunities && filteredCommunities.length}
							{#each filteredCommunities as community (community.id)}
								<div class="m-4 space-y-1 transition-transform hover:scale-110">
									<a href="/community/{community.id}">
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
									href="/communities/add"
									class="text-link transition-colors hover:text-hover">created</a
								> to help maintain this local area.
							</p>
						{/if}
					</div>
				</div>
			</section>

			<p class="text-center text-sm text-body dark:text-white md:text-left">
				*More information on bitcoin mapping tags can be found <a
					href="https://gitea.btcmap.org/teambtcmap/btcmap-general/wiki/Tagging-Merchants#tagging-guidance"
					target="_blank"
					rel="noreferrer"
					class="text-link transition-colors hover:text-hover">here</a
				>.
			</p>
		</main>

		<Footer />
	</div>

	{#if browser}
		<Boost />
	{/if}

	<ShowTags />
	<TaggingIssues />
</div>
