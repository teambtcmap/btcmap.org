<script>
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import axios from 'axios';
	import { Header, Footer, PrimaryButton, MapLoading, FormSuccess } from '$comp';
	import { fullscreenButton, geolocate, changeDefaultIcons } from '$lib/map/setup';
	import { errToast, successToast } from '$lib/utils';

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

	let location = { minLat: '', minLong: '', maxLat: '', maxLong: '' };
	let name;
	let icon;
	let lightning;
	let socialLinks;
	let discord;
	let contact;

	let selected = false;
	let noLocationSelected = false;
	let submitted = false;
	let submitting = false;
	let submissionIssueNumber;

	const setLocation = () => {
		const coords = map.getBounds();
		location.minLat = coords._northEast.lat;
		location.minLong = coords._northEast.lng;
		location.maxLat = coords._southWest.lat;
		location.maxLong = coords._southWest.lng;
		selected = true;
		successToast('Location set!');
	};

	const submitForm = (e) => {
		e.preventDefault();
		if (!selected) {
			noLocationSelected = true;
			errToast('Please select a location...');
		} else {
			submitting = true;

			axios
				.post('/communities/add/endpoint', {
					captchaSecret,
					captchaTest: captchaInput,
					honey: honeyInput,
					location,
					name,
					icon: icon ? icon : '',
					lightning: lightning ? lightning : '',
					discord: discord ? 'Yes' : 'No',
					socialLinks: socialLinks ? socialLinks : '',
					contact
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

	// location picker map
	let mapElement;
	let map;
	let mapLoaded;

	onMount(async () => {
		if (browser) {
			// fetch and add captcha
			fetchCaptcha();

			//import packages
			const leaflet = await import('leaflet');
			const DomEvent = await import('leaflet/src/dom/DomEvent');
			const leafletLocateControl = await import('leaflet.locatecontrol');

			// add map and tiles
			map = leaflet.map(mapElement, { attributionControl: false }).setView([0, 0], 2);

			const osm = leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				noWrap: true,
				maxZoom: 19
			});

			osm.addTo(map);

			// change broken marker image path in prod
			L.Icon.Default.prototype.options.imagePath = '/icons/';

			// add fullscreen button to map
			fullscreenButton(L, mapElement, map, DomEvent);

			// add locate button to map
			geolocate(L, map);

			// change default icons
			changeDefaultIcons();

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

<svelte:head>
	<title>BTC Map - Add Community</title>
	<meta property="og:image" content="https://btcmap.org/images/og/add-community.png" />
	<meta property="twitter:title" content="BTC Map - Add Community" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/add-community.png" />
</svelte:head>

<div class="bg-teal">
	<Header />
	<div class="w-10/12 xl:w-[1200px] mx-auto">
		{#if !submitted}
			<h1 class="text-4xl md:text-5xl gradient font-semibold mt-10 text-center">
				Make an impact locally!
			</h1>

			<section id="add-community" class="mx-auto w-full md:w-[600px] mt-16 pb-20 md:pb-32">
				<h2 class="text-primary text-3xl font-semibold mb-5 text-center">Add Community</h2>

				<p class="text-primary w-full mb-10 text-center">
					Please fill out this form to submit a community application. This is a great way to grow
					bitcoin adoption in your area, have some fun, and maybe even make some friends along the
					way.
				</p>

				<form on:submit={submitForm} class="text-primary space-y-5 w-full">
					<div>
						<div>
							<label for="location-picker" class="mb-2 block font-semibold">Set Location</label>
							<p class="text-sm mb-2">
								Zoom and pan the map to the extent you want included in your community.
							</p>
							{#if selected}
								<span class="text-green-500 font-semibold">Location set!</span>
							{:else if noLocationSelected}
								<span class="text-error font-semibold">Please set a location...</span>
							{/if}
							<div class="relative mb-2">
								<div
									bind:this={mapElement}
									class="!bg-teal z-10 border-2 border-input rounded-2xl h-[300px] md:h-[450px]"
								/>
								{#if !mapLoaded}
									<MapLoading
										type="embed"
										style="h-[300px] md:h-[450px] border-2 border-input rounded-2xl"
									/>
								{/if}
							</div>
						</div>

						<PrimaryButton
							type="button"
							click={setLocation}
							disabled={!captchaSecret || !mapLoaded}
							text="Set Location"
							style="w-full py-3 rounded-xl"
						/>
					</div>

					<div>
						<label for="name" class="mb-2 block font-semibold">Community Name</label>
						<input
							disabled={!captchaSecret || !mapLoaded}
							type="text"
							name="name"
							placeholder="Bitcoin Island Philippines"
							required
							class="focus:outline-link border-2 border-input rounded-2xl p-3 w-full transition-all"
							bind:value={name}
						/>
					</div>

					<div>
						<label for="icon" class="mb-2 block font-semibold"
							>Icon URL <span class="font-normal">(optional)</span></label
						>
						<p class="text-sm mb-2">
							We will use the avatar from your social link or the country's flag your community is
							located in if an icon is not provided.
						</p>
						<input
							disabled={!captchaSecret || !mapLoaded}
							type="url"
							name="icon"
							placeholder="https://btcmap.org/images/communities/iom.svg"
							class="focus:outline-link border-2 border-input rounded-2xl p-3 w-full transition-all"
							bind:value={icon}
						/>
					</div>

					<div>
						<label for="lightning" class="mb-2 block font-semibold"
							>Lightning Tips <span class="font-normal">(optional)</span></label
						>
						<p class="text-sm mb-2">
							If you want the ability to receive sats you can add either a <a
								href="https://lightningaddress.com/"
								target="_blank"
								rel="noreferrer"
								class="text-link hover:text-hover transition-colors">Lightning Address</a
							>
							or
							<a
								href="https://github.com/fiatjaf/lnurl-rfc#lnurl-documents"
								target="_blank"
								rel="noreferrer"
								class="text-link hover:text-hover transition-colors">LNURL-pay</a
							> string.
						</p>
						<input
							disabled={!captchaSecret || !mapLoaded}
							type="text"
							name="lightning"
							placeholder="btcmap@zbd.gg"
							class="focus:outline-link border-2 border-input rounded-2xl p-3 w-full transition-all"
							bind:value={lightning}
						/>
					</div>

					<div>
						<label for="socials" class="mb-2 block font-semibold">Social Links</label>
						<p class="text-sm mb-2">
							You need to provide at least one method for people to join your community. We can
							create a channel for you on the BTC Map Discord server if requested.
						</p>

						<div class="mb-2 flex items-center space-x-2">
							<label for="discord" class="text-sm cursor-pointer">Create a Discord channel</label>
							<input
								class="accent-link w-4 h-4"
								disabled={!captchaSecret || !mapLoaded}
								type="checkbox"
								id="discord"
								name="discord"
								bind:checked={discord}
							/>
						</div>

						<textarea
							required={!discord}
							disabled={!captchaSecret || !mapLoaded}
							name="socials"
							placeholder="Website, Twitter, Telegram, Matrix etc."
							rows="3"
							class="focus:outline-link border-2 border-input rounded-2xl p-3 w-full transition-all"
							bind:value={socialLinks}
						/>
					</div>

					<div>
						<label for="icon" class="mb-2 block font-semibold">Public Contact</label>
						<p class="text-sm mb-2">
							A way to get in touch with the community leader if we have any questions.
						</p>
						<input
							required
							disabled={!captchaSecret || !mapLoaded}
							type="text"
							name="contact"
							placeholder="e.g. hello@btcmap.org"
							class="focus:outline-link border-2 border-input rounded-2xl p-3 w-full transition-all"
							bind:value={contact}
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
								disabled={!captchaSecret || !mapLoaded}
								required
								type="text"
								name="captcha"
								placeholder="Please enter the captcha text."
								class="focus:outline-link border-2 border-input rounded-2xl p-3 w-full transition-all"
								bind:value={captchaInput}
							/>
						</div>
					</div>

					<input
						type="text"
						name="honey"
						placeholder="A nice pot of honey."
						class="hidden"
						bind:value={honeyInput}
					/>

					<PrimaryButton
						loading={submitting}
						disabled={submitting || !captchaSecret || !mapLoaded}
						text="Submit Community"
						style="w-full py-3 rounded-xl"
					/>
				</form>
			</section>
		{:else}
			<FormSuccess
				type="Community"
				text="Thanks for your initiative to create a bitcoin community. We’ll review your information
	and reach out if we need any more details."
				issue={submissionIssueNumber}
				link="/communities/add"
				buttonWidth="w-60"
			/>
		{/if}

		<Footer />
	</div>
</div>

<style>
	@import 'leaflet/dist/leaflet.css';
	@import 'leaflet.locatecontrol/dist/L.Control.Locate.min.css';
</style>
