<script>
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import axios from 'axios';
	import { Header, Footer, PrimaryButton, MapLoading, FormSuccess } from '$comp';
	import { elements, elementError } from '$lib/store';
	import {
		attribution,
		fullscreenButton,
		geolocate,
		changeDefaultIcons,
		calcVerifiedDate,
		latCalc,
		longCalc,
		generateIcon,
		generateMarker
	} from '$lib/map/setup';
	import { errToast } from '$lib/utils';

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

	let captcha;
	let captchaSecret;
	let captchaInput;
	let honeyInput;

	const fetchCaptcha = () => {
		axios
			.get('/captcha')
			.then(function (response) {
				// handle success
				captchaSecret = response.data.captchaSecret;
				captcha.innerHTML = response.data.captcha;
			})
			.catch(function (error) {
				// handle error
				errToast('Could not fetch captcha, please try again or contact BTC Map.');
				console.log(error);
			});
	};

	let current;
	let outdated;
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
			errToast('Please select a location...');
		} else {
			submitting = true;

			axios
				.post('/verify-location/endpoint', {
					captchaSecret,
					captchaTest: captchaInput.value,
					honey: honeyInput.value,
					name: name,
					location: location,
					edit: edit,
					current: current ? 'Yes' : 'No',
					outdated: outdated ? outdated : '',
					verified: verify.value,
					lat: lat ? lat.toString() : '',
					long: long ? long.toString() : ''
				})
				.then(function (response) {
					submissionIssueNumber = response.data.number;
					submitted = true;
				})
				.catch(function (error) {
					if (error.response.data.message.includes('Captcha')) {
						errToast(error.response.data.message);
					} else {
						errToast('Form submission failed, please try again or contact BTC Map.');
					}

					console.log(error);
					submitting = false;
				});
		}
	};

	// location picker map if not accessing page from webapp
	let mapElement;
	let map;
	let showMap = !name || !lat || !long || !edit ? true : false;
	let mapLoaded;

	// alert for map errors
	$: $elementError && showMap && errToast($elementError);

	onMount(async () => {
		if (browser) {
			// fetch and add captcha
			fetchCaptcha();

			if (showMap) {
				//import packages
				const leaflet = await import('leaflet');
				const DomEvent = await import('leaflet/src/dom/DomEvent');
				const leafletLocateControl = await import('leaflet.locatecontrol');
				const leafletMarkerCluster = await import('leaflet.markercluster');

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

				// add OSM attribution
				attribution(L, map);

				// add fullscreen button to map
				fullscreenButton(L, mapElement, map, DomEvent);

				// add locate button to map
				geolocate(L, map);

				// change default icons
				changeDefaultIcons();

				// create marker cluster group
				let markers = L.markerClusterGroup();

				// get date from 1 year ago to add verified check if survey is current
				let verifiedDate = calcVerifiedDate();

				// add location information
				$elements.forEach((element) => {
					if (element['deleted_at']) {
						return;
					}

					let icon = element.tags['icon:android'];

					element = element['osm_json'];

					const latC = latCalc(element);
					const longC = longCalc(element);

					let divIcon = generateIcon(L, icon);

					let marker = generateMarker(latC, longC, divIcon, element, L, verifiedDate);

					// add marker click event
					marker.on('click', (e) => {
						if (captchaSecret) {
							map.setView(e.latlng, 19);
							name = element.tags && element.tags.name ? element.tags.name : '';
							lat = latC;
							long = longC;
							location = lat && long ? `https://btcmap.org/map?lat=${lat}&long=${long}` : '';
							edit = `https://www.openstreetmap.org/edit?${element.type}=${element.id}`;
							selected = true;
						}
					});

					markers.addLayer(marker);
				});

				map.addLayer(markers);

				mapLoaded = true;
			}
		}
	});

	if (showMap) {
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

			<section id="verify" class="mx-auto w-full md:w-[600px] mt-16 pb-20 md:pb-32">
				<h2 class="text-primary text-3xl font-semibold mb-5 text-center">
					Verify Location<br />
					<span class="text-base font-normal"
						>(Ensure the information is still accurate and update it otherwise.)</span
					>
				</h2>

				<p class="text-primary w-full mb-10 text-center">
					Please fill out the following form and one of our volunteer community members will update
					your location on the map. Did you know you can update this data yourself on <a
						href="https://www.openstreetmap.org"
						target="_blank"
						rel="noreferrer"
						class="text-link hover:text-hover transition-colors">OpenStreetMap</a
					>? You can check out our
					<a
						href="https://github.com/teambtcmap/btcmap-data/wiki/Tagging-Instructions"
						target="_blank"
						rel="noreferrer"
						class="text-link hover:text-hover transition-colors">Wiki</a
					> for more instructions.
				</p>

				<form on:submit={submitForm} class="text-primary space-y-5 w-full">
					<div>
						<div class={showMap ? 'block' : 'hidden'}>
							<label for="location-picker" class="mb-2 block font-semibold">Select Location</label>
							{#if selected}
								<span class="text-green-500 font-semibold">Location selected!</span>
							{:else if noLocationSelected}
								<span class="text-error font-semibold">Please select a location...</span>
							{/if}
							<div class="relative mb-2">
								<div
									bind:this={mapElement}
									class="!bg-teal z-10 !cursor-crosshair border-2 border-input rounded-2xl h-[300px] md:h-[450px]"
								/>
								{#if !mapLoaded}
									<MapLoading
										type="embed"
										style="h-[300px] md:h-[450px] border-2 border-input rounded-2xl"
									/>
								{/if}
							</div>
						</div>

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
						<div class="flex items-center space-x-2">
							<label for="current" class="{!outdated ? 'cursor-pointer' : ''} font-semibold"
								>Current information is correct</label
							>
							<input
								class="accent-link w-4 h-4"
								disabled={!captchaSecret || (showMap && !mapLoaded) || outdated}
								required={!outdated}
								type="checkbox"
								id="current"
								name="current"
								bind:checked={current}
							/>
						</div>
						<p class="text-sm">
							Check this box if you have verified the existing data is up-to-date.
						</p>
					</div>

					<div>
						<label for="outdated" class="mb-2 block font-semibold"
							>Outdated information <span class="font-normal">(If applicable)</span></label
						>
						<textarea
							disabled={!captchaSecret || (showMap && !mapLoaded) || current}
							required={!current}
							name="outdated"
							placeholder="Provide what info is incorrect and the updated info on this location"
							rows="3"
							class="focus:outline-link border-2 border-input rounded-2xl p-3 w-full transition-all"
							bind:value={outdated}
						/>
					</div>

					<div>
						<label for="verify" class="mb-2 block font-semibold">How did you verify this?</label>
						<textarea
							disabled={!captchaSecret || (showMap && !mapLoaded)}
							required
							name="verify"
							placeholder="Please provide additional info here"
							rows="3"
							class="focus:outline-link border-2 border-input rounded-2xl p-3 w-full transition-all"
							bind:this={verify}
						/>
					</div>

					<div>
						<div class="flex items-center mb-2 space-x-2">
							<label for="captcha" class="font-semibold"
								>Bot protection <span class="font-normal">(case-sensitive)</span></label
							>
							{#if captchaSecret}
								<button type="button" on:click={fetchCaptcha}>
									<i class="fa-solid fa-arrows-rotate" />
								</button>
							{/if}
						</div>
						<div class="space-y-2">
							<div
								bind:this={captcha}
								class="border-2 border-input rounded-2xl flex justify-center items-center py-1"
							>
								<div class="w-[275px] h-[100px] bg-link/50 animate-pulse" />
							</div>
							<input
								disabled={!captchaSecret || (showMap && !mapLoaded)}
								required
								type="text"
								name="captcha"
								placeholder="Please enter the captcha text."
								class="focus:outline-link border-2 border-input rounded-2xl p-3 w-full transition-all"
								bind:this={captchaInput}
							/>
						</div>
					</div>

					<input
						type="text"
						name="honey"
						placeholder="A nice pot of honey."
						class="hidden"
						bind:this={honeyInput}
					/>

					<PrimaryButton
						loading={submitting}
						disabled={submitting || !captchaSecret || (showMap && !mapLoaded)}
						text="Submit Report"
						style="w-full py-3 rounded-xl"
					/>
				</form>
			</section>
		{:else}
			<FormSuccess
				type="Report"
				text="Thanks for taking the time to fill out this report. We’ll review your information and
update it ASAP."
				issue={submissionIssueNumber}
				link="/verify-location"
			/>
		{/if}

		<Footer />
	</div>
</div>

<style>
	@import 'leaflet/dist/leaflet.css';
	@import 'leaflet.locatecontrol/dist/L.Control.Locate.min.css';
	@import 'leaflet.markercluster/dist/MarkerCluster.css';
	@import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
</style>
