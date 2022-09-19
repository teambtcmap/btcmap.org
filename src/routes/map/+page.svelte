<script>
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	let mapElement;
	let map;

	onMount(async () => {
		if (browser) {
			//import packages
			const leaflet = await import('leaflet');
			const leafletLocateControl = await import('leaflet.locatecontrol');
			const leafletMarkerCluster = await import('leaflet.markercluster');
			const axios = await import('axios');

			// add map and tiles
			map = leaflet.map(mapElement).setView([0, 0], 3);
			leaflet
				.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 })
				.addTo(map);

			// change broken marker image path in prod
			L.Icon.Default.prototype.options.imagePath = '/icons/';

			// adds locate button to map
			L.control.locate().addTo(map);

			// add support attribution
			document.querySelector('.leaflet-control-attribution').innerHTML =
				'<a href="bitcoin:bc1qng60mcufjnmz6330gze5yt4m6enzra7lywns2d" class="text-link hover:text-hover">Support</a> BTC Map';

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

					// check payment methods
					const checkPaymentMethods = (element) => {
						let methods = [];
						let symbols = '';
						if (
							element['payment:bitcoin'] === 'yes' ||
							element['payment:onchain'] === 'yes' ||
							element['currency:BTC'] === 'yes' ||
							element['currency:XBT'] === 'yes'
						) {
							methods.push('onchain');
						}
						if (element['payment:lightning'] === 'yes') {
							methods.push('lightning');
						}
						if (element['payment:lightning_contactless'] === 'yes') {
							methods.push('nfc');
						}
						if (methods.includes('onchain')) {
							symbols =
								'<img src="/icons/btc.svg" alt="bitcoin" class="w-6 h-6" title="On-chain"/>';
						}
						if (methods.includes('lightning')) {
							symbols =
								symbols +
								'<img src="/icons/ln.svg" alt="lightning" class="w-6 h-6" title="Lightning"/>';
						}
						if (methods.includes('nfc')) {
							symbols =
								symbols + '<img src="/icons/nfc.svg" alt="nfc" class="w-6 h-6" title="NFC"/>';
						}
						return symbols;
					};

					// add location information to popup
					response.data.elements.forEach((element) => {
						if (element.type == 'node') {
							let marker = L.marker([element.lat, element.lon]).bindPopup(
								`${
									element.tags.name
										? `<span class='block font-bold text-lg text-primary'>${element.tags.name}</span>`
										: ''
								}
                <span class='block text-body'>${checkAddress(element.tags)}</span>
                <div class='w-full flex space-x-2 my-1'>
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
                </div>
                <div class='w-full flex space-x-2'>
                  ${checkPaymentMethods(element.tags)}
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
