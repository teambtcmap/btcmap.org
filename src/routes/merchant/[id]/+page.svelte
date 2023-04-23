<script>
	export let data;

	import axios from 'axios';
	import axiosRetry from 'axios-retry';
	import rewind from '@mapbox/geojson-rewind';
	import { geoContains } from 'd3-geo';
	import tippy from 'tippy.js';
	import Time from 'svelte-time';
	import { browser } from '$app/environment';
	import { onMount, onDestroy } from 'svelte';
	import {
		users,
		events,
		elements,
		areas,
		theme,
		boost,
		exchangeRate,
		resetBoost,
		showTags
	} from '$lib/store';
	import {
		layers,
		attribution,
		changeDefaultIcons,
		calcVerifiedDate,
		latCalc,
		longCalc,
		generateIcon,
		verifiedArr,
		toggleMapButtons,
		geolocate,
		checkAddress
	} from '$lib/map/setup';
	import { goto } from '$app/navigation';
	import {
		Header,
		Footer,
		MerchantEvent,
		TopButton,
		MapLoading,
		Icon,
		MerchantLink,
		MerchantButton,
		Boost,
		ShowTags,
		PrimaryButton
	} from '$comp';
	import { successToast, errToast, detectTheme } from '$lib/utils';

	const merchant = $elements.find((element) => element.id == data.id && !element['deleted_at']);

	if (!merchant) {
		console.log('Could not find merchant, please try again or contact BTC Map.');
		goto('/404');
	}

	axiosRetry(axios, { retries: 3 });

	const name = merchant.osm_json.tags?.name || '';
	const icon = merchant.tags['icon:android'];
	const address = merchant.osm_json.tags ? checkAddress(merchant.osm_json.tags) : '';
	const description = merchant.osm_json.tags?.description || '';
	const hours = merchant.osm_json.tags?.['opening_hours'] || '';
	const payment = merchant.tags['payment:uri']
		? { type: 'uri', url: merchant.tags['payment:uri'] }
		: merchant.tags['payment:pouch']
		? { type: 'pouch', username: merchant.tags['payment:pouch'] }
		: merchant.tags['payment:coinos']
		? { type: 'coinos', username: merchant.tags['payment:coinos'] }
		: undefined;
	const boosted =
		merchant.tags['boost:expires'] && Date.parse(merchant.tags['boost:expires']) > Date.now()
			? merchant.tags['boost:expires']
			: undefined;
	const verified = verifiedArr(merchant.osm_json);
	const verifiedDate = calcVerifiedDate();
	const phone = merchant.osm_json.tags?.phone || '';
	const website = merchant.osm_json.tags?.website || '';
	const twitter = merchant.osm_json.tags?.['contact:twitter'] || '';
	const paymentMethod =
		merchant.osm_json.tags &&
		(merchant.osm_json.tags['payment:onchain'] ||
			merchant.osm_json.tags['payment:lightning'] ||
			merchant.osm_json.tags['payment:lightning_contactless']);

	let onchainTooltip;
	let lnTooltip;
	let nfcTooltip;
	let verifiedTooltip;

	$: onchainTooltip &&
		tippy([onchainTooltip], {
			content:
				merchant.osm_json.tags?.['payment:onchain'] === 'yes'
					? 'On-chain accepted'
					: merchant.osm_json.tags?.['payment:onchain'] === 'no'
					? 'On-chain not accepted'
					: 'On-chain unknown'
		});

	$: lnTooltip &&
		tippy([lnTooltip], {
			content:
				merchant.osm_json.tags?.['payment:lightning'] === 'yes'
					? 'Lightning accepted'
					: merchant.osm_json.tags?.['payment:lightning'] === 'no'
					? 'Lightning not accepted'
					: 'Lightning unknown'
		});

	$: nfcTooltip &&
		tippy([nfcTooltip], {
			content:
				merchant.osm_json.tags?.['payment:lightning_contactless'] === 'yes'
					? 'Lightning Contactless accepted'
					: merchant.osm_json.tags?.['payment:lightning_contactless'] === 'no'
					? 'Lightning contactless not accepted'
					: 'Lightning Contactless unknown'
		});

	$: verifiedTooltip &&
		tippy([verifiedTooltip], {
			content: 'Verified within the last year'
		});

	const lat = latCalc(merchant['osm_json']);
	const long = longCalc(merchant['osm_json']);

	let boostLoading = false;

	const resetBoostLoading = () => {
		boostLoading = false;
	};

	const startBoost = () => {
		boostLoading = true;

		$boost = {
			id: merchant.id,
			name: merchant.osm_json.tags?.name || '',
			boost: boosted ? boosted : ''
		};

		axios
			.get('https://blockchain.info/ticker')
			.then(function (response) {
				$exchangeRate = response.data['USD']['15m'];
			})
			.catch(function (error) {
				errToast('Could not fetch bitcoin exchange rate, please try again or contact BTC Map.');
				console.log(error);
				resetBoostLoading();
			});
	};

	$: $resetBoost && resetBoostLoading();

	let loading = true;

	const communities = $areas.filter(
		(area) =>
			area.tags.type === 'community' &&
			area.tags.geo_json &&
			area.tags.name &&
			area.tags['icon:square'] &&
			area.tags.continent &&
			Object.keys(area.tags).find((key) => key.includes('contact'))
	);

	// filter communities containing element
	const filteredCommunities = communities.filter((community) => {
		let rewoundPoly = rewind(community.tags.geo_json, true);

		if (geoContains(rewoundPoly, [long, lat])) {
			return true;
		} else {
			return false;
		}
	});

	let hideArrow = false;
	let activityDiv;

	const merchantEvents = $events.filter((event) => event.element_id === merchant.id);

	merchantEvents.sort((a, b) => Date.parse(b['created_at']) - Date.parse(a['created_at']));

	let eventCount = 50;
	$: eventsPaginated = merchantEvents.slice(0, eventCount);

	loading = false;

	const findUser = (tagger) => {
		let foundUser = $users.find((user) => user.id == tagger['user_id']);

		if (foundUser) {
			return foundUser;
		} else {
			return '';
		}
	};

	let mapElement;
	let map;
	let mapLoaded;

	let baseMaps;

	onMount(async () => {
		if (browser) {
			//import packages
			const leaflet = await import('leaflet');
			const DomEvent = await import('leaflet/src/dom/DomEvent');
			/* eslint-disable no-unused-vars */
			const leafletLocateControl = await import('leaflet.locatecontrol');
			/* eslint-enable no-unused-vars */

			// add map
			map = leaflet.map(mapElement, { attributionControl: false });

			// add tiles and basemaps
			baseMaps = layers(leaflet, map);

			// change broken marker image path in prod
			// eslint-disable-next-line no-undef
			L.Icon.Default.prototype.options.imagePath = '/icons/';

			// add OSM attribution
			// eslint-disable-next-line no-undef
			attribution(L, map);

			// eslint-disable-next-line no-undef, no-unused-vars
			const layerControl = L.control.layers(baseMaps).addTo(map);

			// add locate button to map
			// eslint-disable-next-line no-undef
			geolocate(L, map);

			// change default icons
			// eslint-disable-next-line no-undef
			changeDefaultIcons('layers', L, mapElement, DomEvent);

			// add element to map
			// eslint-disable-next-line no-undef
			const divIcon = generateIcon(L, icon, boosted);

			// eslint-disable-next-line no-undef
			const marker = L.marker([lat, long], { icon: divIcon });

			map.addLayer(marker);

			map.fitBounds([[lat, long]]);

			mapLoaded = true;
		}
	});

	const toggleTheme = () => {
		if ($theme === 'dark') {
			baseMaps['OSM Bright'].remove();
			baseMaps['Alidade Smooth Dark'].addTo(map);
		} else {
			baseMaps['Alidade Smooth Dark'].remove();
			baseMaps['OSM Bright'].addTo(map);
		}
	};

	$: $theme !== undefined && mapLoaded === true && toggleMapButtons();

	$: $theme !== undefined && mapLoaded === true && toggleTheme();

	onDestroy(async () => {
		if (map) {
			console.log('Unloading Leaflet map.');
			map.remove();
		}
	});
