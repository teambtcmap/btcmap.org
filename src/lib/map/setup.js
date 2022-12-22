import Time from 'svelte-time';
import axios from 'axios';
import { boost, exchangeRate, resetBoost, showTags } from '$lib/store';
import { errToast } from '$lib/utils';

export const attribution = (L, map) => {
	L.control.attribution({ position: 'bottomleft' }).addTo(map);

	const OSMAttribution = document.querySelector(
		'.leaflet-bottom.leaflet-left > .leaflet-control-attribution'
	);

	OSMAttribution.style.borderRadius = '0 8px 0 0';
	OSMAttribution.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';
	OSMAttribution.innerHTML =
		'&copy; <a href="http://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" class="!text-link hover:!text-hover !no-underline transition-colors">OpenStreetMap</a> contributors';
};

export const support = () => {
	const supportAttribution = document.querySelector(
		'.leaflet-bottom.leaflet-right > .leaflet-control-attribution'
	);

	supportAttribution.style.borderRadius = '8px 0 0 0';
	supportAttribution.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';
	supportAttribution.innerHTML =
		'<a href="/support-us" class="!text-link hover:!text-hover !no-underline transition-colors" title="Support with sats">Support</a> BTC Map';
};

export const scaleBars = (L, map) => {
	L.control.scale({ position: 'bottomleft' }).addTo(map);
};

