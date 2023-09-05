<script>
	export let data;

	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import Chart from 'chart.js/auto';
	import { browser } from '$app/environment';
	import { onMount, onDestroy } from 'svelte';
	import { users, events, elements, excludeLeader, theme } from '$lib/store';
	import {
		attribution,
		changeDefaultIcons,
		calcVerifiedDate,
		latCalc,
		longCalc,
		generateIcon,
		generateMarker,
		toggleMapButtons,
		geolocate
	} from '$lib/map/setup';
	import { errToast, detectTheme } from '$lib/utils';
	import { error } from '@sveltejs/kit';
	import {
		Header,
		Footer,
		Tip,
		ProfileStat,
		ProfileActivity,
		ProfileActivitySkeleton,
		TopButton,
		MapLoading
	} from '$comp';

	let user = $users.find((user) => user.id == data.user);
	if (!user) {
		errToast('Could not find user, please try again or contact BTC Map.');
		throw error(404, 'User Not Found');
	}
	let userCreated = user['created_at'];
	let supporter =
		user.tags['supporter:expires'] && Date.parse(user.tags['supporter:expires']) > Date.now();
	user = user['osm_json'];
	let avatar = user.img ? user.img.href : '/images/satoshi-nakamoto.png';
	let username = user['display_name'];
	let description = user.description;
	let removeLightning = description.match(/(\[⚡]\(lightning:[^)]+\))/g);
	let filteredDesc = description.replaceAll(removeLightning, '');
	let profileDesc;
	let regexMatch = description.match('(lightning:[^)]+)');
	let lightning = regexMatch && regexMatch[0].slice(10);

	let userEvents = $events.filter((event) => event['user_id'] == user.id);
	userEvents.sort((a, b) => Date.parse(b['created_at']) - Date.parse(a['created_at']));
	let created =
		user.id == '17221642'
			? userEvents.filter((event) => event.type === 'create').length + 100
			: userEvents.filter((event) => event.type === 'create').length;
	let updated =
		user.id == '17221642'
			? userEvents.filter((event) => event.type === 'update').length + 20
			: userEvents.filter((event) => event.type === 'update').length;
	let deleted = userEvents.filter((event) => event.type === 'delete').length;
	let total = created + updated + deleted;

	let leaderboard = [];

	const populateLeaderboard = () => {
		$users.forEach((user) => {
			if ($excludeLeader.includes(user.id)) {
				return;
			}

			let userEvents = $events.filter((event) => event['user_id'] == user.id);

			if (userEvents.length) {
				leaderboard.push({
					id: user.id,
					total: user.id == '17221642' ? userEvents.length + 120 : userEvents.length
				});
			}
		});

		leaderboard.sort((a, b) => b.total - a.total);
		leaderboard = leaderboard.slice(0, 10);
	};
	populateLeaderboard();

	let badges = [
		{ check: [10396321, 17441326, 17199501, 668096, 17462838, 17221642, 5432507, 17354902, 18452174, 18360665, 616774, 18062435, 7522075, 18380975, 1697546, 19288099, 11903494, 18552145, 1836965, 19795869, 17872, 19768735, 17573979, 2929493, 19714509, 1851550, 18244560, 19756689, 527105, 2339960, 17322349, 17300693, 1236325, 1787080].includes(user.id), title: 'Geyser Tournament', icon: 'geyser', type: 'achievement' },
		{ check: supporter, title: 'Supporter', icon: 'supporter', type: 'achievement' },
		{
			check: leaderboard[0].id == user.id,
			title: 'Top Tagger',
			icon: 'top-tagger',
			type: 'achievement'
		},
		{
			check: leaderboard.slice(0, 3).find((item) => item.id == user.id),
			title: 'Podium',
			icon: 'podium',
			type: 'achievement'
		},
		{
			check: leaderboard.find((item) => item.id == user.id),
			title: 'High Rank',
			icon: 'high-rank',
			type: 'achievement'
		},
		{
			check: Date.parse(userCreated) < new Date('December 26, 2022 00:00:00'),
			title: 'OG Supertagger',
			icon: 'og-supertagger',
			type: 'achievement'
		},
		{
			check: lightning,
			title: 'Lightning Junkie',
			icon: 'lightning-junkie',
			type: 'achievement'
		},
		{
			check: user.img,
			title: 'Hello World',
			icon: 'hello-world',
			type: 'achievement'
		},
		{
			check: created > updated && created > deleted,
			title: 'Creator',
			icon: 'creator',
			type: 'achievement'
		},
		{
			check: updated > created && updated > deleted,
			title: 'Update Maxi',
			icon: 'update-maxi',
			type: 'achievement'
		},
		{
			check: deleted > created && deleted > updated,
			title: 'Demolition Specialist',
			icon: 'demolition-specialist',
			type: 'achievement'
		},
		{
			check: total >= 21000000,
			title: 'Hyperbitcoinisation',
			icon: 'hyperbitcoinisation',
			type: 'contribution'
		},
		{ check: total >= 10000, title: 'Pizza Time', icon: 'pizza-time', type: 'contribution' },
		{ check: total >= 7777, title: 'Godly', icon: 'godly', type: 'contribution' },
		{ check: total >= 5000, title: 'Shadow', icon: 'shadow', type: 'contribution' },
		{ check: total >= 3110, title: 'Whitepaper', icon: 'whitepaper', type: 'contribution' },
		{ check: total >= 1984, title: 'Winston', icon: 'winston', type: 'contribution' },
		{ check: total >= 1000, title: 'Whale', icon: 'whale', type: 'contribution' },
		{ check: total >= 821, title: 'Infinity', icon: 'infinity', type: 'contribution' },
		{ check: total >= 500, title: 'Legend', icon: 'legend', type: 'contribution' },
		{ check: total >= 301, title: 'Chancellor', icon: 'chancellor', type: 'contribution' },
		{ check: total >= 256, title: 'SHA', icon: 'sha', type: 'contribution' },
		{ check: total >= 210, title: 'No Bailouts', icon: 'no-bailouts', type: 'contribution' },
		{ check: total >= 100, title: 'Supertagger', icon: 'supertagger', type: 'contribution' },
		{ check: total >= 69, title: 'ATH', icon: 'ath', type: 'contribution' },
		{ check: total >= 51, title: 'Longest Chain', icon: 'longest-chain', type: 'contribution' },
		{ check: total >= 21, title: 'Satoshi', icon: 'satoshi', type: 'contribution' },
		{ check: total >= 10, title: 'Heartbeat', icon: 'heartbeat', type: 'contribution' },
		{ check: total >= 4, title: 'Segwit', icon: 'segwit', type: 'contribution' },
		{ check: total >= 1, title: 'Whole Tagger', icon: 'whole-tagger', type: 'contribution' }
	];

	let earnedBadges = [];

	const addBadge = (check, title, icon, type) => {
		if (check) {
			earnedBadges.push({ title, icon, type });
		}
	};

	badges.some((badge) => {
		if (earnedBadges.find((badge) => badge.type === 'contribution')) {
			return true;
		}
		addBadge(badge.check, badge.title, badge.icon, badge.type);
	});

	let createdPercent = new Intl.NumberFormat('en-US')
		.format((created / (total / 100)).toFixed(0))
		.toString();

	let updatedPercent = new Intl.NumberFormat('en-US')
		.format((updated / (total / 100)).toFixed(0))
		.toString();

	let deletedPercent = new Intl.NumberFormat('en-US')
		.format((deleted / (total / 100)).toFixed(0))
		.toString();

	let tagTypeChartCanvas;
	// eslint-disable-next-line no-unused-vars
	let tagTypeChart;

	let loading = true;
	let hideArrow = false;
	let activityDiv;
	let eventElements = [];

	userEvents.forEach((event) => {
		let elementMatch = $elements.find((element) => element.id === event['element_id']);

		if (elementMatch) {
			let location =
				elementMatch['osm_json'].tags && elementMatch['osm_json'].tags.name
					? elementMatch['osm_json'].tags.name
					: undefined;

			event.location = location ? location : 'Unnamed element';
			event.merchantId = elementMatch.id;

			eventElements.push(event);
		}
	});

	let eventCount = 50;
	$: eventElementsPaginated = eventElements.slice(0, eventCount);

	loading = false;

	let mapElement;
	let map;
	let mapLoaded;

	let osm;
	let alidadeSmoothDark;

	onMount(async () => {
		if (browser) {
			const theme = detectTheme();

			// add markdown support for profile description
			profileDesc.innerHTML = DOMPurify.sanitize(marked.parse(filteredDesc));

			// setup chart
			tagTypeChartCanvas.getContext('2d');

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

			//import packages
			const leaflet = await import('leaflet');
			const DomEvent = await import('leaflet/src/dom/DomEvent');
			/* eslint-disable no-unused-vars */
			const leafletMarkerCluster = await import('leaflet.markercluster');
			const leafletLocateControl = await import('leaflet.locatecontrol');
			/* eslint-enable no-unused-vars */

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
			// eslint-disable-next-line no-undef
			L.Icon.Default.prototype.options.imagePath = '/icons/';

			// add OSM attribution
			// eslint-disable-next-line no-undef
			attribution(L, map);

			// add locate button to map
			// eslint-disable-next-line no-undef
			geolocate(L, map);

			// change default icons
			// eslint-disable-next-line no-undef
			changeDefaultIcons('', L, mapElement, DomEvent);

			// create marker cluster group
			// eslint-disable-next-line no-undef
			let markers = L.markerClusterGroup();

			// get date from 1 year ago to add verified check if survey is current
			let verifiedDate = calcVerifiedDate();

			// filter elements edited by user
			let filteredElements = $elements.filter((element) =>
				userEvents.find((event) => event['element_id'] === element.id)
			);

			// add location information
			let bounds = [];

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

				element = element['osm_json'];

				const lat = latCalc(element);
				const long = longCalc(element);

				// eslint-disable-next-line no-undef
				let divIcon = generateIcon(L, icon, boosted);

				let marker = generateMarker(
					lat,
					long,
					divIcon,
					element,
					payment,
					// eslint-disable-next-line no-undef
					L,
					verifiedDate,
					'verify',
					boosted
				);

				markers.addLayer(marker);
				bounds.push({ lat, long });
			});

			map.addLayer(markers);
			map.fitBounds(bounds.map(({ lat, long }) => [lat, long]));

			mapLoaded = true;
		}
	});

	$: $theme !== undefined && mapLoaded === true && toggleMapButtons();

	const closePopup = () => {
		map.closePopup();
	};

	$: $theme !== undefined && mapLoaded === true && closePopup();

	const toggleTheme = () => {
		if ($theme === 'dark') {
			osm.remove();
			alidadeSmoothDark.addTo(map);
		} else {
			alidadeSmoothDark.remove();
			osm.addTo(map);
		}
	};

	$: $theme !== undefined && mapLoaded === true && toggleTheme();

	onDestroy(async () => {
		if (map) {
			console.log('Unloading Leaflet map.');
			map.remove();
		}
	});