</script>

<svelte:head>
	{#if payment && payment.type === 'uri' && payment.url.startsWith('lightning:')}
		<meta name="lightning" content="lnurlp:{payment.url.slice(10, payment.url.length)}" />
		<meta property="alby:image" content="/images/logo.svg" />
		<meta property="alby:name" content={name ? name : 'BTC Map Merchant'} />
	{:else}
		<meta
			name="lightning"
			content="lnurlp:LNURL1DP68GURN8GHJ7CM0WFJJUCN5VDKKZUPWDAEXWTMVDE6HYMRS9ARKXVN4W5EQPSYZ34"
		/>
		<meta property="alby:image" content="/images/logo.svg" />
		<meta property="alby:name" content="BTC Map" />
	{/if}
</svelte:head>

<div class="bg-teal dark:bg-dark">
	<Header />
	<div class="mx-auto w-10/12 xl:w-[1200px]">
		<main class="my-10 space-y-16 text-center md:my-20">
			<section id="profile" class="space-y-8">
				<div class="space-y-2">
					<div
						class="mx-auto flex h-32 w-32 items-center justify-center rounded-full {boosted
							? 'bg-bitcoin hover:animate-wiggle'
							: 'bg-link'}"
					>
						<Icon
							w="60"
							h="60"
							style="text-white"
							icon={icon !== 'question_mark' ? icon : 'currency_bitcoin'}
							type="material"
						/>
					</div>

					<h1 class="text-4xl font-semibold !leading-tight text-primary dark:text-white">
						{name ? name : 'BTC Map Merchant'}
					</h1>

					{#if address}
						<h2 class="text-xl text-primary dark:text-white">
							{address}
						</h2>
					{/if}

					<a
						href={`/map?lat=${lat}&long=${long}`}
						class="inline-flex items-center justify-center text-xs text-link transition-colors hover:text-hover"
						>View on main map <svg
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

				<div class="flex flex-wrap items-center justify-center gap-4">
					<MerchantLink link={`geo:${lat},${long}`} icon="compass" text="Navigate" />

					<MerchantLink
						link={`https://www.openstreetmap.org/edit?${merchant.osm_json.type}=${merchant.osm_json.id}`}
						icon="pencil"
						text="Edit"
					/>

					<MerchantButton
						click={() => {
							navigator.clipboard.writeText(`https://btcmap.org/merchant/${merchant.id}`);
							successToast('Link copied to clipboard!');
						}}
						icon="share"
						text="Share"
					/>

					{#if payment}
						<MerchantLink
							link={payment.type === 'uri'
								? payment.url
								: payment.type === 'pouch'
								? `https://app.pouch.ph/${payment.username}`
								: payment.type === 'coinos'
								? `https://coinos.io/${payment.username}`
								: '#'}
							icon="bolt"
							text="Pay Merchant"
						/>
					{/if}

					{#if phone}
						<MerchantLink link={`tel:${phone}`} icon="phone" text="Call" />
					{/if}

					{#if website}
						<MerchantLink
							link={website.startsWith('http') ? website : `https://${website}`}
							icon="globe"
							text="Website"
						/>
					{/if}

					{#if twitter}
						<MerchantLink
							link={twitter.startsWith('http') ? twitter : `https://twitter.com/${twitter}`}
							icon="twitter"
							text="Twitter"
						/>
					{/if}

					<span id="show-tags">
						<MerchantButton
							click={() => ($showTags = merchant.osm_json.tags || {})}
							icon="tags"
							text="Show Tags"
						/>
					</span>

					<MerchantLink
						link={`https://www.openstreetmap.org/${merchant.osm_json.type}/${merchant.osm_json.id}`}
						icon="external"
						text="View OSM"
					/>
				</div>

				{#if paymentMethod}
					<div>
						<h4 class="uppercase text-primary dark:text-white">Accepted Payments</h4>
						<div class="mt-1 flex items-center justify-center space-x-2">
							{#if typeof window !== 'undefined'}
								<img
									bind:this={onchainTooltip}
									src={merchant.osm_json.tags['payment:onchain'] === 'yes'
										? detectTheme() === 'dark' || $theme === 'dark'
											? '/icons/btc-highlight-dark.svg'
											: '/icons/btc-highlight.svg'
										: merchant.osm_json.tags['payment:onchain'] === 'no'
										? detectTheme() === 'dark' || $theme === 'dark'
											? '/icons/btc-no-dark.svg'
											: '/icons/btc-no-teal.svg'
										: detectTheme() === 'dark' || $theme === 'dark'
										? '/icons/btc-dark.svg'
										: '/icons/btc.svg'}
									alt="bitcoin"
									class="h-8 w-8"
								/>

								<img
									bind:this={lnTooltip}
									src={merchant.osm_json.tags['payment:lightning'] === 'yes'
										? detectTheme() === 'dark' || $theme === 'dark'
											? '/icons/ln-highlight-dark.svg'
											: '/icons/ln-highlight.svg'
										: merchant.osm_json.tags['payment:lightning'] === 'no'
										? detectTheme() === 'dark' || $theme === 'dark'
											? '/icons/ln-no-dark.svg'
											: '/icons/ln-no-teal.svg'
										: detectTheme() === 'dark' || $theme === 'dark'
										? '/icons/ln-dark.svg'
										: '/icons/ln.svg'}
									alt="lightning"
									class="h-8 w-8"
								/>

								<img
									bind:this={nfcTooltip}
									src={merchant.osm_json.tags['payment:lightning_contactless'] === 'yes'
										? detectTheme() === 'dark' || $theme === 'dark'
											? '/icons/nfc-highlight-dark.svg'
											: '/icons/nfc-highlight.svg'
										: merchant.osm_json.tags['payment:lightning_contactless'] === 'no'
										? detectTheme() === 'dark' || $theme === 'dark'
											? '/icons/nfc-no-dark.svg'
											: '/icons/nfc-no-teal.svg'
										: detectTheme() === 'dark' || $theme === 'dark'
										? '/icons/nfc-dark.svg'
										: '/icons/nfc.svg'}
									alt="nfc"
									class="h-8 w-8"
								/>
							{/if}
						</div>
					</div>
				{/if}

				{#if description}
					<p class="mx-auto max-w-[600px] text-primary dark:text-white">{description}</p>
				{/if}

				<div class="grid-cols-2 gap-12 space-y-12 lg:grid lg:space-y-0">
					{#if phone}
						<div class="text-primary dark:text-white">
							<h3 class="mb-4 text-2xl font-semibold">Contact</h3>

							<div class="flex items-center justify-center">
								<Icon
									w="30"
									h="30"
									style="text-primary dark:text-white mr-2"
									icon="phone"
									type="popup"
								/>
								<strong>{phone}</strong>
							</div>
						</div>
					{/if}

					{#if hours}
						<div class="text-primary dark:text-white">
							<h3 class="mb-4 text-2xl font-semibold">Hours</h3>

							<div class="items-center justify-center md:flex">
								<Icon
									w="30"
									h="30"
									style="text-primary dark:text-white mx-auto md:mx-0 mb-2 md:mb-0 md:mr-2"
									icon="clock"
									type="popup"
								/>
								<strong>{hours}</strong>
							</div>
						</div>
					{/if}

					<div class="space-y-4 text-primary dark:text-white">
						<h3 class="text-2xl font-semibold">Last Surveyed</h3>

						{#if verified.length}
							<div class="flex items-center justify-center">
								{#if Date.parse(verified[0]) > verifiedDate}
									<span bind:this={verifiedTooltip}>
										<Icon
											w="30"
											h="30"
											style="text-primary dark:text-white mr-2"
											icon="verified"
											type="popup"
										/>
									</span>
								{/if}
								<strong>{verified[0]}</strong>
							</div>
						{:else}
							<p class="font-semibold">This location needs to be surveyed!</p>
						{/if}

						<PrimaryButton
							text="Verify Location"
							link={`/verify-location?${
								name ? `&name=${name.replaceAll('&', '%26')}` : ''
							}&lat=${lat}&long=${long}&${merchant.osm_json.type}=${merchant.osm_json.id}`}
							style="rounded-xl p-3 w-40 mx-auto"
						/>
					</div>

					<div class="space-y-4 text-primary dark:text-white">
						<h3 class="text-2xl font-semibold">Boost</h3>

						<p class="mx-auto max-w-[300px] font-semibold">
							{boosted
								? 'This location is boosted!'
								: "Boost this location to improve it's visibility on the map."}
						</p>

						{#if boosted}
							<p>
								Boost Expires: <span
									class="underline decoration-bitcoin decoration-4 underline-offset-8"
									><Time live={3000} relative={true} timestamp={boosted} /></span
								>
							</p>
						{/if}

						<button
							id="boost-button"
							on:click={startBoost}
							disabled={boostLoading}
							class="{boosted
								? 'bg-bitcoin hover:bg-bitcoinHover'
								: 'bg-link hover:bg-hover'} mx-auto flex w-40 items-center justify-center rounded-xl p-3 text-center font-semibold text-white transition-colors"
						>
							<Icon
								w="20"
								h="20"
								style="text-white mr-1"
								icon={boosted ? 'boost-solid' : 'boost'}
								type="popup"
							/>
							{boostLoading ? 'Boosting...' : boosted ? 'Extend Boost' : 'Boost'}
						</button>
					</div>
				</div>
			</section>

			<section id="map-section">
				<h3
					class="rounded-t-3xl border border-b-0 border-statBorder p-5 text-center text-lg font-semibold text-primary dark:bg-white/10 dark:text-white lg:text-left"
				>
					{name ? name : 'Merchant'} Location
				</h3>

				<div class="relative">
					<div
						bind:this={mapElement}
						class="z-10 h-[300px] rounded-b-3xl border border-statBorder !bg-teal text-left dark:!bg-[#202f33] md:h-[600px]"
					/>
					{#if !mapLoaded}
						<MapLoading
							type="embed"
							style="h-[300px] md:h-[600px] border border-statBorder rounded-b-3xl"
						/>
					{/if}
				</div>
			</section>

			<section id="activity">
				<div class="w-full rounded-3xl border border-statBorder dark:bg-white/10">
					<h3
						class="border-b border-statBorder p-5 text-center text-lg font-semibold text-primary dark:text-white lg:text-left"
					>
						{name ? name : 'Merchant'} Activity
					</h3>

					<div
						bind:this={activityDiv}
						class="hide-scroll relative max-h-[375px] space-y-2 overflow-y-scroll"
						on:scroll={() => {
							if (!loading && !hideArrow) {
								hideArrow = true;
							}
						}}
					>
						{#if merchantEvents && merchantEvents.length && !loading}
							{#each eventsPaginated as event}
								<MerchantEvent
									action={event.type}
									user={findUser(event)}
									time={event['created_at']}
									latest={event === merchantEvents[0] ? true : false}
								/>
							{/each}

							{#if eventsPaginated.length !== merchantEvents.length}
								<button
									class="mx-auto !mb-5 block text-xl font-semibold text-link transition-colors hover:text-hover"
									on:click={() => (eventCount = eventCount + 50)}>Load More</button
								>
							{:else if merchantEvents.length > 10}
								<TopButton scroll={activityDiv} style="!mb-5" />
							{/if}

							{#if !hideArrow && merchantEvents.length > 5}
								<svg
									class="absolute bottom-4 left-[calc(50%-8px)] z-20 h-4 w-4 animate-bounce text-primary dark:text-white"
									fill="currentColor"
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 512 512"
									><!--! Font Awesome Pro 6.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path
										d="M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z"
									/></svg
								>
							{/if}
						{:else}
							<p class="p-5 text-body dark:text-white">No activity to display.</p>
						{/if}
					</div>
				</div>
			</section>

			<section id="communities">
				<div class="w-full rounded-3xl border border-statBorder dark:bg-white/10">
					<h3
						class="border-b border-statBorder p-5 text-center text-lg font-semibold text-primary dark:text-white lg:text-left"
					>
						{name ? name : 'Merchant'} Communities
					</h3>
					<div
						class="hide-scroll flex max-h-[375px] flex-wrap items-center justify-center overflow-scroll p-1"
					>
						{#if filteredCommunities && filteredCommunities.length}
							{#each filteredCommunities as community}
								<div class="m-4 space-y-1 transition-transform hover:scale-110">
									<a href="/community/{community.id}">
										<img
											src={community.tags['icon:square']}
											alt="logo"
											class="mx-auto h-20 w-20 rounded-full object-cover"
											onerror="this.src='/images/communities/bitcoin.svg'"
										/>
										<p class="text-center font-semibold text-body dark:text-white">
											{community.tags.name}
										</p>
									</a>
								</div>
							{/each}
						{:else}
							<p class="p-5 text-body dark:text-white">
								This location is not part of a communtiy, but one can be <a
									href="/communities/add"
									class="text-link transition-colors hover:text-hover">created</a
								> to help maintain this local area.
							</p>
						{/if}
					</div>
				</div>
			</section>

			<p class="text-center text-sm text-body dark:text-white md:text-left">
				*More information on bitcoin mapping tags can be found <a
					href="https://github.com/teambtcmap/btcmap-data/wiki/Tagging-Instructions#tagging-guidance"
					target="_blank"
					rel="noreferrer"
					class="text-link transition-colors hover:text-hover">here</a
				>.
			</p>
		</main>

		<Footer />
	</div>
	<Boost />
	<ShowTags />
</div>

<style>
	@import 'leaflet/dist/leaflet.css';
	@import 'leaflet.locatecontrol/dist/L.Control.Locate.min.css';
	@import 'tippy.js/dist/tippy.css';
</style>
