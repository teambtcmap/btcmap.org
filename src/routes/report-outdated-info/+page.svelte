<script>
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import axios from 'axios';
	import { LottiePlayer } from '@lottiefiles/svelte-lottie-player';
	import { Header, Footer, PrimaryButton } from '$comp';
	import { socials } from '$lib/store';

	let name = $page.url.searchParams.has('name') ? $page.url.searchParams.get('name') : '';
	let lat = $page.url.searchParams.has('lat') ? $page.url.searchParams.get('lat') : '';
	let long = $page.url.searchParams.has('long') ? $page.url.searchParams.get('long') : '';
	let location = lat && long ? `https://btcmap.org/map?lat=${lat}&long=${long}` : '';
	let edit = $page.url.searchParams.has('node')
		? `https://www.openstreetmap.org/edit?node=${$page.url.searchParams.get('node')}`
		: $page.url.searchParams.has('way')
		? `https://www.openstreetmap.org/edit?way=${$page.url.searchParams.get('way')}`
		: $page.url.searchParams.has('relation')
		? `https://www.openstreetmap.org/edit?relation=${$page.url.searchParams.get('relation')}`
		: '';

	let outdated;
	let current;
	let verify;

	let selected = location ? true : false;
	let noLocationSelected = false;
	let submitted = false;
	let submitting = false;
	let submissionIssueNumber;

	const submitForm = (e) => {
		e.preventDefault();
		if (!selected) {
			noLocationSelected = true;
		} else {
			submitting = true;

			axios
				.post('/report-outdated-info/endpoint', {
					name: name,
					location: location,
					edit: edit,
					outdated: outdated.value,
					current: current.value,
					verify: verify.value,
					lat: lat ? lat.toString() : '',
					long: long ? long.toString() : ''
				})
				.then(function (response) {
					submissionIssueNumber = response.data.number;
					submitted = true;
				})
				.catch(function (error) {
					alert('Form submission failed, please try again or contact the BTC Map team.');
					console.log(error);
					submitting = false;
				});
		}
	};

	// location picker map if not accessing page from webapp
	let mapElement;
	let map;

	if (!name || !lat || !long || !edit) {
		onMount(async () => {
			if (browser) {
				//import packages
				const leaflet = await import('leaflet');
				const leafletLocateControl = await import('leaflet.locatecontrol');
				const leafletMarkerCluster = await import('leaflet.markercluster');
				const axios = await import('axios');

				// add map and tiles
				map = leaflet.map(mapElement, { attributionControl: false }).setView([0, 0], 2);

				const osm = leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
					noWrap: true,
					maxZoom: 19
				});

				osm.addTo(map);

				// set URL lat/long query view if it exists and is valid
				if (lat.length && long.length) {
					try {
						map.fitBounds([[lat, long]]);
					} catch (error) {
						console.log(error);
					}
				}

				// change broken marker image path in prod
				L.Icon.Default.prototype.options.imagePath = '/icons/';

				// adds locate button to map
				L.control.locate().addTo(map);

				const newLocateIcon = L.DomUtil.create('img');
				newLocateIcon.src = '/icons/locate.svg';
				newLocateIcon.alt = 'locate';
				newLocateIcon.classList.add('inline');
				newLocateIcon.id = 'locatebutton';
				document.querySelector('.leaflet-control-locate-location-arrow').replaceWith(newLocateIcon);

				const locateDiv = document.querySelector('.leaflet-control-locate');
				locateDiv.style.border = 'none';
				locateDiv.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';

				const locateButton = document.querySelector('.leaflet-bar-part.leaflet-bar-part-single');
				locateButton.style.borderRadius = '8px';
				locateButton.onmouseenter = () => {
					document.querySelector('#locatebutton').src = '/icons/locate-black.svg';
				};
				locateButton.onmouseleave = () => {
					document.querySelector('#locatebutton').src = '/icons/locate.svg';
				};

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

				// fetch bitcoin locations from our api
				axios
					.get('https://data.btcmap.org/elements.json')
					.then(function (response) {
						// handle success
						let markers = L.markerClusterGroup();

						// check address data
						const checkAddress = (element) => {
							if (element['addr:housenumber'] && element['addr:street'] && element['addr:city']) {
								return `${
									element['addr:housenumber'] +
									' ' +
									element['addr:street'] +
									', ' +
									element['addr:city']
								}`;
							} else if (element['addr:street'] && element['addr:city']) {
								return `${element['addr:street'] + ', ' + element['addr:city']}`;
							} else if (element['addr:city']) {
								return `${element['addr:city']}`;
							} else {
								return '';
							}
						};

						// add location information
						response.data.elements.forEach((element) => {
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
									element.tags.name
										? `<span class='block font-bold text-lg text-primary' title='Merchant name'>${element.tags.name}</span>`
										: ''
								}

                <span class='block text-body font-bold' title='Address'>${checkAddress(
									element.tags
								)}</span>

                <div class='w-[192px] flex space-x-2 my-1'>
                  ${
										element.tags.phone
											? `<a href='tel:${element.tags.phone}' title='Phone'><span class="bg-link hover:bg-hover rounded-full p-2 w-5 h-5 text-white fa-solid fa-phone" /></a>`
											: ''
									}

                  ${
										element.tags.website
											? `<a href=${element.tags.website} target="_blank" rel="noreferrer" title='Website'><span class="bg-link hover:bg-hover rounded-full p-2 w-5 h-5 text-white fa-solid fa-globe" /></a>`
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
										element.tags['payment:onchain'] === 'yes'
											? '/icons/btc-highlight.svg'
											: '/icons/btc.svg'
									} alt="bitcoin" class="w-6 h-6" title="${
									element.tags['payment:onchain'] === 'yes'
										? 'On-chain accepted'
										: 'On-chain unknown'
								}"/>

                  <img src=${
										element.tags['payment:lightning'] === 'yes'
											? '/icons/ln-highlight.svg'
											: '/icons/ln.svg'
									} alt="lightning" class="w-6 h-6" title="${
									element.tags['payment:lightning'] === 'yes'
										? 'Lightning accepted'
										: 'Lightning unknown'
								}"/>

                  <img src=${
										element.tags['payment:lightning_contactless'] === 'yes'
											? '/icons/nfc-highlight.svg'
											: '/icons/nfc.svg'
									} alt="nfc" class="w-6 h-6" title="${
									element.tags['payment:lightning_contactless'] === 'yes'
										? 'Lightning Contactless accepted'
										: 'Lightning Contactless unknown'
								}"/>
                </div>

								<span class='text-body my-1' title="Surveys are completed by BTC Map community members">Survey date:
								${
									element.tags['survey:date']
										? `${element.tags['survey:date']}`
										: '<span class="fa-solid fa-question"></span>'
								}
								</span>`
							);

							// add marker click event
							marker.on('click', (e) => {
								map.setView(e.latlng, 19);
								name = element.tags.name ? element.tags.name : '';
								lat = latCalc;
								long = longCalc;
								location = lat && long ? `https://btcmap.org/map?lat=${lat}&long=${long}` : '';
								edit = `https://www.openstreetmap.org/edit?${element.type}=${element.id}`;
								selected = true;
							});

							markers.addLayer(marker);
						});

						map.addLayer(markers);
					})
					.catch(function (error) {
						// handle error
						alert('Could not load map markers, please try again or contact BTC Map.');
						throw new Error(error.message);
					});
			}
		});

		onDestroy(async () => {
			if (map) {
				console.log('Unloading Leaflet map.');
				map.remove();
			}
		});
	}
