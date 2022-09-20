<script>
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';

	let mapElement;
	let map;

	// allows for users to set initial view in a URL query
	const urlLat = $page.url.searchParams.getAll('lat');
	const urlLong = $page.url.searchParams.getAll('long');

	onMount(async () => {
		if (browser) {
			//import packages
			const leaflet = await import('leaflet');
			const leafletLocateControl = await import('leaflet.locatecontrol');
			const leafletMarkerCluster = await import('leaflet.markercluster');
			const axios = await import('axios');

			// add map and tiles
			map = leaflet.map(mapElement).setView([0, 0], 3);

			// set URL lat/long query view if it exists and is valid
			if (urlLat && urlLong) {
				try {
					if (urlLat.length > 1 && urlLong.length > 1)
						map.fitBounds([
							[urlLat[0], urlLong[0]],
							[urlLat[1], urlLong[1]]
						]);
					else {
						map.fitBounds([[urlLat[0], urlLong[0]]]);
					}
				} catch (error) {
					console.log(error);
				}
			}

			// add click event to help devs find lat/long of desired location for iframe embeds
			map.on('click', () => {
				console.log(map.getBounds());
			});

			leaflet
				.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
					noWrap: true,
					maxZoom: 19,
					minZoom: 1
				})
				.addTo(map);

			// change broken marker image path in prod
			L.Icon.Default.prototype.options.imagePath = '/icons/';

			// adds locate button to map
			L.control.locate().addTo(map);

			// add support attribution
			document.querySelector('.leaflet-control-attribution').innerHTML =
				'Support BTC Map <a href="bitcoin:bc1qng60mcufjnmz6330gze5yt4m6enzra7lywns2d" class="text-link hover:text-hover"><span class="fa-brands fa-bitcoin"/></a> | <a href="lightning:btcmap@zbd.gg" class="text-link hover:text-hover"><span class="fa-solid fa-bolt"/></a>';

			// adds fullscreen button to map
			const fullscreenButton = document.createElement('a');
			fullscreenButton.classList.add('leaflet-control-full-screen');
			fullscreenButton.href = '#';
			fullscreenButton.title = 'Full screen';
			fullscreenButton.role = 'button';
			fullscreenButton.ariaLabel = 'Full screen';
			fullscreenButton.ariaDisabled = 'Full screen';
			fullscreenButton.innerHTML = '<i class="w-[16px] h-[16px] fa-solid fa-expand"></i>';
			fullscreenButton.onclick = function toggleFullscreen() {
				if (!document.fullscreenElement) {
					mapElement.requestFullscreen().catch((err) => {
						alert(`Error attempting to enable fullscreen mode: ${err.message} (${err.name})`);
					});
				} else {
					document.exitFullscreen();
				}
			};
			document.querySelector('.leaflet-control-zoom').append(fullscreenButton);

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

					// add location information to popup
					response.data.elements.forEach((element) => {
						if (element.type == 'node') {
							let marker = L.marker([element.lat, element.lon]).bindPopup(
								// marker popup component
								`${
									element.tags.name
										? `<span class='block font-bold text-lg text-primary'>${element.tags.name}</span>`
										: ''
								}

                <span class='block text-body'>${checkAddress(element.tags)}</span>

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

                  <a href='https://www.openstreetmap.org/edit?node=${
										element.id
									}' target="_blank" rel="noreferrer" title='Edit'><span class="bg-link hover:bg-hover rounded-full p-2 w-5 h-5 text-white fa-solid fa-pen-to-square" /></a>

                  <a href='https://btcmap.org/map?lat=${element.lat}&long=${
									element.lon
								}' target="_blank" rel="noreferrer" title='Share'><span class="bg-link hover:bg-hover rounded-full p-2 w-5 h-5 text-white fa-solid fa-share-nodes" /></a>
                </div>

                <div class='w-full flex space-x-2'>
                  <img src=${
										element.tags['payment:onchain'] === 'yes'
											? '/icons/btc-highlight.svg'
											: '/icons/btc.svg'
									} alt="bitcoin" class="w-6 h-6 ${
									element.tags['payment:onchain'] === 'yes' ? 'opacity-100' : 'opacity-75'
								}" title="On-chain"/>

                  <img src=${
										element.tags['payment:lightning'] === 'yes'
											? '/icons/ln-highlight.svg'
											: '/icons/ln.svg'
									} alt="lightning" class="w-6 h-6 ${
									element.tags['payment:lightning'] === 'yes' ? 'opacity-100' : 'opacity-75'
								}" title="Lightning"/>

                  <img src=${
										element.tags['payment:lightning_contactless'] === 'yes'
											? '/icons/nfc-highlight.svg'
											: '/icons/nfc.svg'
									} alt="nfc" class="w-6 h-6 ${
									element.tags['payment:lightning_contactless'] === 'yes'
										? 'opacity-100'
										: 'opacity-75'
								}" title="NFC"/>
                </div>`
							);

							markers.addLayer(marker);
						}
					});

					map.addLayer(markers);
				})
				.catch(function (error) {
					// handle error
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
</script>

<main>
	<div bind:this={mapElement} class="h-[100vh]" />
</main>

<style>
	@import 'leaflet/dist/leaflet.css';
	@import 'leaflet.locatecontrol/dist/L.Control.Locate.min.css';
	@import 'leaflet.markercluster/dist/MarkerCluster.css';
	@import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
</style>
