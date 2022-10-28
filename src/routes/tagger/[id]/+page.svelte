<script>
	export let data;

	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import Chart from 'chart.js/dist/chart.min.js';
	import { browser } from '$app/environment';
	import { onMount, onDestroy } from 'svelte';
	import { users, events, elements } from '$lib/store';
	import { checkAddress } from '$lib/map/setup';
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
			map = leaflet.map(mapElement);

			const osm = leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				noWrap: true,
				maxZoom: 19
			});

			osm.addTo(map);

			// change broken marker image path in prod
			L.Icon.Default.prototype.options.imagePath = '/icons/';

			// add OSM attribution
			document.querySelector(
				'.leaflet-bottom.leaflet-right > .leaflet-control-attribution'
			).innerHTML =
				'&copy; <a href="http://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

			const attribution = document.querySelector(
				'.leaflet-bottom.leaflet-right > .leaflet-control-attribution'
			);
			attribution.style.borderRadius = '8px 0 0 0';
			attribution.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';

			// change default icons
			const leafletBar = document.querySelector('.leaflet-bar');
			leafletBar.style.border = 'none';
			leafletBar.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';

			const zoomIn = document.querySelector('.leaflet-control-zoom-in');
			zoomIn.style.borderRadius = '8px 8px 0 0';
			zoomIn.innerHTML = `<img src='/icons/plus.svg' alt='zoomin' class='inline' id='zoomin'/>`;
			zoomIn.onmouseenter = () => {
				document.querySelector('#zoomin').src = '/icons/plus-black.svg';
			};
			zoomIn.onmouseleave = () => {
				document.querySelector('#zoomin').src = '/icons/plus.svg';
			};

			const zoomOut = document.querySelector('.leaflet-control-zoom-out');
			zoomOut.style.borderRadius = '0 0 8px 8px';
			zoomOut.innerHTML = `<img src='/icons/minus.svg' alt='zoomout' class='inline' id='zoomout'/>`;
			zoomOut.onmouseenter = () => {
				document.querySelector('#zoomout').src = '/icons/minus-black.svg';
			};
			zoomOut.onmouseleave = () => {
				document.querySelector('#zoomout').src = '/icons/minus.svg';
			};

			// add fullscreen button to map
			const customFullScreenButton = L.Control.extend({
				options: {
					position: 'topleft'
				},
				onAdd: () => {
					const fullscreenDiv = L.DomUtil.create('div');
					fullscreenDiv.classList.add('leaflet-bar');
					fullscreenDiv.style.border = 'none';
					fullscreenDiv.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';

					const fullscreenButton = L.DomUtil.create('a');
					fullscreenButton.classList.add('leaflet-control-full-screen');
					fullscreenButton.href = '#';
					fullscreenButton.title = 'Full screen';
					fullscreenButton.role = 'button';
					fullscreenButton.ariaLabel = 'Full screen';
					fullscreenButton.ariaDisabled = 'false';
					fullscreenButton.innerHTML = `<img src='/icons/expand.svg' alt='fullscreen' class='inline' id='fullscreen'/>`;
					fullscreenButton.style.borderRadius = '8px';
					fullscreenButton.onclick = function toggleFullscreen() {
						if (!document.fullscreenElement) {
							mapElement.requestFullscreen().catch((err) => {
								errToast(
									`Error attempting to enable fullscreen mode: ${err.message} (${err.name})`
								);
							});
						} else {
							document.exitFullscreen();
						}
					};
					fullscreenButton.onmouseenter = () => {
						document.querySelector('#fullscreen').src = '/icons/expand-black.svg';
					};
					fullscreenButton.onmouseleave = () => {
						document.querySelector('#fullscreen').src = '/icons/expand.svg';
					};

					fullscreenDiv.append(fullscreenButton);

					return fullscreenDiv;
				}
			});

			map.addControl(new customFullScreenButton());

			// create marker cluster group
			let markers = L.markerClusterGroup();

			// get date from 1 year ago to add verified check if survey is current
			let verifiedDate = new Date();
			const previousYear = verifiedDate.getFullYear() - 1;
			verifiedDate.setFullYear(previousYear);

			// filter elements edited by user
			let filteredElements = $elements.filter((element) =>
				userEvents.find((event) => event['element_id'] === element.id)
			);

			// add location information
			let bounds = [];

			filteredElements.forEach((element) => {
				element = element['osm_json'];
				const latCalc =
					element.type == 'node'
						? element.lat
						: (element.bounds.minlat + element.bounds.maxlat) / 2;
				const longCalc =
					element.type == 'node'
						? element.lon
						: (element.bounds.minlon + element.bounds.maxlon) / 2;

				let marker = L.marker([latCalc, longCalc]).bindPopup(
					// marker popup component
					`${
						element.tags && element.tags.name
							? `<span class='block font-bold text-lg text-primary break-all leading-snug' title='Merchant name'>${element.tags.name}</span>`
							: ''
					}

                <span class='block text-body font-bold' title='Address'>${
									element.tags && checkAddress(element.tags)
								}</span>

                <div class='w-[211px] flex space-x-2 my-1'>
                  ${
										element.tags && element.tags.phone
											? `<a href='tel:${element.tags.phone}' title='Phone'><span class="bg-link hover:bg-hover rounded-full p-2 w-5 h-5 text-white fa-solid fa-phone" /></a>`
											: ''
									}

                  ${
										element.tags && element.tags.website
											? `<a href=${element.tags.website} target="_blank" rel="noreferrer" title='Website'><span class="bg-link hover:bg-hover rounded-full p-2 w-5 h-5 text-white fa-solid fa-globe" /></a>`
											: ''
									}

						      ${
										element.tags && element.tags['contact:twitter']
											? `<a href=${
													element.tags['contact:twitter'].startsWith('http')
														? element.tags['contact:twitter']
														: `https://twitter.com/${element.tags['contact:twitter']}`
											  } target="_blank" rel="noreferrer" title='Twitter'><span class="bg-link hover:bg-hover rounded-full p-2 w-5 h-5 text-white fa-brands fa-twitter" /></a>`
											: ''
									}

                  <a href='https://www.openstreetmap.org/edit?${element.type}=${
						element.id
					}' target="_blank" rel="noreferrer" title='Edit'><span class="bg-link hover:bg-hover rounded-full p-2 w-5 h-5 text-white fa-solid fa-pen-to-square" /></a>

                  <a href='https://btcmap.org/map?lat=${
										element.type == 'node' ? element.lat : latCalc
									}&long=${
						element.type == 'node' ? element.lon : longCalc
					}' target="_blank" rel="noreferrer" title='Share'><span class="bg-link hover:bg-hover rounded-full p-2 w-5 h-5 text-white fa-solid fa-share-nodes" /></a>
                </div>

                   <div class='w-full flex space-x-2 my-1'>
	                   <img src=${
												element.tags && element.tags['payment:onchain'] === 'yes'
													? '/icons/btc-highlight.svg'
													: element.tags && element.tags['payment:onchain'] === 'no'
													? '/icons/btc-no.svg'
													: '/icons/btc.svg'
											} alt="bitcoin" class="w-7 h-7" title="${
						element.tags && element.tags['payment:onchain'] === 'yes'
							? 'On-chain accepted'
							: element.tags && element.tags['payment:onchain'] === 'no'
							? 'On-chain not accepted'
							: 'On-chain unknown'
					}"/>

	                   <img src=${
												element.tags && element.tags['payment:lightning'] === 'yes'
													? '/icons/ln-highlight.svg'
													: element.tags && element.tags['payment:lightning'] === 'no'
													? '/icons/ln-no.svg'
													: '/icons/ln.svg'
											} alt="lightning" class="w-7 h-7" title="${
						element.tags && element.tags['payment:lightning'] === 'yes'
							? 'Lightning accepted'
							: element.tags && element.tags['payment:lightning'] === 'no'
							? 'Lightning not accepted'
							: 'Lightning unknown'
					}"/>

	                   <img src=${
												element.tags && element.tags['payment:lightning_contactless'] === 'yes'
													? '/icons/nfc-highlight.svg'
													: element.tags && element.tags['payment:lightning_contactless'] === 'no'
													? '/icons/nfc-no.svg'
													: '/icons/nfc.svg'
											} alt="nfc" class="w-7 h-7" title="${
						element.tags && element.tags['payment:lightning_contactless'] === 'yes'
							? 'Lightning Contactless accepted'
							: element.tags && element.tags['payment:lightning_contactless'] === 'no'
							? 'Lightning contactless not accepted'
							: 'Lightning Contactless unknown'
					}"/>
	                 </div>

								<span class='text-body my-1' title="Surveys are completed by BTC Map community members">Survey date:
								${
									element.tags && element.tags['survey:date']
										? `${element.tags['survey:date']} ${
												Date.parse(element.tags['survey:date']) > verifiedDate
													? '<img src="/icons/verified.svg" alt="verified" class="inline w-5 h-5" title="Verified within the last year"/>'
													: ''
										  }`
										: '<span class="fa-solid fa-question" title="Not verified"></span>'
								}
								</span>`,
					{ closeButton: false }
				);

				markers.addLayer(marker);
				bounds.push({ latCalc, longCalc });
			});

			map.addLayer(markers);
			map.fitBounds(bounds.map(({ latCalc, longCalc }) => [latCalc, longCalc]));

			DomEvent.disableClickPropagation(document.querySelector('.leaflet-control-full-screen'));

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
									time={event.date}
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