</script>

<svelte:head>
	{#if lightning}
		<meta name="lightning" content="lnurlp:{lightning}" />
		<meta property="alby:image" content={avatar} />
		<meta property="alby:name" content={username} />
	{:else}
		<meta
			name="lightning"
			content="lnurlp:LNURL1DP68GURN8GHJ7CM0WFJJUCN5VDKKZUPWDAEXWTMVDE6HYMRS9ARKXVN4W5EQPSYZ34"
		/>
		<meta property="alby:image" content="/images/logo.svg" />
		<meta property="alby:name" content="BTC Map" />
	{/if}
</svelte:head>

<div class="bg-teal dark:bg-dark">
	<Header />
	<div class="mx-auto w-10/12 xl:w-[1200px]">
		<main class="my-10 text-center md:my-20">
			<section id="profile" class="space-y-8">
				<img
					src={avatar}
					alt="avatar"
					class="mx-auto h-32 w-32 rounded-full object-cover"
					onerror="this.src='/images/satoshi-nakamoto.png'"
				/>

				<div>
					<h1 class="text-4xl font-semibold !leading-tight text-primary dark:text-white">
						{username}
					</h1>
					<a
						href="https://www.openstreetmap.org/user/{username}"
						target="_blank"
						rel="noreferrer"
						class="mx-auto mt-1 flex w-24 items-center justify-center text-xs text-link transition-colors hover:text-hover"
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
				</div>

				<!-- eslint-disable-next-line svelte/valid-compile -->
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
				</div>
			</section>

			<section id="stats" class="mb-16 mt-10">
				<div
					class="grid rounded-t-3xl border border-statBorder dark:bg-white/10 md:grid-cols-2 xl:grid-cols-4"
				>
					<ProfileStat
						title="Total Tags"
						stat={total}
						percent=""
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
					<ProfileStat title="Deleted" stat={deleted} percent={deletedPercent} border="" />
				</div>

				<div class="rounded-b-3xl border border-t-0 border-statBorder p-5 dark:bg-white/10">
					<canvas bind:this={tagTypeChartCanvas} width="250" height="250" />
				</div>
			</section>

			<section id="activity" class="my-16">
				<div class="w-full rounded-3xl border border-statBorder dark:bg-white/10">
					<h3
						class="border-b border-statBorder p-5 text-center text-lg font-semibold text-primary dark:text-white md:text-left"
					>
						{username}'s Activity
					</h3>

					<div
						bind:this={activityDiv}
						class="hide-scroll space-y-2 {eventElements.length > 5
							? 'h-[375px]'
							: ''} relative overflow-y-scroll"
						on:scroll={() => {
							if (!loading && !hideArrow) {
								hideArrow = true;
							}
						}}
					>
						{#if eventElements && eventElements.length && !loading}
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
							<!-- eslint-disable-next-line no-unused-vars -->
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
					{username}'s Map
				</h3>

				<div class="relative mb-2">
					<div
						bind:this={mapElement}
						class="z-10 h-[300px] rounded-b-3xl border border-statBorder !bg-teal text-left dark:!bg-[#202f33] md:h-[600px]"
					/>
					{#if !mapLoaded}
						<MapLoading
							type="embed"
							style="h-[300px] md:h-[600px] border border-statBorder rounded-b-3xl"
						/>
					{/if}
				</div>
			</section>
		</main>

		<Footer />
	</div>
</div>

<style>
	@import 'leaflet/dist/leaflet.css';
	@import 'leaflet.markercluster/dist/MarkerCluster.css';
	@import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
	@import 'leaflet.locatecontrol/dist/L.Control.Locate.min.css';
</style>
