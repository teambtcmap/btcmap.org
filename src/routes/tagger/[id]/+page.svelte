<script>
	export let data;

	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import Chart from 'chart.js/dist/chart.min.js';
	import { browser } from '$app/environment';
	import { onMount, onDestroy } from 'svelte';
	import { users, events, elements } from '$lib/store';
	import {
		attribution,
		fullscreenButton,
		changeDefaultIcons,
		calcVerifiedDate,
		latCalc,
		longCalc,
		generateMarker
	} from '$lib/map/setup';
	import { errToast } from '$lib/utils';
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

	let user = $users.find((user) => user.id === data.user)['osm_json'];
	if (!user) {
		errToast('Could not find user, please try again or contact BTC Map.');
		throw error(404, 'User Not Found');
	}
	let avatar = user.img ? user.img.href : '/images/satoshi-nakamoto.png';
	let username = user['display_name'];
	let description = user.description;
	let removeLightning = description.match(/(\[⚡]\(lightning:[^)]+\))/g);
	let filteredDesc = description.replaceAll(removeLightning, '');
	let profileDesc;
	let regexMatch = description.match('(lightning:[^)]+)');
	let lightning = regexMatch && regexMatch[0].slice(10);

	let userEvents = $events.filter((event) => event['user_id'] == user.id);
	let created = userEvents.filter((event) => event.type === 'create').length;
	let updated = userEvents.filter((event) => event.type === 'update').length;
	let deleted = userEvents.filter((event) => event.type === 'delete').length;
	let total = created + updated + deleted;

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
			event.lat = elementMatch['osm_json'].lat;
			event.long = elementMatch['osm_json'].lon;

			eventElements.push(event);
		}
	});

	loading = false;

	let mapElement;
	let map;
	let mapLoaded;

	onMount(async () => {
		if (browser) {
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
			const leafletMarkerCluster = await import('leaflet.markercluster');

			// add map and tiles
			map = leaflet.map(mapElement, { attributionControl: false });

			const osm = leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				noWrap: true,
				maxZoom: 19
			});

			osm.addTo(map);

			// change broken marker image path in prod
			L.Icon.Default.prototype.options.imagePath = '/icons/';

			// add OSM attribution
			attribution(L, map);

			// change default icons
			changeDefaultIcons();

			// add fullscreen button to map
			fullscreenButton(L, mapElement, map, DomEvent);

			// create marker cluster group
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
				element = element['osm_json'];
				const lat = latCalc(element);
				const long = longCalc(element);

				let marker = generateMarker(lat, long, element, L, verifiedDate, 'report');

				markers.addLayer(marker);
				bounds.push({ lat, long });
			});

			map.addLayer(markers);
			map.fitBounds(bounds.map(({ lat, long }) => [lat, long]));

			mapLoaded = true;
		}
	});

	onDestroy(async () => {
		if (map) {
			console.log('Unloading Leaflet map.');
			map.remove();
		}
	});
</script>

<div class="bg-teal">
	<Header />
	<div class="w-10/12 xl:w-[1200px] mx-auto">
		<main class="text-center my-10 md:my-20">
			<section id="profile" class="space-y-8">
				<img src={avatar} alt="avatar" class="rounded-full w-32 h-32 object-cover mx-auto" />

				<div>
					<h1 class="text-4xl font-semibold text-primary !leading-tight">
						{username}
					</h1>
					<a
						href="https://www.openstreetmap.org/user/{username}"
						target="_blank"
						rel="noreferrer"
						class="w-24 mx-auto mt-1 text-xs text-link hover:text-hover flex justify-center items-center"
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

				<h2
					bind:this={profileDesc}
					class="break-all text-body text-xl w-full lg:w-[800px] mx-auto"
				/>

				{#if lightning}
					<Tip destination={lightning} user={username} />
				{/if}
			</section>

			<section id="badges" class="" />

			<section id="stats" class="my-16">
				<div class="border border-statBorder rounded-t-3xl grid md:grid-cols-2 xl:grid-cols-4">
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

				<div class="border border-statBorder border-t-0 rounded-b-3xl p-5">
					<canvas bind:this={tagTypeChartCanvas} width="250" height="250" />
				</div>
			</section>

			<section id="activity" class="my-16">
				<div class="w-full border border-statBorder rounded-3xl">
					<h3
						class="text-center md:text-left text-primary text-lg border-b border-statBorder p-5 font-semibold"
					>
						{username}'s Activity
					</h3>

					<div
						bind:this={activityDiv}
						class="hide-scroll space-y-2 {eventElements.length > 5
							? 'h-[375px]'
							: ''} overflow-y-scroll relative"
						on:scroll={() => {
							if (!loading && !hideArrow) {
								hideArrow = true;
							}
						}}
					>
						{#if eventElements && eventElements.length && !loading}
							{#each eventElements as event}
								<ProfileActivity
									location={event.location}
									action={event.type}
									time={event['created_at']}
									latest={event === eventElements[0] ? true : false}
									lat={event.lat}
									long={event.long}
								/>
							{/each}

							{#if eventElements.length > 10}
								<TopButton scroll={activityDiv} style="!mb-5" />
							{/if}

							{#if !hideArrow && eventElements.length > 5}
								<svg
									class="z-20 w-4 h-4 animate-bounce text-primary absolute bottom-4 left-[calc(50%-8px)]"
									fill="currentColor"
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 512 512"
									><!--! Font Awesome Pro 6.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path
										d="M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z"
									/></svg
								>
							{/if}
						{:else}
							{#each Array(5) as skeleton}
								<ProfileActivitySkeleton />
							{/each}
						{/if}
					</div>
				</div>
			</section>

			<section id="map-section">
				<h3
					class="text-center md:text-left text-primary text-lg border border-statBorder border-b-0 rounded-t-3xl p-5 font-semibold"
				>
					{username}'s Map
				</h3>

				<div class="relative mb-2">
					<div
						bind:this={mapElement}
						class="!bg-teal z-10 border border-statBorder rounded-b-3xl h-[300px] md:h-[600px]"
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
</style>
