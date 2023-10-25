import Time from 'svelte-time';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import {
	boost,
	exchangeRate,
	resetBoost,
	showTags,
	showMore,
	theme,
	showMorePaymentMethods
} from '$lib/store';
import { get } from 'svelte/store';
import { errToast, detectTheme } from '$lib/utils';
import { InfoTooltip } from '$comp';

axiosRetry(axios, { retries: 3 });

export const toggleMapButtons = () => {
	const zoomInBtn = document.querySelector('.leaflet-control-zoom-in');
	const zoomOutBtn = document.querySelector('.leaflet-control-zoom-out');
	const fullScreenBtn = document.querySelector('.leaflet-control-full-screen');
	const locateBtn = document.querySelector('.leaflet-bar-part.leaflet-bar-part-single');
	const zoomInImg = document.querySelector('#zoomin');
	const zoomOutImg = document.querySelector('#zoomout');
	const fullScreenImg = document.querySelector('#fullscreen');
	const locateImg = document.querySelector('#locatebutton');

	if (get(theme) === 'dark') {
		zoomInImg.src = '/icons/plus-white.svg';
		zoomOutImg.src = '/icons/minus-white.svg';
		fullScreenImg.src = '/icons/expand-white.svg';
		locateImg.src = '/icons/locate-white.svg';

		zoomInBtn.onmouseenter = undefined;
		zoomInBtn.onmouseleave = undefined;
		zoomOutBtn.onmouseenter = undefined;
		zoomOutBtn.onmouseleave = undefined;
		fullScreenBtn.onmouseenter = undefined;
		fullScreenBtn.onmouseleave = undefined;
		locateBtn.onmouseenter = undefined;
		locateBtn.onmouseleave = undefined;
	} else {
		zoomInImg.src = '/icons/plus.svg';
		zoomOutImg.src = '/icons/minus.svg';
		fullScreenImg.src = '/icons/expand.svg';
		locateImg.src = '/icons/locate.svg';

		zoomInBtn.onmouseenter = () => {
			zoomInImg.src = '/icons/plus-black.svg';
		};
		zoomInBtn.onmouseleave = () => {
			zoomInImg.src = '/icons/plus.svg';
		};

		zoomOutBtn.onmouseenter = () => {
			zoomOutImg.src = '/icons/minus-black.svg';
		};
		zoomOutBtn.onmouseleave = () => {
			zoomOutImg.src = '/icons/minus.svg';
		};

		fullScreenBtn.onmouseenter = () => {
			fullScreenImg.src = '/icons/expand-black.svg';
		};
		fullScreenBtn.onmouseleave = () => {
			fullScreenImg.src = '/icons/expand.svg';
		};

		locateBtn.onmouseenter = () => {
			locateImg.src = '/icons/locate-black.svg';
		};
		locateBtn.onmouseleave = () => {
			locateImg.src = '/icons/locate.svg';
		};
	}
};

export const layers = (leaflet, map) => {
	const theme = detectTheme();

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

	const alidadeSmooth = leaflet.tileLayer(
		'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png',
		{
			noWrap: true,
			maxZoom: 20
		}
	);

	const alidadeSmoothDark = leaflet.tileLayer(
		'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
		{
			noWrap: true,
			maxZoom: 20
		}
	);

	const outdoors = leaflet.tileLayer(
		'https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}{r}.png',
		{
			noWrap: true,
			maxZoom: 20
		}
	);

	const OSMBright = leaflet.tileLayer(
		'https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png',
		{
			noWrap: true,
			maxZoom: 20
		}
	);

	if (theme === 'dark') {
		alidadeSmoothDark.addTo(map);
	} else {
		OSMBright.addTo(map);
	}

	const baseMaps = {
		'OSM Bright': OSMBright,
		'Alidade Smooth Dark': alidadeSmoothDark,
		OpenStreetMap: osm,
		'Alidade Smooth': alidadeSmooth,
		Imagery: imagery,
		Outdoors: outdoors,
		Terrain: terrain,
		Topo: topo,
		Toner: toner,
		'Toner Lite': tonerLite,
		Watercolor: watercolor,
		OpenStreetMapDE: osmDE,
		OpenStreetMapFR: osmFR
	};

	return baseMaps;
};

