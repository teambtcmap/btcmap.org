<script>
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import axios from 'axios';
	import { LottiePlayer } from '@lottiefiles/svelte-lottie-player';
	import { Header, Footer, PrimaryButton } from '$comp';
	import { socials } from '$lib/store';

	let name;
	let address;
	let lat;
	let long;
	let selected = false;
	let url;
	let methods = [];
	let onchain;
	let lightning;
	let nfc;
	let twitterMerchant;
	let twitterSubmitter;
	let notes;
	let noMethodSelected = false;
	let submitted = false;
	let submitting = false;

	const handleCheckboxClick = () => {
		noMethodSelected = false;
	};

	$: latFixed = lat && lat.toFixed(5);
	$: longFixed = long && long.toFixed(5);

	const submitForm = (e) => {
		e.preventDefault();

		if (!onchain.checked && !lightning.checked && !nfc.checked) {
			noMethodSelected = true;
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
					name: name.value,
					address: address.value,
					lat: lat ? lat.toString() : '',
					long: long ? long.toString() : '',
					osm: lat && long ? `https://www.openstreetmap.org/edit#map=19/${lat}/${long}` : '',
					url: url.value,
					methods: methods,
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
					notes: notes.value
				})
				.then(function (response) {
					console.log(response);
					submitted = true;
				})
				.catch(function (error) {
					methods = [];
					alert('Form submission failed, please try again or contact the BTC Map team.');
					console.log(error);
					submitting = false;
				});
		}
	};

	// location picker map
	let mapElement;
	let map;

	onMount(async () => {
		if (browser) {
			//import packages
			const leaflet = await import('leaflet');
			const leafletLocateControl = await import('leaflet.locatecontrol');

			// add map and tiles
			map = leaflet.map(mapElement, { attributionControl: false }).setView([0, 0], 2);

			const osm = leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				noWrap: true,
				maxZoom: 19
			});

			osm.addTo(map);

			// add marker on click
			let marker;

			map.on('click', (e) => {
				lat = e.latlng.lat;
				long = e.latlng.lng;

				if (marker) {
					map.removeLayer(marker);
				}

				marker = L.marker([lat, long]).addTo(map);

				selected = true;
			});

			// change broken marker image path in prod
			L.Icon.Default.prototype.options.imagePath = '/icons/';

			// adds locate button to map
			L.control.locate().addTo(map);
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
	<div class="w-10/12 xl:w-[1200px] mx-auto">
		<Header />
		{#if !submitted}
			<div class="space-x-4 mt-10">
				<a href="/" class="text-link hover:text-hover font-semibold"
					><i class="fa-solid fa-house mr-2" /> Home</a
				> <i class="fa-solid fa-chevron-right text-grey" />
				<span class="font-semibold">Add location</span>
			</div>

			<h1 class="text-4xl md:text-5xl font-semibold mt-8 text-center lg:text-left">
				Add a location
			</h1>

			<div class="mt-16 pb-20 md:pb-32 lg:flex justify-between">
				<section
					id="noob"
					class="mx-auto w-full md:w-2/3 lg:w-1/2 border-b lg:border-b-0 pb-14 lg:pb-0 lg:border-r border-input"
				>
					<div class="lg:w-10/12 xl:w-3/4">
						<h2 class="text-3xl font-semibold mb-5">Noob?</h2>

						<p class="w-full mb-10">
							Fill out the following form and one of our volunteer community members will add your
							location to the map.
						</p>

						<form on:submit={submitForm} class="space-y-5 w-full">
							<div>
								<label for="name" class="mb-2 block font-semibold">Merchant Name</label>
								<input
									type="text"
									name="name"
									placeholder="Satoshi's Comics"
									required
									class="focus:outline-link border-2 border-input rounded-2xl p-3 w-full"
									bind:this={name}
								/>
							</div>
							<div>
								<label for="address" class="mb-2 block font-semibold">Address</label>
								<input
									type="text"
									name="address"
									placeholder="2100 Freedom Drive..."
									required
									class="focus:outline-link border-2 border-input rounded-2xl p-3 w-full"
									bind:this={address}
								/>
							</div>
							<div>
								<label for="location-picker" class="mb-2 block font-semibold"
									>Select Location <span class="font-normal">(optional)</span></label
								>
								{#if selected}
									<span class="text-green-500 font-semibold">Location selected!</span>
								{/if}
								<div
									bind:this={mapElement}
									class="!cursor-crosshair focus:outline-link border-2 border-input mb-2 rounded-2xl h-[300px]"
								/>
								<div class="flex space-x-2">
									<input
										disabled
										bind:value={latFixed}
										readonly
										type="number"
										name="lat"
										placeholder="Latitude"
										class="focus:outline-link border-2 border-input rounded-2xl p-3 w-full"
									/>
									<input
										disabled
										bind:value={longFixed}
										readonly
										type="number"
										name="long"
										placeholder="Longitude"
										class="focus:outline-link border-2 border-input rounded-2xl p-3 w-full"
									/>
								</div>
							</div>
							<div>
								<label for="location" class="mb-2 block font-semibold"
									>Location URL <span class="font-normal">(optional)</span></label
								>
								<input
									type="url"
									name="location"
									placeholder="e.g. https://google.com/maps/..."
									class="focus:outline-link border-2 border-input rounded-2xl p-3 w-full"
									bind:this={url}
								/>
							</div>

							<fieldset>
								<legend class="mb-2 block font-semibold">Select one or more options</legend>
								{#if noMethodSelected}
									<span class="text-error font-semibold">Please fix this...</span>
								{/if}
								<div class="space-y-4">
									<div>
										<input
											type="checkbox"
											name="onchain"
											id="onchain"
											bind:this={onchain}
											on:click={handleCheckboxClick}
										/>
										<label for="onchain" class="ml-1 cursor-pointer"
											><img src="/icons/btc-black.svg" alt="onchain" class="inline" /> On-chain</label
										>
									</div>
									<div>
										<input
											type="checkbox"
											name="lightning"
											id="lightning"
											bind:this={lightning}
											on:click={handleCheckboxClick}
										/>
										<label for="lightning" class="ml-1 cursor-pointer"
											><img src="/icons/ln-black.svg" alt="lightning" class="inline" /> Lightning</label
										>
									</div>
									<div>
										<input
											type="checkbox"
											name="nfc"
											id="nfc"
											bind:this={nfc}
											on:click={handleCheckboxClick}
										/>
										<label for="nfc" class="ml-1 cursor-pointer"
											><img src="/icons/nfc-black.svg" alt="nfc" class="inline" /> Lightning Contactless</label
										>
									</div>
								</div>
							</fieldset>

							<div>
								<label for="twitter" class="mb-2 block font-semibold"
									>Twitter handle <span class="font-normal">(optional)</span></label
								>
								<div class="flex space-x-2">
									<input
										type="text"
										name="twitter"
										placeholder="Merchant"
										class="focus:outline-link border-2 border-input rounded-2xl p-3 w-full"
										bind:this={twitterMerchant}
									/>
									<input
										type="text"
										name="twitter"
										placeholder="Submitter"
										class="focus:outline-link border-2 border-input rounded-2xl p-3 w-full"
										bind:this={twitterSubmitter}
									/>
								</div>
							</div>
							<div>
								<label for="notes" class="mb-2 block font-semibold"
									>Notes <span class="font-normal">(optional)</span></label
								>
								<textarea
									name="notes"
									placeholder="Any other relevant details? Website URL, phone number, business type etc."
									rows="5"
									class="focus:outline-link border-2 border-input rounded-2xl p-3 w-full"
									bind:this={notes}
								/>
							</div>

							<PrimaryButton
								loading={submitting}
								disabled={submitting}
								text="Submit Location"
								style="w-full py-3 rounded-xl"
							/>
						</form>
					</div>
				</section>

				<section id="supercoder" class="mx-auto w-full md:w-2/3 lg:w-1/2 pt-14 lg:pt-0">
					<div class="lg:flex justify-end">
						<div class="lg:w-10/12 xl:w-3/4">
							<h2 class="text-3xl font-semibold mb-5">Shadowy supertagger?</h2>
							<p class="w-full mb-10">
								Contribute changes directly to OSM - like a 😎 boss. Who needs forms anyway.
							</p>
							<img src="/images/supercoder.svg" alt="shadowy supercoder" class="mb-10 mx-auto" />
							<PrimaryButton
								text="See Wiki for instructions"
								link="https://github.com/teambtcmap/btcmap.org/wiki/Tagging-Instructions"
								style="w-full py-3 rounded-xl"
								external
							/>
						</div>
					</div>
				</section>
			</div>
		{:else}
			<div class="flex justify-center items-center text-center pb-20 md:pb-32 mt-10">
				<div>
					<h2 class="text-4xl font-semibold mb-5">Location Submitted!</h2>
					<p class="w-full md:w-[500px] mb-5">
						We’ll review your information and add it asap. If you wish to know the status of your
						contribution, join our <a
							href={$socials.discord}
							target="_blank"
							rel="noreferrer"
							class="text-link hover:text-hover">Discord channel</a
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
						text="Submit another location"
						link="/add-location"
						style="w-52 py-3 mx-auto mt-10 rounded-xl"
					/>
				</div>
			</div>
		{/if}

		<Footer />
	</div>
</div>

<style>
	@import 'leaflet/dist/leaflet.css';
	@import 'leaflet.locatecontrol/dist/L.Control.Locate.min.css';
</style>
