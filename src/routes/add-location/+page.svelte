<script lang="ts">
	import { browser } from '$app/environment';
	import {
		Footer,
		FormSuccess,
		Header,
		HeaderPlaceholder,
		InfoTooltip,
		MapLoadingEmbed,
		PrimaryButton
	} from '$lib/comp';
	import { attribution, changeDefaultIcons, geolocate, toggleMapButtons } from '$lib/map/setup';
	import { socials, theme } from '$lib/store';
	import { detectTheme, errToast } from '$lib/utils';
	import rewind from '@mapbox/geojson-rewind';
	import axios from 'axios';
	import { geoContains } from 'd3-geo';
	import type { Map, MaplibreGL, Marker } from 'leaflet';
	import { onDestroy, onMount, tick } from 'svelte';

	let captcha: HTMLDivElement;
	let captchaSecret: string;
	let captchaInput: HTMLInputElement;
	let honeyInput: HTMLInputElement;

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
				console.error(error);
			});
	};

	// Add this function to handle form reset
	function resetForm() {
		console.log('resetForm');

		submitted = false;
		submitting = false;
		methods = [];
		selected = false;
		noLocationSelected = false;
		noMethodSelected = false;

		// Optional: clear form fields
		name.value = '';
		address.value = '';
		category.value = '';
		website.value = '';
		phone.value = '';
		hours.value = '';
		notes.value = '';
		contact.value = '';
		captchaInput.value = '';

		// Refresh captcha
		fetchCaptcha();
	}

	let name: HTMLInputElement;
	let address: HTMLInputElement;
	let lat: number;
	let long: number;
	let selected = false;
	let category: HTMLInputElement;
	let methods: ('onchain' | 'lightning' | 'nfc')[] = [];
	let onchain: HTMLInputElement;
	let lightning: HTMLInputElement;
	let nfc: HTMLInputElement;
	let website: HTMLInputElement;
	let phone: HTMLInputElement;
	let hours: HTMLInputElement;
	let notes: HTMLTextAreaElement;
	let source: 'Business Owner' | 'Customer' | 'Other';
	let sourceOther: string;
	let sourceOtherElement: HTMLTextAreaElement;
	let contact: HTMLInputElement;
	let noLocationSelected = false;
	let noMethodSelected = false;
	let submitted = false;
	let submitting = false;
	let submissionIssueNumber: number;

	const handleCheckboxClick = () => {
		noMethodSelected = false;
	};

	$: latFixed = lat && lat.toFixed(5);
	$: longFixed = long && long.toFixed(5);

	const submitForm = () => {
		if (!selected) {
			noLocationSelected = true;
			errToast('Please select a location...');
		} else if (!onchain.checked && !lightning.checked && !nfc.checked) {
			noMethodSelected = true;
			errToast('Please select at least one payment method...');
		} else {
			submitting = true;
			if (onchain.checked) {
				methods.push('onchain');
			}
			if (lightning.checked) {
				methods.push('lightning');
			}
			if (nfc.checked) {
				methods.push('nfc');
			}

			axios
				.post('/add-location/endpoint', {
					captchaSecret,
					captchaTest: captchaInput.value,
					honey: honeyInput.value,
					name: name.value,
					address: address.value,
					lat: lat ? lat.toString() : '',
					long: long ? long.toString() : '',
					osm: lat && long ? `https://www.openstreetmap.org/edit#map=21/${lat}/${long}` : '',
					category: category.value,
					methods: methods.toString(),
					website: website.value,
					phone: phone.value,
					hours: hours.value,
					notes: notes.value,
					source,
					sourceOther: sourceOther ? sourceOther : '',
					contact: contact.value
				})
				.then(function (response) {
					submissionIssueNumber = response.data.number;
					submitted = true;
				})
				.catch(function (error) {
					methods = [];
					if (error.response.data.message.includes('Captcha')) {
						errToast(error.response.data.message);
					} else {
						errToast('Form submission failed, please try again or contact BTC Map.');
					}
					console.error(error);
					submitting = false;
				});
		}
	};

	// location picker map
	let mapElement: HTMLDivElement;
	let map: Map;
	let mapLoaded = false;

	let openFreeMapLiberty: MaplibreGL;
	let openFreeMapDark: MaplibreGL;

	onMount(async () => {
		if (browser) {
			const theme = detectTheme();

			// fetch and add captcha
			fetchCaptcha();

			//import packages
			const leaflet = await import('leaflet');
			const DomEvent = await import('leaflet/src/dom/DomEvent');
			/* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
			const leafletLocateControl = await import('leaflet.locatecontrol');
			const maplibreGl = await import('maplibre-gl');
			const maplibreGlLeaflet = await import('@maplibre/maplibre-gl-leaflet');
			/* eslint-enable no-unused-vars, @typescript-eslint/no-unused-vars */

			// add map and tiles
			map = leaflet.map(mapElement, { attributionControl: false, maxZoom: 19 }).setView([0, 0], 2);

			openFreeMapLiberty = window.L.maplibreGL({
				style: 'https://tiles.openfreemap.org/styles/liberty'
			});

			openFreeMapDark = window.L.maplibreGL({
				style: 'https://static.btcmap.org/map-styles/dark.json'
			});

			if (theme === 'dark') {
				openFreeMapDark.addTo(map);
			} else {
				openFreeMapLiberty.addTo(map);
			}

			// add marker on click
			let marker: Marker;

			map.on('click', (e) => {
				if (captchaSecret) {
					lat = e.latlng.lat;
					long = e.latlng.lng;

					if (marker) {
						map.removeLayer(marker);
					}

					marker = leaflet.marker([lat, long]).addTo(map);

					selected = true;
				}
			});

			// change broken marker image path in prod
			leaflet.Icon.Default.prototype.options.imagePath = '/icons/';

			// add locate button to map
			geolocate(leaflet, map);

			// change default icons
			changeDefaultIcons(false, leaflet, mapElement, DomEvent);

			// add OSM attribution
			attribution(leaflet, map);

			mapLoaded = true;
		}
	});

	onDestroy(async () => {
		if (map) {
			console.info('Unloading Leaflet map.');
			map.remove();
		}
	});

	$: $theme !== undefined && mapLoaded === true && toggleMapButtons();

	const toggleTheme = () => {
		if ($theme === 'dark') {
			openFreeMapLiberty.remove();
			openFreeMapDark.addTo(map);
		} else {
			openFreeMapDark.remove();
			openFreeMapLiberty.addTo(map);
		}
	};

	$: $theme !== undefined && mapLoaded === true && toggleTheme();