</script>

<div class="bg-teal">
	<Header />
	<div class="w-10/12 xl:w-[1200px] mx-auto">
		{#if !submitted}
			<h1 class="text-4xl md:text-5xl gradient font-semibold mt-10 text-center">
				Help improve the data for everyone.
			</h1>

			<section id="report" class="mx-auto w-full md:w-[600px] mt-16 pb-20 md:pb-32">
				<h2 class="text-primary text-3xl font-semibold mb-5 text-center">
					Report outdated information<br />
					<span class="text-base font-normal"
						>(Merchant no longer accepts bitcoin or other data is incorrect.)</span
					>
				</h2>

				<p class="text-primary w-full mb-10 text-center">
					Please fill out the following form and one of our volunteer community members will update
					your location on the map. Did you know you can update this data yourself on <a
						href="https://www.openstreetmap.org"
						target="_blank"
						rel="noreferrer"
						class="text-link hover:text-hover">OpenStreetMap</a
					>? You can check out our
					<a
						href="https://github.com/teambtcmap/btcmap-data/wiki/Tagging-Instructions"
						target="_blank"
						rel="noreferrer"
						class="text-link hover:text-hover">Wiki</a
					> for more instructions.
				</p>

				<form on:submit={submitForm} class="text-primary space-y-5 w-full">
					<div>
						{#if !$page.url.searchParams.has('name') || !$page.url.searchParams.has('lat') || !$page.url.searchParams.has('long') || (!$page.url.searchParams.has('node') && !$page.url.searchParams.has('way') && !$page.url.searchParams.has('relation'))}
							<label for="location-picker" class="mb-2 block font-semibold">Select Location</label>
							{#if selected}
								<span class="text-green-500 font-semibold">Location selected!</span>
							{:else if noLocationSelected}
								<span class="text-error font-semibold">Please select a location...</span>
							{/if}
							<div
								bind:this={mapElement}
								class="z-10 !cursor-crosshair focus:outline-link border-2 border-input mb-2 rounded-2xl h-[450px]"
							/>
						{/if}
						<input
							required
							disabled
							bind:value={name}
							readonly
							type="text"
							name="name"
							placeholder="Merchant Name"
							class="focus:outline-link border-2 border-input rounded-2xl p-3 w-full font-semibold text-center"
						/>
					</div>
					<div>
						<label for="outdated" class="mb-2 block font-semibold">Outdated information</label>
						<textarea
							required
							name="outdated"
							placeholder="Provide what info is incorrect"
							rows="5"
							class="focus:outline-link border-2 border-input rounded-2xl p-3 w-full"
							bind:this={outdated}
						/>
					</div>
					<div>
						<label for="current" class="mb-2 block font-semibold">Current information</label>
						<textarea
							required
							name="current"
							placeholder="Provide the updated info on this location"
							rows="5"
							class="focus:outline-link border-2 border-input rounded-2xl p-3 w-full"
							bind:this={current}
						/>
					</div>
					<div>
						<label for="verify" class="mb-2 block font-semibold">How did you verify this?</label>
						<textarea
							required
							name="verify"
							placeholder="Please provide additional info here"
							rows="5"
							class="focus:outline-link border-2 border-input rounded-2xl p-3 w-full"
							bind:this={verify}
						/>
					</div>

					<PrimaryButton
						loading={submitting}
						disabled={submitting}
						text="Submit Report"
						style="w-full py-3 rounded-xl"
					/>
				</form>
			</section>
		{:else}
			<div class="flex justify-center items-center text-center pb-20 md:pb-32 mt-10">
				<div>
					<h2 class="gradient text-4xl font-semibold mb-5">Report Submitted!</h2>
					<p class="text-primary w-full md:w-[500px] mb-5">
						Thanks for taking the time to fill out this report. We’ll review your information and
						update it ASAP. If you wish to know the status of your contribution, join our <a
							href={$socials.discord}
							target="_blank"
							rel="noreferrer"
							class="text-link hover:text-hover">Discord channel</a
						>. You can also monitor the progress on
						<a
							href="https://github.com/teambtcmap/btcmap-data/issues/{submissionIssueNumber}"
							target="_blank"
							rel="noreferrer"
							class="text-link hover:text-hover">GitHub</a
						>.
					</p>
					{#if typeof window !== 'undefined'}
						<div class="w-full md:w-96 mx-auto">
							<LottiePlayer
								src="/lottie/lightning-bolt.json"
								autoplay={true}
								loop={true}
								controls={false}
								renderer="svg"
								background="transparent"
							/>
						</div>
					{/if}
					<PrimaryButton
						text="Submit another report"
						link="/report-outdated-info"
						style="w-52 py-3 mx-auto mt-10 rounded-xl"
					/>
				</div>
			</div>
		{/if}

		<Footer style="justify-center" />
	</div>
</div>

<style>
	@import 'leaflet/dist/leaflet.css';
	@import 'leaflet.locatecontrol/dist/L.Control.Locate.min.css';
	@import 'leaflet.markercluster/dist/MarkerCluster.css';
	@import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
</style>