export const changeDefaultIcons = (layers, L, mapElement, DomEvent) => {
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
	zoomOut.innerHTML = `<img src='/icons/minus.svg' alt='zoomout' class='inline' id='zoomout'/>`;
	zoomOut.onmouseenter = () => {
		document.querySelector('#zoomout').src = '/icons/minus-black.svg';
	};
	zoomOut.onmouseleave = () => {
		document.querySelector('#zoomout').src = '/icons/minus.svg';
	};

	const fullscreenButton = L.DomUtil.create('a');
	fullscreenButton.classList.add('leaflet-control-full-screen');
	fullscreenButton.href = '#';
	fullscreenButton.title = 'Full screen';
	fullscreenButton.role = 'button';
	fullscreenButton.ariaLabel = 'Full screen';
	fullscreenButton.ariaDisabled = 'false';
	fullscreenButton.innerHTML = `<img src='/icons/expand.svg' alt='fullscreen' class='inline' id='fullscreen'/>`;
	fullscreenButton.style.borderRadius = '0 0 8px 8px';
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

	leafletBar.append(fullscreenButton);

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

export const generateIcon = (L, icon, boosted, campsite) => {
	return L.divIcon({
		className: boosted ? 'boosted-icon' : 'div-icon',
		iconSize: [32, 43],
		iconAnchor: [16, 43],
		popupAnchor: [0, -43],
		html: `<svg width='20px' height='20px' class='${
			boosted ? 'animate-wiggle' : ''
		} mx-auto mt-[5.75px] text-white'>
			     	<use width='20px' height='20px' href="/icons/material/spritesheet.svg#${
							campsite ? 'camping' : icon !== 'question_mark' ? icon : 'currency_bitcoin'
						}">
						</use>
			     </svg>`
	});
};

export const generateMarker = (
	lat,
	long,
	icon,
	element,
	payment,
	L,
	verifiedDate,
	verify,
	boosted
) => {
	let verified = [];

	if (element.tags) {
		if (element.tags['survey:date']) {
			verified.push(element.tags['survey:date']);
		}

		if (element.tags['check_date']) {
			verified.push(element.tags['check_date']);
		}

		if (element.tags['check_date:currency:XBT']) {
			verified.push(element.tags['check_date:currency:XBT']);
		}

		if (verified.length > 1) {
			verified.sort((a, b) => Date.parse(b) - Date.parse(a));
		}
	}

	const paymentMethod =
		element.tags &&
		(element.tags['payment:onchain'] ||
			element.tags['payment:lightning'] ||
			element.tags['payment:lightning_contactless']);

	const popupContainer = L.DomUtil.create('div');

	popupContainer.innerHTML = `${
		element.tags && element.tags.name
			? `<span class='block font-bold text-lg text-primary leading-snug max-w-[300px]' title='Merchant name'>${element.tags.name}</span>`
			: ''
	}

				 <span class='block text-body max-w-[300px]' title='Address'>${
						element.tags && checkAddress(element.tags)
					}</span>

			${
				element.tags && element.tags['opening_hours']
					? `<div class='my-1 w-full max-w-[300px]' title='Opening hours'>
		  				<svg width='16px' height='16px' class='inline'>
	  						<use width='16px' height='16px' href="/icons/popup/spritesheet.svg#clock"></use>
				 	 		</svg>
			     		<span class='text-body'>${element.tags['opening_hours']}</span>
	  			 	 </div>`
					: ''
			}

					<div class='flex space-x-2 mt-2.5 mb-1'>
						<a id='navigate' href='geo:${lat},${long}' title='Navigate' class='border border-mapBorder hover:border-link !text-primary hover:!text-link rounded-lg py-1 w-full transition-colors'>
							<svg width='24px' height='24px' class='mx-auto'>
								<use width='24px' height='24px' href="/icons/popup/spritesheet.svg#compass"></use>
							</svg>
							<span class='block text-xs text-center mt-1'>Navigate</span>
						</a>

						<a id='edit' href='https://www.openstreetmap.org/edit?${element.type}=${
		element.id
	}' target="_blank" rel="noreferrer" title='Edit' class='border border-mapBorder hover:border-link !text-primary hover:!text-link rounded-lg py-1 w-full transition-colors'>
							<svg width='24px' height='24px' class='mx-auto'>
								<use width='24px' height='24px' href="/icons/popup/spritesheet.svg#pencil"></use>
							</svg>
							<span class='block text-xs text-center mt-1'>Edit</span>
						</a>

						<a id='share' href='/map?lat=${lat}&long=${long}' target="_blank" rel="noreferrer" title='Share' class='border border-mapBorder hover:border-link !text-primary hover:!text-link rounded-lg py-1 w-full transition-colors'>
							<svg width='24px' height='24px' class='mx-auto'>
								<use width='24px' height='24px' href="/icons/popup/spritesheet.svg#share"></use>
							</svg>
							<span class='block text-xs text-center mt-1'>Share</span>
						</a>

						<div class='relative w-full'>
							<button id='more-button' title='More' class='border border-mapBorder hover:border-link !text-primary hover:!text-link rounded-lg py-1 w-full transition-colors'>
								<svg width='24px' height='24px' class='mx-auto'>
									<use width='24px' height='24px' href="/icons/popup/spritesheet.svg#dots-horizontal"></use>
								</svg>
								<span class='block text-xs text-center mt-1'>More</span>
							</button>

							<div id='show-more' class='hidden z-[500] w-[147px] border border-mapBorder p-4 absolute top-[55px] right-0 bg-white rounded-xl shadow-xl space-y-3'>
							${
								payment
									? `<a href="${
											payment.type === 'uri'
												? payment.url
												: payment.type === 'pouch'
												? `https://app.pouch.ph/${payment.username}`
												: payment.type === 'coinos'
												? `https://coinos.io/${payment.username}`
												: '#'
									  }" target="_blank" rel="noreferrer" title='Pay merchant' class='flex items-center !text-primary hover:!text-link text-xs transition-colors'>
											<svg width='24px' height='24px' class='mr-2'>
												<use width='24px' height='24px' href="/icons/popup/spritesheet.svg#bolt"></use>
											</svg>
											Pay Merchant
										</a>`
									: ''
							}

							${
								element.tags && element.tags.phone
									? `<a href='tel:${element.tags.phone}' title='Call' class='flex items-center !text-primary hover:!text-link text-xs  transition-colors'>
											<svg width='24px' height='24px' class='mr-2'>
												<use width='24px' height='24px' href="/icons/popup/spritesheet.svg#phone"></use>
											</svg>
											Call
										</a>`
									: ''
							}

							${
								element.tags && element.tags.website
									? `<a href=${
											element.tags.website.startsWith('http')
												? element.tags.website
												: `https://${element.tags.website}`
									  } target="_blank" rel="noreferrer" title='Website' class='flex items-center !text-primary hover:!text-link text-xs  transition-colors'>
											<svg width='24px' height='24px' class='mr-2'>
												<use width='24px' height='24px' href="/icons/popup/spritesheet.svg#globe"></use>
											</svg>
											Website
										</a>`
									: ''
							}

							${
								element.tags && element.tags['contact:twitter']
									? `<a href=${
											element.tags['contact:twitter'].startsWith('http')
												? element.tags['contact:twitter']
												: `https://twitter.com/${element.tags['contact:twitter']}`
									  } target="_blank" rel="noreferrer" title='Twitter' class='flex items-center !text-primary hover:!text-link text-xs  transition-colors'>
											<svg width='24px' height='24px' class='mr-2'>
												<use width='24px' height='24px' href="/icons/popup/spritesheet.svg#twitter"></use>
											</svg>
											Twitter
										</a>`
									: ''
							}

							${
								element.tags && location.pathname === '/map'
									? `<button
														id='show-tags'
														title="Show tags"
														class='flex items-center !text-primary hover:!text-link text-xs transition-colors'>
															<svg width='24px' height='24px' class='mr-2'>
																<use width='24px' height='24px' href="/icons/popup/spritesheet.svg#tags"></use>
															</svg>
															Show Tags
													</button>`
									: ''
							}

							<a
								href="https://github.com/teambtcmap/btcmap-data/wiki/Map-Legend"
								target="_blank"
								rel="noreferrer"
								title="Map legend"
								class='flex items-center !text-primary hover:!text-link text-xs transition-colors'>
									<svg width='24px' height='24px' class='mr-2'>
										<use width='24px' height='24px' href="/icons/popup/spritesheet.svg#info-circle"></use>
									</svg>
									Map Legend
							</a>
							</div>
						</div>
					</div>

			<div class='w-full border-t-[0.5px] border-mapBorder mt-3 mb-2 opacity-80'></div>

			<div class='flex ${paymentMethod ? 'justify-center' : ''} space-x-4'>
${
	paymentMethod
		? `<div>
					<span class='block text-mapLabel text-xs'>Payment Methods</span>

					<div class='w-full flex space-x-2 mt-0.5'>
						<img src=${
							element.tags && element.tags['payment:onchain'] === 'yes'
								? '/icons/btc-highlight.svg'
								: element.tags && element.tags['payment:onchain'] === 'no'
								? '/icons/btc-no.svg'
								: '/icons/btc.svg'
						} alt="bitcoin" class="w-6 h-6" title="${
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
						} alt="lightning" class="w-6 h-6" title="${
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
						} alt="nfc" class="w-6 h-6" title="${
				element.tags && element.tags['payment:lightning_contactless'] === 'yes'
					? 'Lightning Contactless accepted'
					: element.tags && element.tags['payment:lightning_contactless'] === 'no'
					? 'Lightning contactless not accepted'
					: 'Lightning Contactless unknown'
		  }"/>
					</div>
				</div>`
		: ''
}

				<div>
					<span class='block text-mapLabel text-xs' title="Completed by BTC Map community members">Last Surveyed</span>
					<span class='block text-body'>
					${
						verified.length
							? `${verified[0]} ${
									Date.parse(verified[0]) > verifiedDate
										? `<span title="Verified within the last year"><svg width='16px' height='16px' class='inline'>
												<use width='16px' height='16px' href="/icons/popup/spritesheet.svg#verified"></use>
											</svg></span>`
										: ''
							  }`
							: '<span title="Not verified">---</span>'
					}
					</span>
					${
						verify
							? `<a href="/verify-location?${
									element.tags && element.tags.name
										? `&name=${element.tags.name.replaceAll('&', '%26')}`
										: ''
							  }&lat=${lat}&long=${long}&${element.type}=${
									element.id
							  }" class='!text-link hover:!text-hover text-xs transition-colors' title="Help improve the data for everyone">Verify Location</a>`
							: ''
					}
				</div>

				<div>
					${
						boosted
							? `<span class='block text-mapLabel text-xs' title="This location is boosted!">Boost Expires</span>
					<span class='block text-body' id='boosted-time'></span>`
							: ''
					}
					${
						location.pathname === '/map'
							? `<button title='Boost' id='boost-button' class='flex justify-center items-center space-x-2 text-primary hover:text-link border border-mapBorder hover:border-link rounded-lg px-3 h-[32px] transition-colors'>
						<svg width='16px' height='16px'>
							<use width='16px' height='16px' href="/icons/popup/spritesheet.svg#boost"></use>
						</svg>
						<span class='text-xs'>${boosted ? 'Extend' : 'Boost'}</span>
					</button>`
							: ''
					}
				</div>
			</div>`;

	const showMoreDiv = popupContainer.querySelector('#show-more');
	const moreButton = popupContainer.querySelector('#more-button');

	let showMore = false;

	const hideMore = () => {
		showMoreDiv.classList.add('hidden');
		moreButton.classList.replace('!text-link', '!text-primary');
		moreButton.classList.replace('border-link', 'border-mapBorder');
		showMore = false;
	};

	moreButton.onclick = () => {
		if (!showMore) {
			showMoreDiv.classList.remove('hidden');
			moreButton.classList.replace('!text-primary', '!text-link');
			moreButton.classList.replace('border-mapBorder', 'border-link');
			showMore = true;
		} else {
			hideMore();
		}
	};

	popupContainer.querySelector('#navigate').onclick = () => hideMore();
	popupContainer.querySelector('#edit').onclick = () => hideMore();
	popupContainer.querySelector('#share').onclick = () => hideMore();

	if (location.pathname === '/map') {
		const showTagsButton = popupContainer.querySelector('#show-tags');
		showTagsButton.onclick = () => {
			showTags.set(element.tags);
		};

		const boostButton = popupContainer.querySelector('#boost-button');
		const boostButtonText = boostButton.querySelector('span');
		const boostButtonIcon = boostButton.querySelector('svg');

		const resetButton = () => {
			boostButton.disabled = false;
			boostButtonText.innerText = boosted ? 'Extend' : 'Boost';
			boostButton.classList.add('space-x-2');
			boostButtonIcon.classList.remove('hidden');
		};

		boostButton.onclick = () => {
			boostButton.disabled = true;
			boostButtonIcon.classList.add('hidden');
			boostButton.classList.remove('space-x-2');
			boostButtonText.innerText = 'Boosting...';

			boost.set({
				id: element.type + ':' + element.id,
				name: element.tags && element.tags.name ? element.tags.name : '',
				boost: boosted ? boosted : '',
				lat,
				long
			});

			axios
				.get('https://blockchain.info/ticker')
				.then(function (response) {
					exchangeRate.set(response.data['USD']['15m']);
				})
				.catch(function (error) {
					errToast('Could not fetch bitcoin exchange rate, please try again or contact BTC Map.');
					console.log(error);
					resetButton();
				});
		};

		resetBoost.subscribe(resetButton);
	}

	if (boosted) {
		const boostedTime = popupContainer.querySelector('#boosted-time');
		new Time({
			target: boostedTime,
			props: {
				live: 3000,
				relative: true,
				timestamp: boosted
			}
		});
	}

	return L.marker([lat, long], { icon })
		.bindPopup(
			// marker popup component
			popupContainer,
			{ closeButton: false, maxWidth: 1000, minWidth: 300 }
		)
		.on('popupclose', () => hideMore());
};
