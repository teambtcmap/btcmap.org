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
			map = leaflet.map(mapElement, { attributionControl: false }).setView([0, 0], 3);
			leaflet
				.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 })
				.addTo(map);

			// adds locate button to map
			L.control.locate().addTo(map);

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
					mapElement
						.requestFullscreen()
						.then(
							() =>
								(fullscreenButton.innerHTML =
									'<i class="w-[16px] h-[16px] fa-solid fa-compress"></i>')
						)
						.catch((err) => {
							alert(`Error attempting to enable fullscreen mode: ${err.message} (${err.name})`);
						});
				} else {
					document.exitFullscreen();
					fullscreenButton.innerHTML = '<i class="w-[16px] h-[16px] fa-solid fa-expand"></i>';
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
							} <br>`;
						} else if (element['addr:street'] && element['addr:city']) {
							return `${element['addr:street'] + ', ' + element['addr:city']} <br>`;
						} else if (element['addr:city']) {
							return `${element['addr:city']} <br>`;
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
							symbols = '<img src="/icons/btc.svg" alt="bitcoin" class="w-6 h-6 inline"/> ';
						}
						if (methods.includes('lightning')) {
							symbols =
								symbols + '<img src="/icons/ln.svg" alt="lightning" class="w-6 h-6 inline"/> ';
						}
						if (methods.includes('nfc')) {
							symbols = symbols + '<img src="/icons/nfc.svg" alt="nfc" class="w-6 h-6 inline"/>';
						}
						return symbols;
					};

					// add location information to popup
					response.data.elements.forEach((element) => {
						if (element.type == 'node') {
							let marker = L.marker([element.lat, element.lon]).bindPopup(
								`${element.tags.name ? `<strong>${element.tags.name}</strong>  <br>` : ''}
                ${checkAddress(element.tags)}
                <div class='space-y-1 mt-1'>
                ${
									element.tags.phone
										? `Tel: <a href='tel:${element.tags.phone}' class='text-link hover:text-hover'>${element.tags.phone}</a>`
										: ''
								}
                ${
									element.tags.website
										? `<a href=${element.tags.website} target="_blank" rel="noreferrer" class='block text-link hover:text-hover'>${element.tags.website}</a>`
										: ''
								}
                <a href='https://www.openstreetmap.org/edit?node=${
									element.id
								}' target="_blank" rel="noreferrer" class='block text-link hover:text-hover'>Edit</a>
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
