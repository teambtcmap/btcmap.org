export const attribution = (L, map) => {
	L.control.attribution({ position: 'bottomleft' }).addTo(map);

	const OSMAttribution = document.querySelector(
		'.leaflet-bottom.leaflet-left > .leaflet-control-attribution'
	);

	OSMAttribution.style.borderRadius = '0 8px 0 0';
	OSMAttribution.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';
	OSMAttribution.innerHTML =
		'&copy; <a href="http://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" class="text-link hover:text-hover !no-underline transition-colors">OpenStreetMap</a> contributors';
};

export const support = () => {
	const supportAttribution = document.querySelector(
		'.leaflet-bottom.leaflet-right > .leaflet-control-attribution'
	);

	supportAttribution.style.borderRadius = '8px 0 0 0';
	supportAttribution.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';
	supportAttribution.innerHTML =
		'<a href="/support-us" class="text-link hover:text-hover !no-underline transition-colors" title="Support with sats">Support</a> BTC Map';
};

export const scaleBars = (L, map) => {
	L.control.scale({ position: 'bottomleft' }).addTo(map);
	document.querySelector('.leaflet-control-scale').style.fontSize = '10px';
};

export const changeDefaultIcons = (layers) => {
	if (layers) {
		const layers = document.querySelector('.leaflet-control-layers');
		layers.style.border = 'none';
		layers.style.borderRadius = '8px';
		layers.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';
	}

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
};

export const fullscreenButton = (L, mapElement, map, DomEvent) => {
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
						errToast(`Error attempting to enable fullscreen mode: ${err.message} (${err.name})`);
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
	DomEvent.disableClickPropagation(document.querySelector('.leaflet-control-full-screen'));
};

export const geolocate = (L, map) => {
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
};

