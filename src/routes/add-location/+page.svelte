<script>
	import rewind from '@mapbox/geojson-rewind';
	import { geoContains } from 'd3-geo';
	import { onMount, onDestroy, tick } from 'svelte';
	import { browser } from '$app/environment';
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
	import { geolocate, changeDefaultIcons, toggleMapButtons, attribution } from '$lib/map/setup';
	import { errToast, detectTheme } from '$lib/utils';
	import { theme, areas, areaError, socials } from '$lib/store';

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

	// alert for area errors
	$: $areaError && errToast($areaError);

	$: communities = $areas.filter(
		(area) =>
			area.tags.type === 'community' &&
			area.tags.geo_json &&
			area.tags.name &&
			area.tags['icon:square'] &&
			area.tags.continent &&
			Object.keys(area.tags).find((key) => key.includes('contact'))
	);
	let filteredCommunities;

	let name;
	let address;
	let lat;
	let long;
	let selected = false;
	let category;
	let methods = [];
	let onchain;
	let lightning;
	let nfc;
	let website;
	let phone;
	let hours;
	let twitterMerchant;
	let twitterSubmitter;
	let notes;
	let source;
	let sourceOther;
	let sourceOtherElement;
	let contact;
	let noLocationSelected = false;
	let noMethodSelected = false;
	let submitted = false;
	let submitting = false;
	let submissionIssueNumber;

	const handleCheckboxClick = () => {
		noMethodSelected = false;
	};

	$: latFixed = lat && lat.toFixed(5);
	$: longFixed = long && long.toFixed(5);

	const submitForm = (e) => {
		e.preventDefault();
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
					twitterMerchant: twitterMerchant.value
						? twitterMerchant.value.startsWith('@')
							? twitterMerchant.value
							: '@' + twitterMerchant.value
						: '',
					twitterSubmitter: twitterSubmitter.value
						? twitterSubmitter.value.startsWith('@')
							? twitterSubmitter.value
							: '@' + twitterSubmitter.value
						: '',
					notes: notes.value,
					source,
					sourceOther: sourceOther ? sourceOther : '',
					contact: contact.value,
					communities: filteredCommunities
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
					console.log(error);
					submitting = false;
				});
		}
	};

	// location picker map
	let mapElement;
	let map;
	let mapLoaded;

	let osm;
	let alidadeSmoothDark;

	onMount(async () => {
		if (browser) {
			const theme = detectTheme();

			// fetch and add captcha
			fetchCaptcha();

			//import packages
			const leaflet = await import('leaflet');
			const DomEvent = await import('leaflet/src/dom/DomEvent');
			// eslint-disable-next-line no-unused-vars
			const leafletLocateControl = await import('leaflet.locatecontrol');

			// add map and tiles
			map = leaflet.map(mapElement, { attributionControl: false }).setView([0, 0], 2);

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

			// add marker on click
			let marker;

			map.on('click', (e) => {
				if (captchaSecret) {
					lat = e.latlng.lat;
					long = e.latlng.lng;

					if (marker) {
						map.removeLayer(marker);
					}
					// eslint-disable-next-line no-undef
					marker = L.marker([lat, long]).addTo(map);

					selected = true;

					// filter communities containing element
					filteredCommunities = communities
						.filter((community) => {
							let rewoundPoly = rewind(community.tags.geo_json, true);

							if (geoContains(rewoundPoly, [long, lat])) {
								return true;
							} else {
								return false;
							}
						})
						.map((community) => community.tags.name);
				}
			});

			// change broken marker image path in prod
			// eslint-disable-next-line no-undef
			L.Icon.Default.prototype.options.imagePath = '/icons/';

			// add locate button to map
			// eslint-disable-next-line no-undef
			geolocate(L, map);

			// change default icons
			// eslint-disable-next-line no-undef
			changeDefaultIcons('', L, mapElement, DomEvent);

			// add OSM attribution
			// eslint-disable-next-line no-undef
			attribution(L, map);

			mapLoaded = true;
		}
	});

	onDestroy(async () => {
		if (map) {
			console.log('Unloading Leaflet map.');
			map.remove();
		}
	});

	$: $theme !== undefined && mapLoaded === true && toggleMapButtons();

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
										href="https://wiki.btcmap.org/general/tagging-instructions.html#tagging-guidance"
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
							src="/videos/osm-tagging-tutorial.mp4"
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
								tooltip="NOTE: Due to the backlog of requests and the additions being completed on a volunteer effort, it may take several weeks to have your location added. It is encouraged to add your location to OpenStreetMap directly following the Shadowy Supertagger method if you want to appear on the map right away."
							/>
						</p>

						<form on:submit={submitForm} class="w-full space-y-5 text-primary dark:text-white">
							<div>
								<label for="name" class="mb-2 block font-semibold">Merchant Name</label>
								<input
									disabled={!captchaSecret || !mapLoaded}
									type="text"
									name="name"
									placeholder="Satoshi's Comics"
									required
									class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
									bind:this={name}
								/>
							</div>

							<div>
								<label for="address" class="mb-2 block font-semibold"
									>Address <InfoTooltip
										tooltip="All locations are required to have a physical
										address. You must be able to visit the location in person and pay with bitcoin. Service industries are not map-able."
									/></label
								>
								<input
									disabled={!captchaSecret || !mapLoaded}
									type="text"
									name="address"
									placeholder="2100 Freedom Drive..."
									required
									class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
									bind:this={address}
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
										<MapLoading
											type="embed"
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
								<label for="category" class="mb-2 block font-semibold">Category</label>
								<input
									disabled={!captchaSecret || !mapLoaded}
									required
									type="text"
									name="category"
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
								<label for="twitter" class="mb-2 block font-semibold"
									>Twitter handle <span class="font-normal">(optional)</span></label
								>
								<div class="flex space-x-2">
									<input
										disabled={!captchaSecret || !mapLoaded}
										type="text"
										name="twitter"
										placeholder="Merchant"
										class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
										bind:this={twitterMerchant}
									/>
									<input
										disabled={!captchaSecret || !mapLoaded}
										type="text"
										name="twitter"
										placeholder="Submitter"
										class="w-full rounded-2xl border-2 border-input p-3 transition-all focus:outline-link dark:bg-white/[0.15]"
										bind:this={twitterSubmitter}
									/>
								</div>
							</div>

							<div>
								<label for="notes" class="mb-2 block font-semibold"
									>Notes <span class="font-normal">(optional)</span></label
								>
								<textarea
									disabled={!captchaSecret || !mapLoaded}
									name="notes"
									placeholder="Any other relevant details?"
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
								<label for="contact" class="mb-2 block font-semibold"
									>Public Contact <span class="font-normal">(optional)</span></label
								>
								<p class="mb-2 text-justify text-sm">
									If we have any follow-up questions we will contact you in order to add your
									location successfully.
								</p>
								<input
									disabled={!captchaSecret || !mapLoaded}
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
				text="We’ll review your information and add it ASAP."
				issue={submissionIssueNumber}
				link="/add-location"
			/>
		{/if}

		<Footer />
	</div>
</div>

{#if typeof window !== 'undefined'}
	{#if detectTheme() === 'dark' || $theme === 'dark'}
		<style>
			select option {
				@apply bg-gray-700;
			}
		</style>
	{/if}
{/if}

<style>
	@import 'leaflet/dist/leaflet.css';
	@import 'leaflet.locatecontrol/dist/L.Control.Locate.min.css';
</style>