export const attribution = (L, map) => {
	L.control.attribution({ position: 'bottomleft' }).addTo(map);

	const OSMAttribution = document.querySelector(
		'.leaflet-bottom.leaflet-left > .leaflet-control-attribution'
	);

	OSMAttribution.style.borderRadius = '0 8px 0 0';
	OSMAttribution.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';
	OSMAttribution.innerHTML =
		'<a href="https://stadiamaps.com/" target="_blank" rel="noreferrer" class="!text-link hover:!text-hover !no-underline transition-colors block md:inline"><span class="text-map dark:text-white">&copy;</span> Stadia Maps</a> <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer" class="!text-link hover:!text-hover !no-underline transition-colors block md:inline"><span class="text-map dark:text-white">&copy;</span> OpenMapTiles</a> <a href="http://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" class="!text-link hover:!text-hover !no-underline transition-colors block md:inline"><span class="text-map dark:text-white">&copy;</span> OpenStreetMap <span class="text-map dark:text-white">contributors</span></a>';
	OSMAttribution.classList.add(
		'dark:!bg-dark',
		'dark:!text-white',
		'dark:border-t',
		'dark:border-r'
	);
};

export const support = () => {
	const supportAttribution = document.querySelector(
		'.leaflet-bottom.leaflet-right > .leaflet-control-attribution'
	);

	supportAttribution.style.borderRadius = '8px 0 0 0';
	supportAttribution.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';
	supportAttribution.innerHTML =
		'<a href="/support-us" class="!text-link hover:!text-hover !no-underline transition-colors" title="Support with sats">Support</a> BTC Map';
	supportAttribution.classList.add(
		'dark:!bg-dark',
		'dark:!text-white',
		'dark:border-t',
		'dark:border-l'
	);
};

export const scaleBars = (L, map) => {
	const theme = detectTheme();

	L.control.scale({ position: 'bottomleft' }).addTo(map);
	const scaleBars = document.querySelectorAll('.leaflet-control-scale-line');
	scaleBars.forEach((bar) => {
		bar.classList.add('dark:!bg-dark', 'dark:!text-white');
		if (theme === 'dark') {
			bar.style.textShadow = 'none';
		}
	});
};

export const changeDefaultIcons = (layers, L, mapElement, DomEvent) => {
	const theme = detectTheme();

	if (layers) {
		const layers = document.querySelector('.leaflet-control-layers');
		layers.style.border = theme === 'dark' ? '1px solid #e5e7eb' : 'none';
		layers.style.borderRadius = '8px';
		layers.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';
		layers.classList.add('dark:!bg-dark', 'dark:!text-white');
	}

	const leafletBar = document.querySelector('.leaflet-bar');
	leafletBar.style.border = 'none';
	leafletBar.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';

	const zoomIn = document.querySelector('.leaflet-control-zoom-in');
	zoomIn.style.borderRadius = '8px 8px 0 0';
	zoomIn.innerHTML = `<img src=${
		theme === 'dark' ? '/icons/plus-white.svg' : '/icons/plus.svg'
	} alt='zoomin' class='inline' id='zoomin'/>`;
	if (theme === 'light') {
		zoomIn.onmouseenter = () => {
			document.querySelector('#zoomin').src = '/icons/plus-black.svg';
		};
		zoomIn.onmouseleave = () => {
			document.querySelector('#zoomin').src = '/icons/plus.svg';
		};
	}
	zoomIn.classList.add('dark:!bg-dark', 'dark:hover:!bg-dark/75', 'dark:border');

	const zoomOut = document.querySelector('.leaflet-control-zoom-out');
	zoomOut.innerHTML = `<img src=${
		theme === 'dark' ? '/icons/minus-white.svg' : '/icons/minus.svg'
	} alt='zoomout' class='inline' id='zoomout'/>`;
	if (theme === 'light') {
		zoomOut.onmouseenter = () => {
			document.querySelector('#zoomout').src = '/icons/minus-black.svg';
		};
		zoomOut.onmouseleave = () => {
			document.querySelector('#zoomout').src = '/icons/minus.svg';
		};
	}
	zoomOut.classList.add('dark:!bg-dark', 'dark:hover:!bg-dark/75', 'dark:border');

	const fullscreenButton = L.DomUtil.create('a');
	fullscreenButton.classList.add('leaflet-control-full-screen');
	fullscreenButton.title = 'Full screen';
	fullscreenButton.role = 'button';
	fullscreenButton.ariaLabel = 'Full screen';
	fullscreenButton.ariaDisabled = 'false';
	fullscreenButton.innerHTML = `<img src=${
		theme === 'dark' ? '/icons/expand-white.svg' : '/icons/expand.svg'
	} alt='fullscreen' class='inline' id='fullscreen'/>`;
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
	if (theme === 'light') {
		fullscreenButton.onmouseenter = () => {
			document.querySelector('#fullscreen').src = '/icons/expand-black.svg';
		};
		fullscreenButton.onmouseleave = () => {
			document.querySelector('#fullscreen').src = '/icons/expand.svg';
		};
	}
	fullscreenButton.classList.add('dark:!bg-dark', 'dark:hover:!bg-dark/75', 'dark:border');

	leafletBar.append(fullscreenButton);

	DomEvent.disableClickPropagation(document.querySelector('.leaflet-control-full-screen'));
};