export const homeMarkerButtons = (L, map, DomEvent) => {
	const customControls = L.Control.extend({
		options: {
			position: 'topleft'
		},
		onAdd: () => {
			const addControlDiv = L.DomUtil.create('div');
			addControlDiv.style.border = 'none';
			addControlDiv.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';

			const addHomeButton = L.DomUtil.create('a');
			addControlDiv.classList.add('leaflet-control-site-links', 'leaflet-bar', 'leaflet-control');
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
	DomEvent.disableClickPropagation(document.querySelector('.leaflet-control-site-links'));
};

export const dataRefresh = (L, map, DomEvent) => {
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
	DomEvent.disableClickPropagation(document.querySelector('.leaflet-control-data-refresh'));
};

export const calcVerifiedDate = () => {
	let verifiedDate = new Date();
	const previousYear = verifiedDate.getFullYear() - 1;
	return verifiedDate.setFullYear(previousYear);
};

export const checkAddress = (element) => {
	if (element['addr:housenumber'] && element['addr:street'] && element['addr:city']) {
		return `${
			element['addr:housenumber'] + ' ' + element['addr:street'] + ', ' + element['addr:city']
		}`;
	} else if (element['addr:street'] && element['addr:city']) {
		return `${element['addr:street'] + ', ' + element['addr:city']}`;
	} else if (element['addr:city']) {
		return `${element['addr:city']}`;
	} else {
		return '';
	}
};

export const latCalc = (element) => {
	return element.type == 'node' ? element.lat : (element.bounds.minlat + element.bounds.maxlat) / 2;
};

export const longCalc = (element) => {
	return element.type == 'node' ? element.lon : (element.bounds.minlon + element.bounds.maxlon) / 2;
};

export const generateIcon = (L, icon) => {
	return L.divIcon({
		className: 'div-icon',
		iconSize: [32, 43],
		iconAnchor: [16, 43],
		popupAnchor: [0, -43],
		html: `<svg width='20px' height='20px' class='mx-auto mt-[5.75px] text-white'>
			     	<use width='20px' height='20px' href="/icons/material/spritesheet.svg#${
							icon !== 'question_mark' ? icon : 'currency_bitcoin'
						}">
						</use>
			     </svg>`
	});
};

export const generateMarker = (lat, long, icon, element, L, verifiedDate, verify) => {
	return L.marker([lat, long], { icon }).bindPopup(
		// marker popup component
		`${
			element.tags && element.tags.name
				? `<span class='block font-bold text-lg text-primary break-all leading-snug' title='Merchant name'>${element.tags.name}</span>`
				: ''
		}

					<span class='block text-body font-bold' title='Address'>${
						element.tags && checkAddress(element.tags)
					}</span>

			${
				element.tags && element.tags['opening_hours']
					? `<div class='my-1 w-full flex items-center space-x-1' title='Opening hours'>
		  				<svg width='16px' height='16px' class='text-mapHighlight'>
	  						<use width='16px' height='16px' href="/icons/font-awesome/spritesheet.svg#clock-solid"></use>
				 	 		</svg>
			     		<span class='text-body'>${element.tags['opening_hours']}</span>
	  			 	 </div>`
					: ''
			}

					<div class='flex space-x-2 my-1'>
						${
							element.tags && element.tags.phone
								? `<a href='tel:${element.tags.phone}' title='Phone'><span class="bg-link hover:bg-hover rounded-full p-2 w-5 h-5 text-white fa-solid fa-phone transition-colors" /></a>`
								: ''
						}

						${
							element.tags && element.tags.website
								? `<a href=${
										element.tags.website.startsWith('http')
											? element.tags.website
											: `https://${element.tags.website}`
								  } target="_blank" rel="noreferrer" title='Website'><span class="bg-link hover:bg-hover rounded-full p-2 w-5 h-5 text-white fa-solid fa-globe transition-colors" /></a>`
								: ''
						}

						${
							element.tags && element.tags['contact:twitter']
								? `<a href=${
										element.tags['contact:twitter'].startsWith('http')
											? element.tags['contact:twitter']
											: `https://twitter.com/${element.tags['contact:twitter']}`
								  } target="_blank" rel="noreferrer" title='Twitter'><span class="bg-link hover:bg-hover rounded-full p-2 w-5 h-5 text-white fa-brands fa-twitter transition-colors" /></a>`
								: ''
						}

						<a href='geo:${lat},${long}' title='Navigate'><span class="bg-link hover:bg-hover rounded-full p-2 w-5 h-5 text-white fa-solid fa-compass transition-colors" /></a>

						<a href='https://www.openstreetmap.org/edit?${element.type}=${
			element.id
		}' target="_blank" rel="noreferrer" title='Edit'><span class="bg-link hover:bg-hover rounded-full p-2 w-5 h-5 text-white fa-solid fa-pen-to-square transition-colors" /></a>

						<a href='/map?lat=${lat}&long=${long}' target="_blank" rel="noreferrer" title='Share'><span class="bg-link hover:bg-hover rounded-full p-2 w-5 h-5 text-white fa-solid fa-share-nodes transition-colors" /></a>
					</div>

					<div class='w-full flex space-x-2 my-1'>
						<img src=${
							element.tags && element.tags['payment:onchain'] === 'yes'
								? '/icons/btc-highlight.svg'
								: element.tags && element.tags['payment:onchain'] === 'no'
								? '/icons/btc-no.svg'
								: '/icons/btc.svg'
						} alt="bitcoin" class="w-7 h-7" title="${
			element.tags && element.tags['payment:onchain'] === 'yes'
				? 'On-chain accepted'
				: element.tags && element.tags['payment:onchain'] === 'no'
				? 'On-chain not accepted'
				: 'On-chain unknown'
		}"/>

						<img src=${
							element.tags && element.tags['payment:lightning'] === 'yes'
								? '/icons/ln-highlight.svg'
								: element.tags && element.tags['payment:lightning'] === 'no'
								? '/icons/ln-no.svg'
								: '/icons/ln.svg'
						} alt="lightning" class="w-7 h-7" title="${
			element.tags && element.tags['payment:lightning'] === 'yes'
				? 'Lightning accepted'
				: element.tags && element.tags['payment:lightning'] === 'no'
				? 'Lightning not accepted'
				: 'Lightning unknown'
		}"/>

						<img src=${
							element.tags && element.tags['payment:lightning_contactless'] === 'yes'
								? '/icons/nfc-highlight.svg'
								: element.tags && element.tags['payment:lightning_contactless'] === 'no'
								? '/icons/nfc-no.svg'
								: '/icons/nfc.svg'
						} alt="nfc" class="w-7 h-7" title="${
			element.tags && element.tags['payment:lightning_contactless'] === 'yes'
				? 'Lightning Contactless accepted'
				: element.tags && element.tags['payment:lightning_contactless'] === 'no'
				? 'Lightning contactless not accepted'
				: 'Lightning Contactless unknown'
		}"/>
					</div>

					<span class='text-body my-1' title="Completed by BTC Map community members">Survey date:
					${
						element.tags && (element.tags['survey:date'] || element.tags['check_date'])
							? `${
									element.tags['survey:date']
										? element.tags['survey:date']
										: element.tags['check_date']
							  } ${
									Date.parse(
										element.tags['survey:date']
											? element.tags['survey:date']
											: element.tags['check_date']
									) > verifiedDate
										? '<img src="/icons/verified.svg" alt="verified" class="inline w-5 h-5" title="Verified within the last year"/>'
										: ''
							  }`
							: '<span class="fa-solid fa-question" title="Not verified"></span>'
					}
					</span>

					<div class='flex ${verify ? 'justify-between' : 'justify-end'} items-center'>
					${
						verify
							? `<a href="/verify-location?${
									element.tags && element.tags.name ? `&name=${element.tags.name}` : ''
							  }&lat=${lat}&long=${long}&${element.type}=${
									element.id
							  }" class='text-link hover:text-hover text-xs transition-colors' title="Help improve the data for everyone">Verify location</a>`
							: ''
					}

						<a
							href="https://github.com/teambtcmap/btcmap-data/wiki/Map-Legend"
							target="_blank"
							rel="noreferrer"
							title="Map legend">
							<span class="fa-solid fa-circle-info text-sm text-link hover:text-hover transition-colors"></span>
						</a>
					</div>`,
		{ closeButton: false }
	);
};
