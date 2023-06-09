<script>
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import axios from 'axios';
	import {
		Header,
		Footer,
		PrimaryButton,
		MapLoading,
		FormSuccess,
		InfoTooltip,
		HeaderPlaceholder
	} from '$comp';
	import { elements, elementError, theme } from '$lib/store';
	import {
		attribution,
		geolocate,
		changeDefaultIcons,
		calcVerifiedDate,
		latCalc,
		longCalc,
		generateIcon,
		generateMarker,
		toggleMapButtons
	} from '$lib/map/setup';
	import { errToast, detectTheme } from '$lib/utils';

	const id = $page.url.searchParams.has('id') ? $page.url.searchParams.get('id') : '';
	const merchant = $elements.find((element) => element.id && element.id === id);

	let name = merchant ? merchant.osm_json.tags?.name : '';
	let lat = merchant ? latCalc(merchant.osm_json) : '';
	let long = merchant ? longCalc(merchant.osm_json) : '';
	let location = lat && long ? `https://btcmap.org/map?lat=${lat}&long=${long}` : '';
	let edit = merchant
		? `https://www.openstreetmap.org/edit?${merchant.osm_json.type}=${merchant.osm_json.id}`
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
	let showMap = !lat || !long || !edit ? true : false;
	let mapLoaded;

	let osm;
	let alidadeSmoothDark;

	// alert for map errors
	$: $elementError && showMap && errToast($elementError);

	onMount(async () => {
		if (browser) {
			const theme = detectTheme();

			// fetch and add captcha
			fetchCaptcha();

			if (showMap) {
				//import packages
				const leaflet = await import('leaflet');
				const DomEvent = await import('leaflet/src/dom/DomEvent');
				/* eslint-disable no-unused-vars */
				const leafletLocateControl = await import('leaflet.locatecontrol');
				const leafletMarkerCluster = await import('leaflet.markercluster');
				/* eslint-enable no-unused-vars */

				// add map and tiles
				map = leaflet.map(mapElement, { attributionControl: false }).setView([0, 0], 2);

				osm = leaflet.tileLayer(
					'https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png',
					{
						noWrap: true,
						maxZoom: 20
					}
				);

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

				// set URL lat/long query view if it exists and is valid
				if (lat.length && long.length) {
					try {
						map.fitBounds([[lat, long]]);
					} catch (error) {
						console.log(error);
					}
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

				// add location information
				$elements.forEach((element) => {
					if (element['deleted_at']) {
						return;
					}

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

					const latC = latCalc(element);
					const longC = longCalc(element);

					// eslint-disable-next-line no-undef
					let divIcon = generateIcon(L, icon, boosted);

					let marker = generateMarker(
						latC,
						longC,
						divIcon,
						element,
						payment,
						// eslint-disable-next-line no-undef
						L,
						verifiedDate,
						'',
						boosted
					);

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

	$: $theme !== undefined && mapLoaded === true && showMap && toggleMapButtons();

	const closePopup = () => {
		map.closePopup();
	};

	$: $theme !== undefined && mapLoaded === true && showMap && closePopup();

	const toggleTheme = () => {
		if ($theme === 'dark') {
			osm.remove();
			alidadeSmoothDark.addTo(map);
		} else {
			alidadeSmoothDark.remove();
			osm.addTo(map);
		}
	};

	$: $theme !== undefined && mapLoaded === true && showMap && toggleTheme();

	if (showMap) {
		onDestroy(async () => {
			if (map) {
				console.log('Unloading Leaflet map.');
				map.remove();
			}
		});
	}
</script>

<div class="bg-teal dark:bg-dark">
	<Header />
	<div class="mx-auto w-10/12 xl:w-[1200px]">
		{#if !submitted}
			{#if typeof window !== 'undefined'}
				<h1
					class="{detectTheme() === 'dark' || $theme === 'dark'
						? 'text-white'
						: 'gradient'} mt-10 text-center text-4xl font-semibold md:text-5xl"
				>
					Help improve the data for everyone.
				</h1>
			{:else}
				<HeaderPlaceholder />
			{/if}

			<section id="verify" class="mx-auto mt-16 w-full pb-20 md:w-[600px] md:pb-32">
				<h2 class="mb-5 text-center text-3xl font-semibold text-primary dark:text-white">
					Verify Location<br />
					<span class="text-base font-normal"
						>(Ensure the information is still accurate and update it otherwise.)</span
					>
				</h2>

				<p class="mb-10 w-full text-center text-primary dark:text-white">
					Please fill out the following form and one of our volunteer community members will update
					your location on the map. Did you know you can update this data yourself on <a
						href="https://www.openstreetmap.org"
						target="_blank"
						rel="noreferrer"
						class="text-link transition-colors hover:text-hover">OpenStreetMap</a
					>? You can check out our
					<a
						href="https://wiki.btcmap.org/general/tagging-instructions.html"
						target="_blank"
						rel="noreferrer"
						class="text-link transition-colors hover:text-hover">Wiki</a
					>
					for more instructions. <InfoTooltip
						tooltip="NOTE: Due to the backlog of requests and the updates being completed on a volunteer effort, it may take several weeks to update this location. It is encouraged to update the location on OpenStreetMap directly if you want to see the changes appear on the map right away."
					/>
				</p>

				<form on:submit={submitForm} class="w-full space-y-5 text-primary dark:text-white">
					<div>
						<div class={showMap ? 'block' : 'hidden'}>
							<label for="location-picker" class="mb-2 block font-semibold">Select Location</label>
							{#if selected}
								<span class="font-semibold text-green-500">Location selected!</span>
							{:else if noLocationSelected}
								<span class="font-semibold text-error">Please select a location...</span>
							{/if}
							<div class="relative mb-2">
								<div
									bind:this={mapElement}
									class="z-10 h-[300px] !cursor-crosshair rounded-2xl border-2 border-input !bg-teal dark:!bg-dark dark:text-map md:h-[450px]"
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
							disabled
							bind:value={name}
							readonly
							type="text"
							name="name"
							placeholder="Merchant Name"
							class="w-full rounded-2xl border-2 border-input p-3 text-center font-semibold focus:outline-link"
						/>
					</div>

					<div>
						<div class="flex items-center space-x-2">
							<label for="current" class="{!outdated ? 'cursor-pointer' : ''} font-semibold"
								>Current information is correct</label
							>
							<input
								class="h-4 w-4 accent-link"
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
							class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
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
							class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
							bind:this={verify}
						/>
					</div>

					<div>
						<div class="mb-2 flex items-center space-x-2">
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
								class="flex items-center justify-center rounded-2xl border-2 border-input py-1"
							>
								<div class="h-[100px] w-[275px] animate-pulse bg-link/50" />
							</div>
							<input
								disabled={!captchaSecret || (showMap && !mapLoaded)}
								required
								type="text"
								name="captcha"
								placeholder="Please enter the captcha text."
								class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
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