export const geolocate = (L, map) => {
	const theme = detectTheme();

	L.control.locate({ position: 'topleft' }).addTo(map);

	const newLocateIcon = L.DomUtil.create('img');
	newLocateIcon.src = theme === 'dark' ? '/icons/locate-white.svg' : '/icons/locate.svg';
	newLocateIcon.alt = 'locate';
	newLocateIcon.classList.add('inline');
	newLocateIcon.id = 'locatebutton';
	document.querySelector('.leaflet-control-locate-location-arrow').replaceWith(newLocateIcon);

	const locateDiv = document.querySelector('.leaflet-control-locate');
	locateDiv.style.border = 'none';
	locateDiv.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';

	const locateButton = document.querySelector('.leaflet-bar-part.leaflet-bar-part-single');
	locateButton.style.borderRadius = '8px';
	if (theme === 'light') {
		locateButton.onmouseenter = () => {
			document.querySelector('#locatebutton').src = '/icons/locate-black.svg';
		};
		locateButton.onmouseleave = () => {
			document.querySelector('#locatebutton').src = '/icons/locate.svg';
		};
	}
	locateButton.classList.add('dark:!bg-dark', 'dark:hover:!bg-dark/75', 'dark:border');
};

export const homeMarkerButtons = (L, map, DomEvent) => {
	const theme = detectTheme();

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
			addHomeButton.innerHTML = `<img src=${
				theme === 'dark' ? '/icons/home-white.svg' : '/icons/home.svg'
			} alt='home' class='inline' id='homebutton'/>`;
			addHomeButton.style.borderRadius = '8px 8px 0 0';
			if (theme === 'light') {
				addHomeButton.onmouseenter = () => {
					document.querySelector('#homebutton').src = '/icons/home-black.svg';
				};
				addHomeButton.onmouseleave = () => {
					document.querySelector('#homebutton').src = '/icons/home.svg';
				};
			}
			addHomeButton.classList.add('dark:!bg-dark', 'dark:hover:!bg-dark/75', 'dark:border');

			addControlDiv.append(addHomeButton);

			const addLocationButton = L.DomUtil.create('a');
			addLocationButton.classList.add('leaflet-bar-part');
			addLocationButton.href = '/add-location';
			addLocationButton.title = 'Add location';
			addLocationButton.role = 'button';
			addLocationButton.ariaLabel = 'Add location';
			addLocationButton.ariaDisabled = 'false';
			addLocationButton.innerHTML = `<img src=${
				theme === 'dark' ? '/icons/marker-white.svg' : '/icons/marker.svg'
			} alt='marker' class='inline' id='marker'/>`;
			addLocationButton.style.borderRadius = '0 0 8px 8px';
			if (theme === 'light') {
				addLocationButton.onmouseenter = () => {
					document.querySelector('#marker').src = '/icons/marker-black.svg';
				};
				addLocationButton.onmouseleave = () => {
					document.querySelector('#marker').src = '/icons/marker.svg';
				};
			}
			addLocationButton.classList.add('dark:!bg-dark', 'dark:hover:!bg-dark/75', 'dark:border');

			addControlDiv.append(addLocationButton);

			return addControlDiv;
		}
	});

	map.addControl(new customControls());
	DomEvent.disableClickPropagation(document.querySelector('.leaflet-control-site-links'));
};

