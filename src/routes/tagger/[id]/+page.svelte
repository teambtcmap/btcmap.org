<script lang="ts">
	export let data;

	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import {
		Footer,
		Header,
		MapLoadingEmbed,
		ProfileActivity,
		ProfileActivitySkeleton,
		ProfileStat,
		Tip,
		TopButton
	} from '$lib/comp';
	import {
		attribution,
		calcVerifiedDate,
		changeDefaultIcons,
		generateIcon,
		generateMarker,
		geolocate,
		latCalc,
		longCalc,
		toggleMapButtons
	} from '$lib/map/setup';
	import {
		elementError,
		elements,
		eventError,
		events,
		excludeLeader,
		theme,
		userError,
		users
	} from '$lib/store';
	import parseNostrIdentity from '$lib/parseNostrIdentity.ts';
	import {
		BadgeType,
		type ActivityEvent,
		type DomEventType,
		type EarnedBadge,
		type Leaflet,
		type ProfileLeaderboard
	} from '$lib/types.js';
	import { detectTheme, errToast, formatElementID } from '$lib/utils';
	import Chart from 'chart.js/auto';
	import { format } from 'date-fns';
	import DOMPurify from 'dompurify';
	import type { Map, TileLayer } from 'leaflet';
	import { marked } from 'marked';
	import { onDestroy, onMount } from 'svelte';

	// alert for user errors
	$: $userError && errToast($userError);
	// alert for event errors
	$: $eventError && errToast($eventError);
	// alert for element errors
	$: $elementError && errToast($elementError);

	let dataInitialized = false;
	let initialRenderComplete = false;

	let leaflet: Leaflet;
	let DomEvent: DomEventType;

	const initializeData = async () => {
		if (dataInitialized) return;

		const userFound = $users.find((user) => user.id == data.user);
		if (!userFound) {
			console.log('Could not find user, please try again or contact BTC Map.');
			goto('/404');
			return;
		}
		userCreated = userFound['created_at'];
		supporter = Boolean(
			userFound.tags['supporter:expires'] &&
				Date.parse(userFound.tags['supporter:expires']) > Date.now()
		);
		const user = userFound['osm_json'];
		avatar = user.img ? user.img.href : '/images/satoshi-nakamoto.png';
		mappingSince = user['account_created'];
		const description = user.description;
		const removeLightning = description.match(/(\[⚡]\(lightning:[^)]+\))/g);
		filteredDesc = removeLightning?.length
			? description.replaceAll(removeLightning[0], '')
			: description;
		const regexMatch = description.match('(lightning:[^)]+)');
		lightning = regexMatch && regexMatch[0].slice(10);
		const {exists, checksum, npub, hex} = parseNostrIdentity(user)

		const userEvents = $events.filter((event) => event['user_id'] == user.id);
		userEvents.sort((a, b) => Date.parse(b['created_at']) - Date.parse(a['created_at']));
		created =
			user.id === 17221642
				? userEvents.filter((event) => event.type === 'create').length + 100
				: userEvents.filter((event) => event.type === 'create').length;
		updated =
			user.id === 17221642
				? userEvents.filter((event) => event.type === 'update').length + 20
				: userEvents.filter((event) => event.type === 'update').length;
		deleted = userEvents.filter((event) => event.type === 'delete').length;
		total = created + updated + deleted;

		const populateLeaderboard = () => {
			$users.forEach((user) => {
				if ($excludeLeader.includes(user.id)) {
					return;
				}

				let userEvents = $events.filter((event) => event['user_id'] == user.id);

				if (userEvents.length) {
					leaderboard.push({
						id: user.id,
						total: user.id === 17221642 ? userEvents.length + 120 : userEvents.length
					});
				}
			});

			leaderboard.sort((a, b) => b.total - a.total);
			leaderboard = leaderboard.slice(0, 10);
		};
		populateLeaderboard();

		const badges = [
			{
				check: [
					10396321, 17441326, 17199501, 668096, 17462838, 17221642, 5432507, 17354902, 18452174,
					18360665, 616774, 18062435, 7522075, 18380975, 1697546, 19288099, 11903494, 18552145,
					1836965, 19795869, 17872, 19768735, 17573979, 2929493, 19714509, 1851550, 18244560,
					19756689, 527105, 2339960, 17322349, 17300693, 1236325, 1787080
				].includes(user.id),
				title: 'Geyser Tournament',
				icon: 'geyser',
				type: BadgeType.Achievement
			},
			{ check: supporter, title: 'Supporter', icon: 'supporter', type: BadgeType.Achievement },
			{
				check: leaderboard[0].id == user.id,
				title: 'Top Tagger',
				icon: 'top-tagger',
				type: BadgeType.Achievement
			},
			{
				check: Boolean(leaderboard.slice(0, 3).find((item) => item.id == user.id)),
				title: 'Podium',
				icon: 'podium',
				type: BadgeType.Achievement
			},
			{
				check: Boolean(leaderboard.find((item) => item.id == user.id)),
				title: 'High Rank',
				icon: 'high-rank',
				type: BadgeType.Achievement
			},
			{
				check: Date.parse(userCreated) < new Date('December 26, 2022 00:00:00').getTime(),
				title: 'OG Supertagger',
				icon: 'og-supertagger',
				type: BadgeType.Achievement
			},
			{
				check: Boolean(lightning),
				title: 'Lightning Junkie',
				icon: 'lightning-junkie',
				type: BadgeType.Achievement
			},
			{
				check: Boolean(user.img),
				title: 'Hello World',
				icon: 'hello-world',
				type: BadgeType.Achievement
			},
			{
				check: created > updated && created > deleted,
				title: 'Creator',
				icon: 'creator',
				type: BadgeType.Achievement
			},
			{
				check: updated > created && updated > deleted,
				title: 'Update Maxi',
				icon: 'update-maxi',
				type: BadgeType.Achievement
			},
			{
				check: deleted > created && deleted > updated,
				title: 'Demolition Specialist',
				icon: 'demolition-specialist',
				type: BadgeType.Achievement
			},
			{
				check: total >= 21000000,
				title: 'Hyperbitcoinisation',
				icon: 'hyperbitcoinisation',
				type: BadgeType.Contribution
			},
			{
				check: total >= 10000,
				title: 'Pizza Time',
				icon: 'pizza-time',
				type: BadgeType.Contribution
			},
			{ check: total >= 7777, title: 'Godly', icon: 'godly', type: BadgeType.Contribution },
			{ check: total >= 5000, title: 'Shadow', icon: 'shadow', type: BadgeType.Contribution },
			{
				check: total >= 3110,
				title: 'Whitepaper',
				icon: 'whitepaper',
				type: BadgeType.Contribution
			},
			{ check: total >= 1984, title: 'Winston', icon: 'winston', type: BadgeType.Contribution },
			{ check: total >= 1000, title: 'Whale', icon: 'whale', type: BadgeType.Contribution },
			{ check: total >= 821, title: 'Infinity', icon: 'infinity', type: BadgeType.Contribution },
			{ check: total >= 500, title: 'Legend', icon: 'legend', type: BadgeType.Contribution },
			{
				check: total >= 301,
				title: 'Chancellor',
				icon: 'chancellor',
				type: BadgeType.Contribution
			},
			{ check: total >= 256, title: 'SHA', icon: 'sha', type: BadgeType.Contribution },
			{
				check: total >= 210,
				title: 'No Bailouts',
				icon: 'no-bailouts',
				type: BadgeType.Contribution
			},
			{
				check: total >= 100,
				title: 'Supertagger',
				icon: 'supertagger',
				type: BadgeType.Contribution
			},
			{ check: total >= 69, title: 'ATH', icon: 'ath', type: BadgeType.Contribution },
			{
				check: total >= 51,
				title: 'Longest Chain',
				icon: 'longest-chain',
				type: BadgeType.Contribution
			},
			{ check: total >= 21, title: 'Satoshi', icon: 'satoshi', type: BadgeType.Contribution },
			{ check: total >= 10, title: 'Heartbeat', icon: 'heartbeat', type: BadgeType.Contribution },
			{ check: total >= 4, title: 'Segwit', icon: 'segwit', type: BadgeType.Contribution },
			{
				check: total >= 1,
				title: 'Whole Tagger',
				icon: 'whole-tagger',
				type: BadgeType.Contribution
			}
		];

		const addBadge = (check: boolean, title: string, icon: string, type: BadgeType) => {
			if (check) {
				earnedBadges.push({ title, icon, type });
			}
		};

		badges.some((badge) => {
			if (earnedBadges.find((badge) => badge.type === BadgeType.Contribution)) {
				return true;
			}
			addBadge(Boolean(badge.check), badge.title, badge.icon, badge.type);
		});

		createdPercent = new Intl.NumberFormat('en-US').format(
			Number((created / (total / 100)).toFixed(0))
		);

		updatedPercent = new Intl.NumberFormat('en-US').format(
			Number((updated / (total / 100)).toFixed(0))
		);

		deletedPercent = new Intl.NumberFormat('en-US').format(
			Number((deleted / (total / 100)).toFixed(0))
		);

		userEvents.forEach((event) => {
			let elementMatch = $elements.find((element) => element.id === event['element_id']);

			let location =
				elementMatch?.['osm_json'].tags && elementMatch['osm_json'].tags.name
					? elementMatch['osm_json'].tags.name
					: undefined;

			eventElements.push({
				...event,
				location: location || formatElementID(event['element_id']),
				merchantId: event['element_id']
			});
		});

		eventElements = eventElements;

		// add markdown support for profile description
		const markdown = await marked.parse(filteredDesc);
		profileDesc.innerHTML = DOMPurify.sanitize(markdown);

		const setupChart = () => {
			tagTypeChart = new Chart(tagTypeChartCanvas, {
				type: 'pie',
				data: {
					labels: ['Created', 'Updated', 'Deleted'],
					datasets: [
						{
							label: 'Tag Types',
							data: [created, updated, deleted],
							backgroundColor: ['rgb(16, 183, 145)', 'rgb(0, 153, 175)', 'rgb(235, 87, 87)'],
							hoverOffset: 4
						}
					]
				},
				options: {
					maintainAspectRatio: false,
					plugins: {
						legend: {
							labels: {
								font: {
									weight: 600
								}
							}
						}
					}
				}
			});
		};
		setupChart();

		const setupMap = () => {
			const theme = detectTheme();

			// add map and tiles
			map = leaflet.map(mapElement, { attributionControl: false });

			osm = leaflet.tileLayer('https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png', {
				noWrap: true,
				maxZoom: 20
			});

			alidadeSmoothDark = leaflet.tileLayer(
				'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
				{
					noWrap: true,
					maxZoom: 20
				}
			);

			if (theme === 'dark') {
				alidadeSmoothDark.addTo(map);
			} else {
				osm.addTo(map);
			}

			// change broken marker image path in prod
			leaflet.Icon.Default.prototype.options.imagePath = '/icons/';

			// add OSM attribution
			attribution(leaflet, map);

			// add locate button to map
			geolocate(leaflet, map);

			// change default icons
			changeDefaultIcons(false, leaflet, mapElement, DomEvent);

			// create marker cluster group
			/* eslint-disable no-undef */
			// @ts-expect-error
			let markers = L.markerClusterGroup();
			/* eslint-enable no-undef */

			// get date from 1 year ago to add verified check if survey is current
			let verifiedDate = calcVerifiedDate();

			// filter elements edited by user
			let filteredElements = $elements.filter((element) =>
				userEvents.find((event) => event['element_id'] === element.id)
			);

			// add location information
			let bounds: { lat: number; long: number }[] = [];

			filteredElements.forEach((element) => {
				let icon = element.tags['icon:android'];
				let payment = element.tags['payment:uri']
					? { type: 'uri', url: element.tags['payment:uri'] }
					: element.tags['payment:pouch']
						? { type: 'pouch', username: element.tags['payment:pouch'] }
						: element.tags['payment:coinos']
							? { type: 'coinos', username: element.tags['payment:coinos'] }
							: undefined;
				let boosted =
					element.tags['boost:expires'] && Date.parse(element.tags['boost:expires']) > Date.now()
						? element.tags['boost:expires']
						: undefined;

				const elementOSM = element['osm_json'];

				const lat = latCalc(elementOSM);
				const long = longCalc(elementOSM);

				let divIcon = generateIcon(leaflet, icon, boosted ? true : false);

				let marker = generateMarker(
					lat,
					long,
					divIcon,
					elementOSM,
					payment,
					leaflet,
					verifiedDate,
					true,
					boosted
				);

				markers.addLayer(marker);
				bounds.push({ lat, long });
			});

			map.addLayer(markers);
			map.fitBounds(bounds.map(({ lat, long }) => [lat, long]));

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
		initialRenderComplete &&
		!dataInitialized &&
		initializeData();

	let userCreated: string | undefined;
	let supporter: boolean | undefined;
	let avatar: string | undefined;
	let mappingSince: string | undefined;
	let username = data.username;
	let filteredDesc: string | undefined;
	let profileDesc: HTMLHeadingElement;
	let lightning: string | null;

	let created: number | undefined;
	let updated: number | undefined;
	let deleted: number | undefined;
	let total: number | undefined;

	let leaderboard: ProfileLeaderboard[] = [];

	let earnedBadges: EarnedBadge[] = [];

	let createdPercent: string | undefined;
	let updatedPercent: string | undefined;
	let deletedPercent: string | undefined;

	let tagTypeChartCanvas: HTMLCanvasElement;
	// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
	let tagTypeChart;

	let hideArrow = false;
	let activityDiv;
	let eventElements: ActivityEvent[] = [];

	let eventCount = 50;
	$: eventElementsPaginated = eventElements.slice(0, eventCount);

	let mapElement: HTMLDivElement;
	let map: Map;
	let mapLoaded = false;

	let osm: TileLayer;
	let alidadeSmoothDark: TileLayer;

	onMount(async () => {
		if (browser) {
			// setup chart
			tagTypeChartCanvas.getContext('2d');

			//import packages
			leaflet = await import('leaflet');
			// @ts-expect-error
			DomEvent = await import('leaflet/src/dom/DomEvent');
			/* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
			const leafletMarkerCluster = await import('leaflet.markercluster');
			const leafletLocateControl = await import('leaflet.locatecontrol');
			/* eslint-enable no-unused-vars, @typescript-eslint/no-unused-vars */

			initialRenderComplete = true;
		}
	});

	$: $theme !== undefined && mapLoaded && toggleMapButtons();

	const closePopup = () => {
		map.closePopup();
	};

	$: $theme !== undefined && mapLoaded && closePopup();

	const toggleTheme = () => {
		if ($theme === 'dark') {
			osm.remove();
			alidadeSmoothDark.addTo(map);
		} else {
			alidadeSmoothDark.remove();
			osm.addTo(map);
		}
	};

	$: $theme !== undefined && mapLoaded && toggleTheme();

	onDestroy(async () => {
		if (map) {
			console.log('Unloading Leaflet map.');
			map.remove();
		}
	});
</script>

<svelte:head>
	<title>{username ? username + ' - ' : ''}BTC Map Supertagger</title>
	<meta property="og:image" content="https://btcmap.org/images/og/supertagger.png" />
	<meta property="twitter:title" content="{username ? username + ' - ' : ''}BTC Map Supertagger" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/supertagger.png" />
</svelte:head>

<div class="bg-teal dark:bg-dark">
	<Header />
	<div class="mx-auto w-10/12 xl:w-[1200px]">
		<main class="my-10 text-center md:my-20">
			<section id="profile" class="space-y-8">
				{#if avatar}
					<img
						src={avatar}
						alt="avatar"
						class="mx-auto h-32 w-32 rounded-full object-cover"
						on:error={function () {
							this.src = '/images/satoshi-nakamoto.png';
						}}
					/>
				{:else}
					<div class="mx-auto h-32 w-32 animate-pulse rounded-full bg-link/50" />
				{/if}

				<div class="space-y-1">
					<h1 class="text-4xl font-semibold !leading-tight text-primary dark:text-white">
						{username || 'BTC Map Supertagger'}
					</h1>
					<p
						class="flex items-center justify-center space-x-1 text-sm text-primary dark:text-white"
					>
						<i class="fa-solid fa-map-pin" />
						<span class="block">
							Mapping Since: {mappingSince ? format(new Date(mappingSince), 'yyyy-MM-dd') : '-'}
						</span>
					</p>
					{#if username}
						<a
							href="https://www.openstreetmap.org/user/{username}"
							target="_blank"
							rel="noreferrer"
							class="mx-auto flex w-24 items-center justify-center text-xs text-link transition-colors hover:text-hover"
							>OSM Profile <svg
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
				</div>

				<!-- svelte-ignore a11y-missing-content -->
				<h2
					bind:this={profileDesc}
					class="mx-auto w-full break-all text-xl text-body dark:text-white lg:w-[800px]"
				/>

				{#if lightning}
					<Tip destination={lightning} user={username} />
				{/if}
			</section>

			<section id="badges" class="mt-16">
				<div class="flex flex-wrap items-center justify-center">
					{#if dataInitialized}
						{#each earnedBadges as badge}
							<a href="/badges#{badge.icon}" class="transition-transform hover:scale-110">
								<div class="mx-3 mb-6">
									<img
										src="/icons/badges/{badge.icon}.svg"
										alt={badge.title}
										class="mx-auto mb-1 h-24 w-24"
									/>
									<p class="text-center text-sm dark:text-white">{badge.title}</p>
								</div>
							</a>
						{/each}
					{:else}
						<!-- eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars -->
						{#each Array(3) as badge}
							<div class="mx-3 mb-6">
								<div class="mx-auto mb-1 h-24 w-24 animate-pulse rounded-full bg-link/50" />
								<div class="mx-auto h-5 w-20 animate-pulse rounded bg-link/50" />
							</div>
						{/each}
					{/if}
				</div>
			</section>

			<section id="stats" class="mb-16 mt-10">
				<div
					class="grid rounded-t-3xl border border-statBorder dark:bg-white/10 md:grid-cols-2 xl:grid-cols-4"
				>
					<ProfileStat
						title="Total Tags"
						stat={total}
						border="border-b xl:border-b-0 md:border-r border-statBorder"
					/>
					<ProfileStat
						title="Created"
						stat={created}
						percent={createdPercent}
						border="border-b xl:border-b-0 xl:border-r border-statBorder"
					/>
					<ProfileStat
						title="Updated"
						stat={updated}
						percent={updatedPercent}
						border="border-b md:border-b-0 md:border-r border-statBorder"
					/>
					<ProfileStat title="Deleted" stat={deleted} percent={deletedPercent} />
				</div>

				<div
					class="relative rounded-b-3xl border border-t-0 border-statBorder p-5 dark:bg-white/10"
				>
					{#if !dataInitialized}
						<div>
							<i
								class="fa-solid fa-chart-pie absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 animate-pulse text-link/50 md:h-60 md:w-60"
							/>
						</div>
					{/if}

					<canvas bind:this={tagTypeChartCanvas} width="100%" height="250" />
				</div>
			</section>

			<section id="activity" class="my-16">
				<div class="w-full rounded-3xl border border-statBorder dark:bg-white/10">
					<h3
						class="border-b border-statBorder p-5 text-center text-lg font-semibold text-primary dark:text-white md:text-left"
					>
						{username || 'BTC Map Supertagger'}'s Activity
					</h3>

					<div
						bind:this={activityDiv}
						class="hide-scroll space-y-2 {eventElements.length > 5
							? 'h-[375px]'
							: ''} relative overflow-y-scroll"
						on:scroll={() => {
							if (dataInitialized && !hideArrow) {
								hideArrow = true;
							}
						}}
					>
						{#if eventElements && eventElements.length && dataInitialized}
							{#each eventElementsPaginated as event}
								<ProfileActivity
									location={event.location}
									action={event.type}
									time={event['created_at']}
									latest={event === eventElements[0] ? true : false}
									merchantId={event.merchantId}
								/>
							{/each}

							{#if eventElementsPaginated.length !== eventElements.length}
								<button
									class="mx-auto !mb-5 block text-xl font-semibold text-link transition-colors hover:text-hover"
									on:click={() => (eventCount = eventCount + 50)}>Load More</button
								>
							{:else if eventElements.length > 10}
								<TopButton scroll={activityDiv} style="!mb-5" />
							{/if}

							{#if !hideArrow && eventElements.length > 5}
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
						{:else}
							<!-- eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars -->
							{#each Array(5) as skeleton}
								<ProfileActivitySkeleton />
							{/each}
						{/if}
					</div>
				</div>
			</section>

			<section id="map-section">
				<h3
					class="rounded-t-3xl border border-b-0 border-statBorder p-5 text-center text-lg font-semibold text-primary dark:bg-white/10 dark:text-white md:text-left"
				>
					{username || 'BTC Map Supertagger'}'s Map
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

				<p class="text-center text-sm text-body dark:text-white lg:text-left">
					*Does not display deleted merchants.
				</p>
			</section>
		</main>

		<Footer />
	</div>
</div>
