<script>
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { elements, mapUpdates, elementError } from '$lib/store';
	import { checkAddress } from '$lib/map/setup';
	import { errToast } from '$lib/utils';
	import { MapLoading } from '$comp';

	let mapElement;
	let map;
	let mapLoaded;

	// allows for users to set initial view in a URL query
	const urlLat = $page.url.searchParams.getAll('lat');
	const urlLong = $page.url.searchParams.getAll('long');

	// alow for users to query by payment method with URL search params
	const onchain = $page.url.searchParams.has('onchain');
	const lightning = $page.url.searchParams.has('lightning');
	const nfc = $page.url.searchParams.has('nfc');

	// displays a button in controls if there is new data available
	const showDataRefresh = () => {
		document.querySelector('.data-refresh-div').style.display = 'block';
	};

	$: map && mapLoaded && $mapUpdates && showDataRefresh();

	// alert for map errors
	$: $elementError && errToast($elementError);

	onMount(async () => {
		if (browser) {
			//import packages
			const leaflet = await import('leaflet');
			const leafletLocateControl = await import('leaflet.locatecontrol');
			const leafletMarkerCluster = await import('leaflet.markercluster');

			// add map and tiles
			map = leaflet.map(mapElement).setView([0, 0], 3);

			const osm = leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				noWrap: true,
				maxZoom: 19
			});

			const osmDE = leaflet.tileLayer('https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png', {
				noWrap: true,
				maxZoom: 18
			});

			const osmFR = leaflet.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
				noWrap: true,
				maxZoom: 20
			});
			const topo = leaflet.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
				noWrap: true,
				maxZoom: 17
			});

			const imagery = leaflet.tileLayer(
				'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
				{
					noWrap: true
				}
			);

			const toner = leaflet.tileLayer(
				'https://stamen-tiles-{s}.a.ssl.fastly.net/toner/{z}/{x}/{y}{r}.{ext}',
				{
					noWrap: true,
					maxZoom: 20,
					ext: 'png'
				}
			);

			const tonerLite = leaflet.tileLayer(
				'https://stamen-tiles-{s}.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}{r}.{ext}',
				{
					noWrap: true,
					maxZoom: 20,
					ext: 'png'
				}
			);

			const watercolor = leaflet.tileLayer(
				'https://stamen-tiles-{s}.a.ssl.fastly.net/watercolor/{z}/{x}/{y}.{ext}',
				{
					noWrap: true,
					maxZoom: 16,
					ext: 'jpg'
				}
			);

			const terrain = leaflet.tileLayer(
				'https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}{r}.{ext}',
				{
					noWrap: true,
					maxZoom: 18,
					ext: 'png'
				}
			);

			const baseMaps = {
				OpenStreetMap: osm,
				Imagery: imagery,
				Terrain: terrain,
				Topo: topo,
				Toner: toner,
				'Toner Lite': tonerLite,
				Watercolor: watercolor,
				OpenStreetMapDE: osmDE,
				OpenStreetMapFR: osmFR
			};

			const layerControl = L.control.layers(baseMaps).addTo(map);

			osm.addTo(map);

			// set URL lat/long query view if it exists and is valid
			if (urlLat.length && urlLong.length) {
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
				const coords = map.getBounds();
				console.log(`Here is your iframe embed URL: https://btcmap.org/map?lat=${coords._northEast.lat}&long=${coords._northEast.lng}&lat=${coords._southWest.lat}&long=${coords._southWest.lng}
Thanks for using BTC Map!`);
			});

			// change broken marker image path in prod
			L.Icon.Default.prototype.options.imagePath = '/icons/';

			// add support attribution
			document.querySelector(
				'.leaflet-bottom.leaflet-right > .leaflet-control-attribution'
			).innerHTML =
				'<a href="/support-us" class="text-link hover:text-hover" title="Support with sats">Support</a> BTC Map';

			// add OSM attribution
			L.control.attribution({ position: 'bottomleft' }).addTo(map);
			document.querySelector(
				'.leaflet-bottom.leaflet-left > .leaflet-control-attribution'
			).innerHTML =
				'&copy; <a href="http://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

			// add scale
			L.control.scale({ position: 'bottomleft' }).addTo(map);
			document.querySelector('.leaflet-control-scale').style.fontSize = '10px';

			// change default icons
			const layers = document.querySelector('.leaflet-control-layers');
			layers.style.border = 'none';
			layers.style.borderRadius = '8px';
			layers.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';

			const supportAttribution = document.querySelector(
				'.leaflet-bottom.leaflet-right > .leaflet-control-attribution'
			);
			supportAttribution.style.borderRadius = '8px 0 0 0';
			supportAttribution.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';

			const OSMAttribution = document.querySelector(
				'.leaflet-bottom.leaflet-left > .leaflet-control-attribution'
			);
			OSMAttribution.style.borderRadius = '0 8px 0 0';
			OSMAttribution.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';

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

			// add fullscreen button to map
			const customFullScreenButton = L.Control.extend({
				options: {
					position: 'topleft'
				},
				onAdd: () => {
					const fullscreenDiv = L.DomUtil.create('div');
					fullscreenDiv.classList.add('leaflet-bar');
					fullscreenDiv.style.border = 'none';
					fullscreenDiv.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';

					const fullscreenButton = L.DomUtil.create('a');
					fullscreenButton.classList.add('leaflet-control-full-screen');
					fullscreenButton.href = '#';
					fullscreenButton.title = 'Full screen';
					fullscreenButton.role = 'button';
					fullscreenButton.ariaLabel = 'Full screen';
					fullscreenButton.ariaDisabled = 'false';
					fullscreenButton.innerHTML = `<img src='/icons/expand.svg' alt='fullscreen' class='inline' id='fullscreen'/>`;
					fullscreenButton.style.borderRadius = '8px';
					fullscreenButton.onclick = function toggleFullscreen() {
						if (!document.fullscreenElement) {
							mapElement.requestFullscreen().catch((err) => {
								errToast(
									`Error attempting to enable fullscreen mode: ${err.message} (${err.name})`
								);
							});
						} else {
							document.exitFullscreen();
						}
					};
					fullscreenButton.onmouseenter = () => {
						document.querySelector('#fullscreen').src = '/icons/expand-black.svg';
					};
					fullscreenButton.onmouseleave = () => {
						document.querySelector('#fullscreen').src = '/icons/expand.svg';
					};

					fullscreenDiv.append(fullscreenButton);

					return fullscreenDiv;
				}
			});

			map.addControl(new customFullScreenButton());

			// add locate button to map
			L.control.locate({ position: 'topleft' }).addTo(map);

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

			// add home and marker buttons to map
			const customControls = L.Control.extend({
				options: {
					position: 'topleft'
				},
				onAdd: () => {
					const addControlDiv = L.DomUtil.create('div');
					addControlDiv.style.border = 'none';
					addControlDiv.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';

					const addHomeButton = L.DomUtil.create('a');
					addControlDiv.classList.add(
						'leaflet-control-site-links',
						'leaflet-bar',
						'leaflet-control'
					);
					addHomeButton.classList.add('leaflet-bar-part');
					addHomeButton.href = '/';
					addHomeButton.title = 'Go to home page';
					addHomeButton.role = 'button';
					addHomeButton.ariaLabel = 'Go to home page';
					addHomeButton.ariaDisabled = 'false';
					addHomeButton.innerHTML = `<img src='/icons/home.svg' alt='home' class='inline' id='homebutton'/>`;
					addHomeButton.style.borderRadius = '8px 8px 0 0';
					addHomeButton.onmouseenter = () => {
						document.querySelector('#homebutton').src = '/icons/home-black.svg';
					};
					addHomeButton.onmouseleave = () => {
						document.querySelector('#homebutton').src = '/icons/home.svg';
					};

					addControlDiv.append(addHomeButton);

					const addLocationButton = L.DomUtil.create('a');
					addLocationButton.classList.add('leaflet-bar-part');
					addLocationButton.href = '/add-location';
					addLocationButton.title = 'Add location';
					addLocationButton.role = 'button';
					addLocationButton.ariaLabel = 'Add location';
					addLocationButton.ariaDisabled = 'false';
					addLocationButton.innerHTML = `<img src='/icons/marker.svg' alt='marker' class='inline' id='marker'/>`;
					addLocationButton.style.borderRadius = '0 0 8px 8px';
					addLocationButton.onmouseenter = () => {
						document.querySelector('#marker').src = '/icons/marker-black.svg';
					};
					addLocationButton.onmouseleave = () => {
						document.querySelector('#marker').src = '/icons/marker.svg';
					};

					addControlDiv.append(addLocationButton);

					return addControlDiv;
				}
			});

			map.addControl(new customControls());

			// add data refresh button to map
			const customDataRefreshButton = L.Control.extend({
				options: {
					position: 'topleft'
				},
				onAdd: () => {
					const dataRefreshDiv = L.DomUtil.create('div');
					dataRefreshDiv.classList.add('leaflet-bar', 'leafet-control', 'data-refresh-div');
					dataRefreshDiv.style.border = 'none';
					dataRefreshDiv.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';
					dataRefreshDiv.style.display = 'none';

					const dataRefreshButton = L.DomUtil.create('a');
					dataRefreshButton.classList.add('leaflet-control-data-refresh');
					dataRefreshButton.href = '#';
					dataRefreshButton.title = 'Data refresh available';
					dataRefreshButton.role = 'button';
					dataRefreshButton.ariaLabel = 'Data refresh available';
					dataRefreshButton.ariaDisabled = 'false';
					dataRefreshButton.innerHTML = `<img src='/icons/refresh.svg' alt='refresh' class='inline' id='refresh'/>`;
					dataRefreshButton.style.borderRadius = '8px';
					dataRefreshButton.onclick = () => {
						location.reload();
					};
					dataRefreshButton.onmouseenter = () => {
						document.querySelector('#refresh').src = '/icons/refresh-black.svg';
					};
					dataRefreshButton.onmouseleave = () => {
						document.querySelector('#refresh').src = '/icons/refresh.svg';
					};

					dataRefreshDiv.append(dataRefreshButton);

					return dataRefreshDiv;
				}
			});

			map.addControl(new customDataRefreshButton());

			// create marker cluster group
			let markers = L.markerClusterGroup();

			// add location information
			$elements.forEach((element) => {
				if (element['deleted_at']) {
					return;
				}
				element = element['osm_json'];
				if (
					(onchain ? element.tags['payment:onchain'] === 'yes' : true) &&
					(lightning ? element.tags['payment:lightning'] === 'yes' : true) &&
					(nfc ? element.tags['payment:lightning_contactless'] === 'yes' : true)
				) {
					const latCalc =
						element.type == 'node'
							? element.lat
							: (element.bounds.minlat + element.bounds.maxlat) / 2;
					const longCalc =
						element.type == 'node'
							? element.lon
							: (element.bounds.minlon + element.bounds.maxlon) / 2;

					let marker = L.marker([latCalc, longCalc]).bindPopup(
						// marker popup component
						`${
							element.tags.name
								? `<span class='block font-bold text-lg text-primary break-all leading-snug' title='Merchant name'>${element.tags.name}</span>`
								: ''
						}

                <span class='block text-body font-bold' title='Address'>${checkAddress(
									element.tags
								)}</span>

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

                  <a href='https://www.openstreetmap.org/edit?${element.type}=${
							element.id
						}' target="_blank" rel="noreferrer" title='Edit'><span class="bg-link hover:bg-hover rounded-full p-2 w-5 h-5 text-white fa-solid fa-pen-to-square" /></a>

                  <a href='https://btcmap.org/map?lat=${latCalc}&long=${longCalc}' target="_blank" rel="noreferrer" title='Share'><span class="bg-link hover:bg-hover rounded-full p-2 w-5 h-5 text-white fa-solid fa-share-nodes" /></a>
                </div>

                <div class='w-full flex space-x-2 my-1'>
                  <img src=${
										element.tags['payment:onchain'] === 'yes'
											? '/icons/btc-highlight.svg'
											: element.tags['payment:onchain'] === 'no'
											? '/icons/btc-no.svg'
											: '/icons/btc.svg'
									} alt="bitcoin" class="w-7 h-7" title="${
							element.tags['payment:onchain'] === 'yes'
								? 'On-chain accepted'
								: element.tags['payment:onchain'] === 'no'
								? 'On-chain not accepted'
								: 'On-chain unknown'
						}"/>

                  <img src=${
										element.tags['payment:lightning'] === 'yes'
											? '/icons/ln-highlight.svg'
											: element.tags['payment:lightning'] === 'no'
											? '/icons/ln-no.svg'
											: '/icons/ln.svg'
									} alt="lightning" class="w-7 h-7" title="${
							element.tags['payment:lightning'] === 'yes'
								? 'Lightning accepted'
								: element.tags['payment:lightning'] === 'no'
								? 'Lightning not accepted'
								: 'Lightning unknown'
						}"/>

                  <img src=${
										element.tags['payment:lightning_contactless'] === 'yes'
											? '/icons/nfc-highlight.svg'
											: element.tags['payment:lightning_contactless'] === 'no'
											? '/icons/nfc-no.svg'
											: '/icons/nfc.svg'
									} alt="nfc" class="w-7 h-7" title="${
							element.tags['payment:lightning_contactless'] === 'yes'
								? 'Lightning Contactless accepted'
								: element.tags['payment:lightning_contactless'] === 'no'
								? 'Lightning contactless not accepted'
								: 'Lightning Contactless unknown'
						}"/>
                </div>

								<span class='text-body my-1' title="Surveys are completed by BTC Map community members">Survey date:
								${
									element.tags['survey:date']
										? `${element.tags['survey:date']}`
										: '<span class="fa-solid fa-question"></span>'
								}
								</span>

								<div class='flex justify-between items-center'>
									<a href="/report-outdated-info?${
										element.tags.name ? `&name=${element.tags.name}` : ''
									}&lat=${latCalc}&long=${longCalc}&${element.type}=${
							element.id
						}" class='text-link hover:text-hover text-xs' title="Reporting helps improve the data for everyone">Report outdated info</a>

									<a
										href="https://github.com/teambtcmap/btcmap-data/wiki/Map-Legend"
										target="_blank"
										rel="noreferrer"
										title="Map legend">
										<span class="fa-solid fa-circle-info text-sm text-link hover:text-hover"></span>
									</a>
								</div>`,
						{ closeButton: false }
					);

					markers.addLayer(marker);
				}
			});

			map.addLayer(markers);
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
	<title>BTC Map</title>
	<meta property="og:image" content="https://btcmap.org/images/og/map.png" />
	<meta property="twitter:title" content="BTC Map" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/map.png" />
</svelte:head>

<main>
	{#if !mapLoaded}
		<MapLoading message="Rendering map..." style="absolute top-0 left-0 z-[10000]" />
	{/if}
	<div bind:this={mapElement} class="h-[100vh]" />
</main>

<style>
	@import 'leaflet/dist/leaflet.css';
	@import 'leaflet.locatecontrol/dist/L.Control.Locate.min.css';
	@import 'leaflet.markercluster/dist/MarkerCluster.css';
	@import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
</style>