export const dataRefresh = (L, map, DomEvent) => {
	const theme = detectTheme();

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
			dataRefreshButton.title = 'Data refresh available';
			dataRefreshButton.role = 'button';
			dataRefreshButton.ariaLabel = 'Data refresh available';
			dataRefreshButton.ariaDisabled = 'false';
			dataRefreshButton.innerHTML = `<img src=${
				theme === 'dark' ? '/icons/refresh-white.svg' : '/icons/refresh.svg'
			} alt='refresh' class='inline' id='refresh'/>`;
			dataRefreshButton.style.borderRadius = '8px';
			dataRefreshButton.onclick = () => {
				location.reload();
			};
			if (theme === 'light') {
				dataRefreshButton.onmouseenter = () => {
					document.querySelector('#refresh').src = '/icons/refresh-black.svg';
				};
				dataRefreshButton.onmouseleave = () => {
					document.querySelector('#refresh').src = '/icons/refresh.svg';
				};
			}
			dataRefreshButton.classList.add('dark:!bg-dark', 'dark:hover:!bg-dark/75', 'dark:border');

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

export const generateIcon = (L, icon, boosted) => {
	return L.divIcon({
		className: boosted ? 'boosted-icon' : 'div-icon',
		iconSize: [32, 43],
		iconAnchor: [16, 43],
		popupAnchor: [0, -43],
		html: `<svg width='20px' height='20px' class='${
			boosted ? 'animate-wiggle' : ''
		} mx-auto mt-[5.75px] text-white'>
			     	<use width='20px' height='20px' href="/icons/material/spritesheet.svg#${
							icon !== 'question_mark' ? icon : 'currency_bitcoin'
						}">
						</use>
			     </svg>`
	});
};

export const verifiedArr = (element) => {
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

	return verified;
};

const thirdPartyPaymentMethods = [
	{
		isEnabled: (tags) =>
			tags['payment:qerko:lightning'] === 'yes' || // deprecated tag, but still used somewhere. Let's remove it in a few weeks
			(tags['payment:lightning:requires_companion_app'] === 'yes' &&
				tags['payment:lightning:companion_app_url'] === 'https://www.qerko.com'),
		icon: {
			dark: '/icons/qerko.svg',
			light: '/icons/qerko.svg'
		},
		title: 'Lightning over Qerko accepted'
	}
];

export const getSupportedThirdPartyPaymentMethods = (tags) =>
	thirdPartyPaymentMethods.filter(({ isEnabled }) => isEnabled(tags));

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
	const supportedThirdPartyPaymentMethods = getSupportedThirdPartyPaymentMethods(
		element.tags ?? {}
	);

	const generatePopup = () => {
		const theme = detectTheme();

		const description =
			element.tags && element.tags.description ? element.tags.description : undefined;
		const note = element.tags && element.tags.note ? element.tags.note : undefined;

		const phone = element.tags?.phone || element.tags?.['contact:phone'] || '';
		const website = element.tags?.website || element.tags?.['contact:website'] || '';
		const email = element.tags?.email || element.tags?.['contact:email'] || '';
		const twitter = element.tags?.twitter || element.tags?.['contact:twitter'] || '';
		const instagram = element.tags?.instagram || element.tags?.['contact:instagram'] || '';
		const facebook = element.tags?.facebook || element.tags?.['contact:facebook'] || '';
		const type = element.tags?.shop || element.tags?.amenity || element.tags?.business || '';

		let verified = verifiedArr(element);

		const paymentMethod =
			element.tags &&
			(element.tags['payment:onchain'] ||
				element.tags['payment:lightning'] ||
				element.tags['payment:lightning_contactless']);

		const popupContainer = L.DomUtil.create('div');

		popupContainer.innerHTML = `${
			element.tags && element.tags.name
				? `<a href='/merchant/${element.type}:${
						element.id
				  }' class='inline-block font-bold text-lg leading-snug max-w-[300px] mb-1' title='Merchant name'><span class='!text-link hover:!text-hover transition-colors'>${
						element.tags.name
				  }</span> ${description || note ? `<span id='info' title='Information'></span>` : ''}</a>`
				: ''
		}

				${
					type
						? `<span class='block font-bold !text-primary dark:!text-white leading-snug max-w-[300px] mt-1 mb-1' title='Merchant type'>${type}</span>`
						: ''
				}

				 <span class='block text-body dark:text-white max-w-[300px] mt-1 mb-1' title='Address'>${
						element.tags && checkAddress(element.tags)
					}</span>

			${
				element.tags && element.tags['opening_hours']
					? `<div class='my-1 w-full max-w-[300px]' title='Opening hours'>
		  				<svg width='16px' height='16px' class='inline text-primary dark:text-white'>
	  						<use width='16px' height='16px' href="/icons/popup/spritesheet.svg#clock"></use>
				 	 		</svg>
			     		<span class='text-body dark:text-white'>${element.tags['opening_hours']}</span>
	  			 	 </div>`
					: ''
			}

					<div class='flex space-x-2 mt-2.5 mb-1'>
						<a id='navigate' href='geo:${lat},${long}' class='border border-mapBorder hover:border-link !text-primary dark:!text-white hover:!text-link dark:hover:!text-link rounded-lg py-1 w-full transition-colors'>
							<svg width='24px' height='24px' class='mx-auto'>
								<use width='24px' height='24px' href="/icons/popup/spritesheet.svg#compass"></use>
							</svg>
							<span class='block text-xs text-center mt-1'>Navigate</span>
						</a>

						${
							website
								? `<a href=${
										website.startsWith('http') ? website : `https://${website}`
								  } target="_blank" rel="noreferrer" class='border border-mapBorder hover:border-link !text-primary dark:!text-white hover:!text-link dark:hover:!text-link rounded-lg py-1 w-full transition-colors'>
										<svg width='24px' height='24px' class='mx-auto'>
											<use width='24px' height='24px' href="/icons/popup/spritesheet.svg#globe"></use>
										</svg>
										<span class='block text-xs text-center mt-1'>Website</span>
									</a>`
								: ''
						}

						<a id='share' href='/merchant/${element.type}:${
							element.id
						}' target="_blank" rel="noreferrer" class='border border-mapBorder hover:border-link !text-primary dark:!text-white hover:!text-link dark:hover:!text-link rounded-lg py-1 w-full transition-colors'>
							<svg width='24px' height='24px' class='mx-auto'>
								<use width='24px' height='24px' href="/icons/popup/spritesheet.svg#share"></use>
							</svg>
							<span class='block text-xs text-center mt-1'>Share</span>
						</a>

						<div class='relative w-full'>
							<button id='more-button' class='border border-mapBorder hover:border-link !text-primary dark:!text-white hover:!text-link dark:hover:!text-link rounded-lg py-1 w-full transition-colors'>
								<svg width='24px' height='24px' class='mx-auto'>
									<use width='24px' height='24px' href="/icons/popup/spritesheet.svg#dots-horizontal"></use>
								</svg>
								<span class='block text-xs text-center mt-1'>More</span>
							</button>

							<div id='show-more' class='hidden z-[500] w-[147px] border border-mapBorder p-4 absolute top-[55px] right-0 bg-white dark:bg-dark rounded-xl shadow-xl space-y-3'>
								<a id='edit' href='https://www.openstreetmap.org/edit?${element.type}=${
									element.id
								}' target="_blank" rel="noreferrer" class='flex items-center !text-primary dark:!text-white hover:!text-link dark:hover:!text-link text-xs transition-colors'>
									<svg width='24px' height='24px' class='mr-2'>
										<use width='24px' height='24px' href="/icons/popup/spritesheet.svg#pencil"></use>
									</svg>
									<span class='block text-xs text-center mt-1'>Edit</span>
								</a>

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
									  }" target="_blank" rel="noreferrer" class='flex items-center !text-primary dark:!text-white hover:!text-link dark:hover:!text-link text-xs transition-colors'>
											<svg width='24px' height='24px' class='mr-2'>
												<use width='24px' height='24px' href="/icons/popup/spritesheet.svg#bolt"></use>
											</svg>
											Pay Merchant
										</a>`
									: ''
							}

							${
								phone
									? `<a href='tel:${phone}' class='flex items-center !text-primary dark:!text-white hover:!text-link dark:hover:!text-link text-xs transition-colors'>
											<svg width='24px' height='24px' class='mr-2'>
												<use width='24px' height='24px' href="/icons/popup/spritesheet.svg#phone"></use>
											</svg>
											Call
										</a>`
									: ''
							}

							${
								email
									? `<a href='mailto:${email}' class='flex items-center !text-primary dark:!text-white hover:!text-link dark:hover:!text-link text-xs transition-colors'>
											<svg width='24px' height='24px' class='mr-2'>
												<use width='24px' height='24px' href="/icons/popup/spritesheet.svg#email"></use>
											</svg>
											Email
										</a>`
									: ''
							}

							${
								twitter
									? `<a href=${
											twitter.startsWith('http') ? twitter : `https://twitter.com/${twitter}`
									  } target="_blank" rel="noreferrer" class='flex items-center !text-primary dark:!text-white hover:!text-link dark:hover:!text-link text-xs transition-colors'>
											<svg width='24px' height='24px' class='mr-2'>
												<use width='24px' height='24px' href="/icons/popup/spritesheet.svg#twitter"></use>
											</svg>
											Twitter
										</a>`
									: ''
							}

							${
								instagram
									? `<a href=${
											instagram.startsWith('http')
												? instagram
												: `https://instagram.com/${instagram}`
									  } target="_blank" rel="noreferrer" class='flex items-center !text-primary dark:!text-white hover:!text-link dark:hover:!text-link text-xs transition-colors'>
											<svg width='24px' height='24px' class='mr-2'>
												<use width='24px' height='24px' href="/icons/popup/spritesheet.svg#instagram"></use>
											</svg>
											Instagram
										</a>`
									: ''
							}

							${
								facebook
									? `<a href=${
											facebook.startsWith('http') ? facebook : `https://facebook.com/${facebook}`
									  } target="_blank" rel="noreferrer" class='flex items-center !text-primary dark:!text-white hover:!text-link dark:hover:!text-link text-xs transition-colors'>
											<svg width='24px' height='24px' class='mr-2'>
												<use width='24px' height='24px' href="/icons/popup/spritesheet.svg#facebook"></use>
											</svg>
											Facebook
										</a>`
									: ''
							}

							${
								element.tags && location.pathname === '/map'
									? `<button
														id='show-tags'
														class='flex items-center !text-primary dark:!text-white hover:!text-link dark:hover:!text-link text-xs transition-colors'>
															<svg width='24px' height='24px' class='mr-2'>
																<use width='24px' height='24px' href="/icons/popup/spritesheet.svg#tags"></use>
															</svg>
															Show Tags
													</button>`
									: ''
							}

							<a
								href="https://wiki.btcmap.org/general/map-legend.html"
								target="_blank"
								rel="noreferrer"
								class='flex items-center !text-primary dark:!text-white hover:!text-link dark:hover:!text-link text-xs transition-colors'>
									<svg width='24px' height='24px' class='mr-2'>
										<use width='24px' height='24px' href="/icons/popup/spritesheet.svg#info-circle"></use>
									</svg>
									Map Legend
							</a>

					<a
						href="https://www.openstreetmap.org/${element.type}/${element.id}"
						target="_blank"
						rel="noreferrer"
						class='flex items-center !text-primary dark:!text-white hover:!text-link dark:hover:!text-link text-xs transition-colors'>
							<svg width='24px' height='24px' class='mr-2'>
								<use width='24px' height='24px' href="/icons/popup/spritesheet.svg#external"></use>
							</svg>
							View OSM
					</a>
							</div>
						</div>
					</div>

			<div class='w-full border-t-[0.5px] border-mapBorder mt-3 mb-3 opacity-80'></div>

			<div class='flex space-x-6'>
${
	paymentMethod || supportedThirdPartyPaymentMethods.length > 0
		? `<div class="flex-auto">
					<span class='block text-mapLabel text-xs'>Payment Methods</span>

					<div id='more-payment-methods-button' class='w-full flex space-x-2 mt-1 border border-mapBorder !text-primary dark:!text-white rounded-lg p-2 ${
						supportedThirdPartyPaymentMethods.length
							? 'hover:border-link hover:!text-link dark:hover:!text-link transition-colors cursor-pointer'
							: ''
					}'>
						<img src=${
							element.tags && element.tags['payment:onchain'] === 'yes'
								? theme === 'dark'
									? '/icons/btc-highlight-dark.svg'
									: '/icons/btc-highlight.svg'
								: element.tags && element.tags['payment:onchain'] === 'no'
								? theme === 'dark'
									? '/icons/btc-no-dark.svg'
									: '/icons/btc-no.svg'
								: theme === 'dark'
								? '/icons/btc-dark.svg'
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
								? theme === 'dark'
									? '/icons/ln-highlight-dark.svg'
									: '/icons/ln-highlight.svg'
								: element.tags && element.tags['payment:lightning'] === 'no'
								? theme === 'dark'
									? '/icons/ln-no-dark.svg'
									: '/icons/ln-no.svg'
								: theme === 'dark'
								? '/icons/ln-dark.svg'
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
								? theme === 'dark'
									? '/icons/nfc-highlight-dark.svg'
									: '/icons/nfc-highlight.svg'
								: element.tags && element.tags['payment:lightning_contactless'] === 'no'
								? theme === 'dark'
									? '/icons/nfc-no-dark.svg'
									: '/icons/nfc-no.svg'
								: theme === 'dark'
								? '/icons/nfc-dark.svg'
								: '/icons/nfc.svg'
						} alt="nfc" class="w-6 h-6" title="${
							element.tags && element.tags['payment:lightning_contactless'] === 'yes'
								? 'Lightning Contactless accepted'
								: element.tags && element.tags['payment:lightning_contactless'] === 'no'
								? 'Lightning contactless not accepted'
								: 'Lightning Contactless unknown'
						}"/>

						${
							supportedThirdPartyPaymentMethods.length > 0
								? `<img src="/icons/3rd-party.svg" alt="3rd party payment methods" class="w-6 h-6" title="Show 3rd party payment methods details"/>`
								: ''
						}

					</div>
				</div>`
		: ''
}

				<div class="flex-auto">
					<span class='block text-mapLabel text-xs' title="Completed by BTC Map community members">Last Surveyed</span>
					<span class='block text-body dark:text-white mt-2'>
					${
						verified.length
							? `${verified[0]} ${
									Date.parse(verified[0]) > verifiedDate
										? `<span title="Verified within the last year"><svg width='16px' height='16px' class='inline text-primary dark:text-white'>
												<use width='16px' height='16px' href="/icons/popup/spritesheet.svg#verified"></use>
											</svg></span>`
										: ''
							  }`
							: '<span title="Not verified">---</span>'
					}
					</span>
					${
						verify
							? `<span class='block text-body dark:text-white mt-2'>
								<a href="/verify-location?id=${
									element.type + ':' + element.id
								}" class='!text-link hover:!text-hover text-xs transition-colors' title="Help improve the data for everyone">Verify Location</a>
								</span>`
							: ''
					}
				</div>

				<div class="flex-none">
					${
						boosted
							? `<span class='block text-mapLabel text-xs' title="This location is boosted!">Boost Expires</span>
					<span class='block text-body dark:text-white' id='boosted-time'></span>`
							: ''
					}
					${
						location.pathname === '/map'
							? `<button title='Boost' id='boost-button' class='flex justify-center items-center space-x-2 text-primary dark:text-white hover:text-link dark:hover:text-link border border-mapBorder hover:border-link rounded-lg px-3 transition-colors h-16'>
						<svg width='16px' height='16px'>
							<use width='16px' height='16px' href="/icons/popup/spritesheet.svg#boost"></use>
						</svg>
						<span class='text-xs'>${boosted ? 'Extend' : 'Boost'}</span>
					</button>`
							: ''
					}
				</div>
			</div>
			
			${
				supportedThirdPartyPaymentMethods.length > 0
					? `
						<div id='show-more-payment-methods' class="hidden">
                            <div class='w-full border-t-[0.5px] border-mapBorder mt-3 mb-3 opacity-80'></div>
                            <span class='block text-mapLabel text-xs mt-1'>3rd Party Payment Methods</span>
                            <div class='w-full flex space-x-2 mt-2'>
                                ${supportedThirdPartyPaymentMethods
																	.map(
																		({ icon, title }) => `
                                        <img src=${
																					theme === 'dark' ? icon.dark : icon.light
																				} alt="${title} icon" class="w-6 h-6" title="${title}"/><span class="p-1 text-primary dark:text-white">${title}</span>
                                    `
																	)
																	.join('')}
                            </div>
						</div>
					`
					: ''
			}

			${
				theme === 'dark'
					? `
			<style>
				.leaflet-popup-content-wrapper, .leaflet-popup-tip {
					background-color: #06171C;
					border: 1px solid #e5e7eb
			}
			</style>`
					: ''
			}
			`;

		if ((description || note) && element.tags && element.tags.name) {
			const infoContainer = popupContainer.querySelector('#info');
			new InfoTooltip({
				target: infoContainer,
				props: {
					tooltip: description || note
				}
			});
		}

		const showMoreDiv = popupContainer.querySelector('#show-more');
		const moreButton = popupContainer.querySelector('#more-button');

		const hideMore = () => {
			showMoreDiv.classList.add('hidden');
			moreButton.classList.remove('!text-link');
			moreButton.classList.add('!text-primary', 'dark:!text-white');
			moreButton.classList.replace('border-link', 'border-mapBorder');
			showMore.set(false);
		};

		moreButton.onclick = () => {
			if (!get(showMore)) {
				showMoreDiv.classList.remove('hidden');
				moreButton.classList.remove('!text-primary', 'dark:!text-white');
				moreButton.classList.add('!text-link');
				moreButton.classList.replace('border-mapBorder', 'border-link');
				showMore.set(true);
			} else {
				hideMore();
			}
		};

		if (supportedThirdPartyPaymentMethods.length > 0) {
			const showMorePaymentMethodsDiv = popupContainer.querySelector('#show-more-payment-methods');
			const morePaymentMethodsButton = popupContainer.querySelector('#more-payment-methods-button');

			const hideMorePaymentMethods = () => {
				showMorePaymentMethodsDiv.classList.add('hidden');
				morePaymentMethodsButton.classList.remove('!text-link');
				morePaymentMethodsButton.classList.add('!text-primary', 'dark:!text-white');
				morePaymentMethodsButton.classList.replace('border-link', 'border-mapBorder');
				showMorePaymentMethods.set(false);
			};

			morePaymentMethodsButton.onclick = () => {
				if (!get(showMorePaymentMethods)) {
					showMorePaymentMethodsDiv.classList.remove('hidden');
					morePaymentMethodsButton.classList.remove('!text-primary', 'dark:!text-white');
					morePaymentMethodsButton.classList.add('!text-link');
					morePaymentMethodsButton.classList.replace('border-mapBorder', 'border-link');
					showMorePaymentMethods.set(true);
				} else {
					hideMorePaymentMethods();
				}
			};
		}

		popupContainer.querySelector('#navigate').onclick = () => hideMore();
		popupContainer.querySelector('#edit').onclick = () => hideMore();
		popupContainer.querySelector('#share').onclick = () => hideMore();

		if (location.pathname === '/map') {
			const showTagsButton = popupContainer.querySelector('#show-tags');
			showTagsButton.onclick = () => {
				showTags.set(element.tags || {});
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
					boost: boosted ? boosted : ''
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

		return popupContainer;
	};

	let marker = L.marker([lat, long], { icon });

	marker.on('click', () => {
		if (marker.isPopupOpen()) {
			marker.closePopup();
		} else {
			marker
				.bindPopup(
					// marker popup component
					generatePopup(),
					{
						closeButton: false,
						maxWidth: 1000,
						minWidth: supportedThirdPartyPaymentMethods.length > 0 ? 360 : 330
					}
				)
				.openPopup()
				.on('popupclose', () => {
					const showMoreDiv = document.querySelector('#show-more');
					const moreButton = document.querySelector('#more-button');

					showMoreDiv.classList.add('hidden');
					moreButton.classList.remove('!text-link');
					moreButton.classList.add('!text-primary', 'dark:!text-white');
					moreButton.classList.replace('border-link', 'border-mapBorder');
					showMore.set(false);

					if (supportedThirdPartyPaymentMethods.length > 0) {
						const showMorePaymentMethodsDiv = document.querySelector('#show-more-payment-methods');
						const morePaymentMethodsButton = document.querySelector('#more-payment-methods-button');

						showMorePaymentMethodsDiv.classList.add('hidden');
						morePaymentMethodsButton.classList.remove('!text-link');
						morePaymentMethodsButton.classList.add('!text-primary', 'dark:!text-white');
						morePaymentMethodsButton.classList.replace('border-link', 'border-mapBorder');
						showMorePaymentMethods.set(false);
					}

					marker.unbindPopup();
				});
		}
	});

	return marker;
};
