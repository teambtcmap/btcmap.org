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
	let category;
	let methods = [];
	let onchain;
	let lightning;
	let nfc;
	let twitterMerchant;
	let twitterSubmitter;
	let notes;
	let noLocationSelected = false;
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
		if (!selected) {
			noLocationSelected = true;
		} else if (!onchain.checked && !lightning.checked && !nfc.checked) {
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
					osm: lat && long ? `https://www.openstreetmap.org/edit#map=21/${lat}/${long}` : '',
					category: category.value,
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
		{#if !submitted}
			<h1 class="text-4xl md:text-5xl gradient font-semibold mt-10 text-center lg:text-left">
				Join the bitcoin map community.
			</h1>

			<div class="mt-16 pb-20 md:pb-32 lg:flex justify-between">
				<section
					id="noob"
					class="mx-auto w-full md:w-2/3 lg:w-1/2 border-b lg:border-b-0 pb-14 lg:pb-0 lg:border-r border-input"
				>
					<div class="lg:w-10/12 xl:w-3/4">
						<h2 class="text-primary text-3xl font-semibold mb-5">Noob?</h2>

						<p class="text-primary w-full mb-10">
							Fill out the following form and one of our volunteer community members will add your
							location to the map.
						</p>

						<form on:submit={submitForm} class="text-primary space-y-5 w-full">
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
								<label for="location-picker" class="mb-2 block font-semibold">Select Location</label
								>
								{#if selected}
									<span class="text-green-500 font-semibold">Location selected!</span>
								{:else if noLocationSelected}
									<span class="text-error font-semibold">Please select a location...</span>
								{/if}
								<div
									bind:this={mapElement}
									class="z-10 !cursor-crosshair focus:outline-link border-2 border-input mb-2 rounded-2xl h-[300px]"
								/>
								<div class="flex space-x-2">
									<input
										required
										disabled
										bind:value={latFixed}
										readonly
										type="number"
										name="lat"
										placeholder="Latitude"
										class="focus:outline-link border-2 border-input rounded-2xl p-3 w-full"
									/>
									<input
										required
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
								<label for="category" class="mb-2 block font-semibold">Category</label>
								<input
									required
									type="text"
									name="category"
									placeholder="Restaurant etc."
									class="focus:outline-link border-2 border-input rounded-2xl p-3 w-full"
									bind:this={category}
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
											><img src="/icons/btc-primary.svg" alt="onchain" class="inline" /> On-chain</label
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
											><img src="/icons/ln-primary.svg" alt="lightning" class="inline" /> Lightning</label
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
											><img src="/icons/nfc-primary.svg" alt="nfc" class="inline" /> Lightning Contactless</label
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
									placeholder="Any other relevant details? Website URL, phone number etc."
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

				<section id="supertagger" class="mx-auto w-full md:w-2/3 lg:w-1/2 pt-14 lg:pt-0">
					<div class="lg:flex justify-end">
						<div class="lg:w-10/12 xl:w-3/4">
							<h2 class="text-primary text-3xl font-semibold mb-5">Shadowy Supertagger?</h2>
							<p class="text-primary w-full mb-10">
								Contribute changes directly to OSM - like a 😎 boss. Who needs forms anyway.
							</p>
							<img
								src="/images/supertagger.svg"
								alt="shadowy supertagger"
								class="w-[220px] h-[220px] mb-10 mx-auto"
							/>
							<PrimaryButton
								text="See Wiki for instructions"
								link="https://github.com/teambtcmap/btcmap-data/wiki/Tagging-Instructions"
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
					<h2 class="gradient text-4xl font-semibold mb-5">Location Submitted!</h2>
					<p class="text-primary w-full md:w-[500px] mb-5">
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

		<Footer style="justify-center lg:justify-start" />
	</div>
</div>

<style>
	@import 'leaflet/dist/leaflet.css';
	@import 'leaflet.locatecontrol/dist/L.Control.Locate.min.css';
</style>