</script>

<svelte:head>
	<title>BTC Map - Add Location</title>
	<meta property="og:image" content="https://btcmap.org/images/og/add.png" />
	<meta property="twitter:title" content="BTC Map - Add Location" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/add.png" />
</svelte:head>

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
					Accept bitcoin? Get found.
				</h1>
			{:else}
				<HeaderPlaceholder />
			{/if}

			<p class="mt-10 text-center text-lg font-semibold text-primary dark:text-white md:text-xl">
				If you're a business owner, please read our <a
					href="https://gitea.btcmap.org/teambtcmap/btcmap-general/wiki/Merchant-Best-Practices"
					target="_blank"
					rel="noreferrer"
					class="text-link transition-colors hover:text-hover">Merchant Best Practices</a
				> guide.
			</p>

			<div class="mt-16 pb-20 md:pb-32">
				<section id="supertagger" class="mx-auto w-full border-b border-input pb-14">
					<div class="mx-auto max-w-xl text-primary dark:text-white">
						<h2 class="mb-5 text-center text-3xl font-semibold md:text-left">Start Here</h2>
						<p class="mb-10 w-full text-justify">
							We use OpenStreetMap to tag locations. Follow the steps below to quickly add a
							merchant to BTC Map.
						</p>

						<div class="flex justify-center">
							<ol class="space-y-10 text-center text-xl font-semibold md:space-y-8 md:text-left">
								<li class="items-center md:flex">
									<img
										src="/icons/pin-1.svg"
										alt="pin"
										class="mx-auto mb-4 md:mx-0 md:mb-0 md:mr-4"
									/>
									Create an
									<a
										href="https://www.openstreetmap.org/user/new"
										target="_blank"
										rel="noreferrer"
										class="mx-1 text-link transition-colors hover:text-hover">OpenStreetMap</a
									> account
								</li>
								<li class="items-center md:flex">
									<img
										src="/icons/pin-2.svg"
										alt="pin"
										class="mx-auto mb-4 md:mx-0 md:mb-0 md:mr-4"
									/>
									<a
										href="https://gitea.btcmap.org/teambtcmap/btcmap-general/wiki/Tagging-Merchants"
										target="_blank"
										rel="noreferrer"
										class="mr-1 text-link transition-colors hover:text-hover">Tag</a
									> the location
								</li>
								<li class="items-center md:flex">
									<img
										src="/icons/pin-3.svg"
										alt="pin"
										class="mx-auto mb-4 md:mx-0 md:mb-0 md:mr-4"
									/>
									Show up on the
									<a href="/map" class="ml-1 text-link transition-colors hover:text-hover">map</a>!
								</li>
							</ol>
						</div>

						<h3 class="mb-5 mt-16 text-center text-2xl font-semibold md:mt-10">
							See how it's done
						</h3>
						<!-- svelte-ignore a11y-media-has-caption -->
						<video
							controls
							playsinline
							preload="auto"
							src="/videos/osm-tagging-tutorial.webm"
							class="w-full border-2 border-input"
						/>

						<h3 class="mb-5 mt-16 text-center text-2xl font-semibold md:mt-10">
							Still have questions?
						</h3>
						<p class="text-justify">
							Ask for help in our <a
								href={$socials.discord}
								target="_blank"
								rel="noreferrer"
								class="text-link transition-colors hover:text-hover">Discord</a
							> server and a community member will be happy to assist. Alternatively, you can fill out
							the form below. This method is not recommended if you would like to be added to the map
							right away.
						</p>
					</div>
				</section>

				<section id="noob" class="mx-auto w-full pt-14">
					<div class="mx-auto max-w-xl">
						<h2
							class="mb-5 text-center text-3xl font-semibold text-primary dark:text-white md:text-left"
						>
							Form Option
						</h2>

						<p class="mb-10 w-full text-justify text-primary dark:text-white">
							Fill out the following form and one of our volunteer community members will add your
							location to the map. <InfoTooltip
								tooltip="All additions being completed on a volunteer basi and so we can't garuantee when your location will be added."
							/>
						</p>

						<form
							on:submit|preventDefault={submitForm}
							class="w-full space-y-5 text-primary dark:text-white"
						>
							<div>
								<label for="name" class="mb-2 block font-semibold">Merchant Name</label>
								<input
									disabled={!captchaSecret || !mapLoaded}
									type="text"
									name="name"
									id="name"
									placeholder="Satoshi's Comics"
									required
									class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
									bind:this={name}
								/>
							</div>

							<div>
								<label for="location-picker" class="mb-2 block font-semibold">Select Location</label
								>
								{#if selected}
									<span class="font-semibold text-green-500">Location selected!</span>
								{:else if noLocationSelected}
									<span class="font-semibold text-error">Please select a location...</span>
								{/if}
								<div class="relative mb-2">
									<div
										bind:this={mapElement}
										class="z-10 h-[300px] !cursor-crosshair rounded-2xl border-2 border-input !bg-teal dark:!bg-dark md:h-[400px]"
									/>
									{#if !mapLoaded}
										<MapLoadingEmbed
											style="h-[300px] md:h-[400px] border-2 border-input rounded-2xl"
										/>
									{/if}
								</div>
								<div class="flex space-x-2">
									<input
										required
										disabled
										bind:value={latFixed}
										readonly
										type="number"
										name="lat"
										placeholder="Latitude"
										class="w-full rounded-2xl border-2 border-input p-3 focus:outline-link"
									/>
									<input
										required
										disabled
										bind:value={longFixed}
										readonly
										type="number"
										name="long"
										placeholder="Longitude"
										class="w-full rounded-2xl border-2 border-input p-3 focus:outline-link"
									/>
								</div>
							</div>

							<div>
								<label for="address" class="mb-2 block font-semibold"
									>Address (Optional) <InfoTooltip
										tooltip="All locations are required to have a physical
										presence. Optionally enter an address here if that makes sense where the merchant is located. Services without locations are not map-able."
									/></label
								>
								<input
									disabled={!captchaSecret || !mapLoaded}
									type="text"
									name="address"
									id="address"
									placeholder="2100 Freedom Drive..."
									class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
									bind:this={address}
								/>
							</div>

							<div>
								<label for="category" class="mb-2 block font-semibold">Category</label>
								<input
									disabled={!captchaSecret || !mapLoaded}
									type="text"
									name="category"
									id="category"
									placeholder="Restaurant etc."
									class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
									bind:this={category}
								/>
							</div>

							<fieldset>
								<legend class="mb-2 block font-semibold">Select accepted payment methods</legend>
								{#if noMethodSelected}
									<span class="font-semibold text-error">Please fix this...</span>
								{/if}
								<div class="space-y-4">
									<div>
										<input
											class="h-4 w-4 accent-link"
											disabled={!captchaSecret || !mapLoaded}
											type="checkbox"
											name="onchain"
											id="onchain"
											bind:this={onchain}
											on:click={handleCheckboxClick}
										/>
										<label for="onchain" class="ml-1 cursor-pointer">
											{#if typeof window !== 'undefined'}
												<img
													src={detectTheme() === 'dark' || $theme === 'dark'
														? '/icons/btc-highlight-dark.svg'
														: '/icons/btc-primary.svg'}
													alt="onchain"
													class="inline"
												/>
											{/if}
											On-chain
										</label>
									</div>
									<div>
										<input
											class="h-4 w-4 accent-link"
											disabled={!captchaSecret || !mapLoaded}
											type="checkbox"
											name="lightning"
											id="lightning"
											bind:this={lightning}
											on:click={handleCheckboxClick}
										/>
										<label for="lightning" class="ml-1 cursor-pointer">
											{#if typeof window !== 'undefined'}
												<img
													src={detectTheme() === 'dark' || $theme === 'dark'
														? '/icons/ln-highlight-dark.svg'
														: '/icons/ln-primary.svg'}
													alt="lightning"
													class="inline"
												/>
											{/if}
											Lightning
										</label>
									</div>
									<div>
										<input
											class="h-4 w-4 accent-link"
											disabled={!captchaSecret || !mapLoaded}
											type="checkbox"
											name="nfc"
											id="nfc"
											bind:this={nfc}
											on:click={handleCheckboxClick}
										/>
										<label for="nfc" class="ml-1 cursor-pointer">
											{#if typeof window !== 'undefined'}
												<img
													src={detectTheme() === 'dark' || $theme === 'dark'
														? '/icons/nfc-highlight-dark.svg'
														: '/icons/nfc-primary.svg'}
													alt="nfc"
													class="inline"
												/>
											{/if}
											Lightning Contactless
										</label>
									</div>
								</div>
							</fieldset>

							<div>
								<label for="website" class="mb-2 block font-semibold"
									>Website <span class="font-normal">(optional)</span></label
								>
								<input
									disabled={!captchaSecret || !mapLoaded}
									type="url"
									name="website"
									placeholder="https://bitcoin.org"
									class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
									bind:this={website}
								/>
							</div>

							<div>
								<label for="phone" class="mb-2 block font-semibold"
									>Phone <span class="font-normal">(optional)</span></label
								>
								<input
									disabled={!captchaSecret || !mapLoaded}
									type="tel"
									name="phone"
									placeholder="Number"
									class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
									bind:this={phone}
								/>
							</div>

							<div>
								<label for="hours" class="mb-2 block font-semibold"
									>Opening Hours <span class="font-normal">(optional)</span></label
								>
								<input
									disabled={!captchaSecret || !mapLoaded}
									type="text"
									name="hours"
									placeholder="Mo-Fr 08:30-20:00"
									class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
									bind:this={hours}
								/>
							</div>

							<div>
								<label for="notes" class="mb-2 block font-semibold"
									>Notes <span class="font-normal">(optional)</span></label
								>
								<textarea
									disabled={!captchaSecret || !mapLoaded}
									name="notes"
									placeholder="Please add further details here like additional merchant details, contacts, socials, etc."
									rows="3"
									class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
									bind:this={notes}
								/>
							</div>

							<div>
								<label for="source" class="mb-2 block font-semibold">Data Source</label>
								<select
									disabled={!captchaSecret || !mapLoaded}
									name="source"
									required
									class="w-full rounded-2xl border-2 border-input bg-white px-2 py-3 transition-all focus:outline-link dark:bg-white/[0.15]"
									bind:value={source}
									on:change={async () => {
										if (source === 'Other') {
											await tick();
											sourceOtherElement.focus();
										}
									}}
								>
									<option value="">Please select an option</option>
									<option value="Business Owner">I am the business owner</option>
									<option value="Customer">I visited as a customer</option>
									<option value="Other">Other method</option>
								</select>
								{#if source === 'Other'}
									<p class="my-2 text-justify text-sm">
										How did you verify this information? Please provide as much detail as possible.
									</p>
									<textarea
										disabled={!captchaSecret || !mapLoaded}
										required
										name="source-other"
										placeholder="Local knowledge, online etc."
										class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
										bind:value={sourceOther}
										bind:this={sourceOtherElement}
									/>
								{/if}
							</div>

							<div>
								<label for="contact" class="mb-2 block font-semibold">Public Contact</label>
								<p class="mb-2 text-justify text-sm">
									If we have any follow-up questions we will contact you in order to add this
									location successfully. To speed up the process please check your spam folder in
									case it ends up there.
								</p>
								<input
									disabled={!captchaSecret || !mapLoaded}
									required
									type="email"
									name="contact"
									placeholder="hello@btcmap.org"
									class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
									bind:this={contact}
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
										disabled={!captchaSecret || !mapLoaded}
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
								disabled={submitting || !captchaSecret || !mapLoaded}
								text="Submit Location"
								style="w-full py-3 rounded-xl"
							/>
						</form>
					</div>
				</section>
			</div>
		{:else}
			<FormSuccess
				type="Location"
				text="We'll review your information and add it ASAP."
				issue={submissionIssueNumber}
				click={resetForm}
			/>
		{/if}

		<Footer />
	</div>
</div>

{#if typeof window !== 'undefined'}
	{#if detectTheme() === 'dark' || $theme === 'dark'}
		<style>
			select option {
				--tw-bg-opacity: 1;
				background-color: rgb(55 65 81 / var(--tw-bg-opacity));
			}
		</style>
	{/if}
{/if}
