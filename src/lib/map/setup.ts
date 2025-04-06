import { InfoTooltip } from '$lib/comp';
import {
	boost,
	exchangeRate,
	resetBoost,
	showMore,
	showTags,
	taggingIssues,
	theme
} from '$lib/store';
import type { DomEventType, ElementOSM, Issue, Leaflet, OSMTags, PayMerchant } from '$lib/types';
import { detectTheme, errToast } from '$lib/utils';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import type { DivIcon, Map } from 'leaflet';
import Time from 'svelte-time';
import { get } from 'svelte/store';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export const toggleMapButtons = () => {
	const zoomInBtn: HTMLAnchorElement | null = document.querySelector('.leaflet-control-zoom-in');
	const zoomOutBtn: HTMLAnchorElement | null = document.querySelector('.leaflet-control-zoom-out');
	const fullScreenBtn: HTMLAnchorElement | null = document.querySelector(
		'.leaflet-control-full-screen'
	);
	const locateBtn: HTMLAnchorElement | null = document.querySelector(
		'.leaflet-bar-part.leaflet-bar-part-single'
	);
	const zoomInImg: HTMLImageElement | null = document.querySelector('#zoomin');
	const zoomOutImg: HTMLImageElement | null = document.querySelector('#zoomout');
	const fullScreenImg: HTMLImageElement | null = document.querySelector('#fullscreen');
	const locateImg: HTMLImageElement | null = document.querySelector('#locatebutton');

	if (
		zoomInBtn &&
		zoomOutBtn &&
		fullScreenBtn &&
		locateBtn &&
		zoomInImg &&
		zoomOutImg &&
		fullScreenImg &&
		locateImg
	) {
		if (get(theme) === 'dark') {
			zoomInImg.src = '/icons/plus-white.svg';
			zoomOutImg.src = '/icons/minus-white.svg';
			fullScreenImg.src = '/icons/expand-white.svg';
			locateImg.src = '/icons/locate-white.svg';

			zoomInBtn.onmouseenter = null;
			zoomInBtn.onmouseleave = null;
			zoomOutBtn.onmouseenter = null;
			zoomOutBtn.onmouseleave = null;
			fullScreenBtn.onmouseenter = null;
			fullScreenBtn.onmouseleave = null;
			locateBtn.onmouseenter = null;
			locateBtn.onmouseleave = null;
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
	}
};

export const layers = (leaflet: Leaflet, map: Map) => {
	const theme = detectTheme();

	const osm = leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
		noWrap: true,
		maxZoom: 19
	});

	const openFreeMapLiberty = window.L.maplibreGL({
		style: 'https://tiles.openfreemap.org/styles/liberty'
	});

	const openFreeMapDark = window.L.maplibreGL({
		style: 'https://static.btcmap.org/map-styles/dark.json'
	});

	if (theme === 'dark') {
		openFreeMapDark.addTo(map);
	} else {
		openFreeMapLiberty.addTo(map);
	}

	const baseMaps = {
		'OpenFreeMap Liberty': openFreeMapLiberty,
		'OpenFreeMap Dark': openFreeMapDark,
		OpenStreetMap: osm
	};

	return baseMaps;
};

export const attribution = (L: Leaflet, map: Map) => {
	L.control.attribution({ position: 'bottomleft' }).addTo(map);

	const OSMAttribution: HTMLDivElement | null = document.querySelector(
		'.leaflet-bottom.leaflet-left > .leaflet-control-attribution'
	);

	if (!OSMAttribution) return;

	OSMAttribution.style.borderRadius = '0 8px 0 0';
	OSMAttribution.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';
	OSMAttribution.innerHTML =
		'<a href="http://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" class="!text-link hover:!text-hover !no-underline transition-colors block md:inline"><span class="text-map dark:text-white">&copy;</span> OpenStreetMap <span class="text-map dark:text-white">contributors</span></a>';
	OSMAttribution.classList.add(
		'dark:!bg-dark',
		'dark:!text-white',
		'dark:border-t',
		'dark:border-r'
	);
};

export const support = () => {
	const supportAttribution: HTMLDivElement | null = document.querySelector(
		'.leaflet-bottom.leaflet-right > .leaflet-control-attribution'
	);

	if (!supportAttribution) return;

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

export const scaleBars = (L: Leaflet, map: Map) => {
	const theme = detectTheme();

	L.control.scale({ position: 'bottomleft' }).addTo(map);
	const scaleBars: NodeListOf<HTMLDivElement> = document.querySelectorAll(
		'.leaflet-control-scale-line'
	);
	scaleBars.forEach((bar) => {
		bar.classList.add('dark:!bg-dark', 'dark:!text-white');
		if (theme === 'dark') {
			bar.style.textShadow = 'none';
		}
	});
};

export const changeDefaultIcons = (
	layers: boolean,
	L: Leaflet,
	mapElement: HTMLDivElement,
	DomEvent: DomEventType
) => {
	const theme = detectTheme();

	if (layers) {
		const layers: HTMLDivElement | null = document.querySelector('.leaflet-control-layers');
		if (layers) {
			layers.style.border = theme === 'dark' ? '1px solid #e5e7eb' : 'none';
			layers.style.borderRadius = '8px';
			layers.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';
			layers.classList.add('dark:!bg-dark', 'dark:!text-white');
		}
	}

	const leafletBar: HTMLDivElement | null = document.querySelector('.leaflet-bar');
	if (leafletBar) {
		leafletBar.style.border = 'none';
		leafletBar.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';
	}

	const zoomIn: HTMLAnchorElement | null = document.querySelector('.leaflet-control-zoom-in');
	if (zoomIn) {
		zoomIn.style.borderRadius = '8px 8px 0 0';
		zoomIn.innerHTML = `<img src=${
			theme === 'dark' ? '/icons/plus-white.svg' : '/icons/plus.svg'
		} alt='zoomin' class='inline' id='zoomin'/>`;
		if (theme === 'light') {
			const zoomInIcon: HTMLImageElement | null = document.querySelector('#zoomin');
			if (zoomInIcon) {
				zoomIn.onmouseenter = () => {
					zoomInIcon.src = '/icons/plus-black.svg';
				};
				zoomIn.onmouseleave = () => {
					zoomInIcon.src = '/icons/plus.svg';
				};
			}
		}
		zoomIn.classList.add('dark:!bg-dark', 'dark:hover:!bg-dark/75', 'dark:border');
	}

	const zoomOut: HTMLAnchorElement | null = document.querySelector('.leaflet-control-zoom-out');
	if (zoomOut) {
		zoomOut.innerHTML = `<img src=${
			theme === 'dark' ? '/icons/minus-white.svg' : '/icons/minus.svg'
		} alt='zoomout' class='inline' id='zoomout'/>`;
		if (theme === 'light') {
			const zoomOutIcon: HTMLImageElement | null = document.querySelector('#zoomout');
			if (zoomOutIcon) {
				zoomOut.onmouseenter = () => {
					zoomOutIcon.src = '/icons/minus-black.svg';
				};
				zoomOut.onmouseleave = () => {
					zoomOutIcon.src = '/icons/minus.svg';
				};
			}
		}
		zoomOut.classList.add('dark:!bg-dark', 'dark:hover:!bg-dark/75', 'dark:border');
	}

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
			const fullscreenIcon = document.querySelector('#fullscreen') as HTMLImageElement;
			if (fullscreenIcon) {
				fullscreenIcon.src = '/icons/expand-black.svg';
			}
		};
		fullscreenButton.onmouseleave = () => {
			const fullscreenIcon = document.querySelector('#fullscreen') as HTMLImageElement;
			if (fullscreenIcon) {
				fullscreenIcon.src = '/icons/expand.svg';
			}
		};
	}
	fullscreenButton.classList.add('dark:!bg-dark', 'dark:hover:!bg-dark/75', 'dark:border');
	fullscreenButton.style.borderBottom = '1px solid #ccc';

	leafletBar?.append(fullscreenButton);

	DomEvent.disableClickPropagation(fullscreenButton);
};

export const geolocate = (L: Leaflet, map: Map) => {
	const theme = detectTheme();

	// @ts-expect-error: introducing typecheck, this was failing, so ingoring for now
	L.control.locate({ position: 'topleft' }).addTo(map);

	const newLocateIcon = L.DomUtil.create('img');
	newLocateIcon.src = theme === 'dark' ? '/icons/locate-white.svg' : '/icons/locate.svg';
	newLocateIcon.alt = 'locate';
	newLocateIcon.classList.add('inline');
	newLocateIcon.id = 'locatebutton';
	document.querySelector('.leaflet-control-locate-location-arrow')?.replaceWith(newLocateIcon);

	const locateDiv: HTMLDivElement | null = document.querySelector('.leaflet-control-locate');
	if (locateDiv) {
		locateDiv.style.border = 'none';
		locateDiv.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';
	}

	const locateButton: HTMLAnchorElement | null = document.querySelector(
		'.leaflet-bar-part.leaflet-bar-part-single'
	);
	if (locateButton) {
		locateButton.style.borderRadius = '8px';
		locateButton.style.borderBottom = '1px solid #ccc';
		if (theme === 'light') {
			const locateIcon: HTMLImageElement | null = document.querySelector('#locatebutton');
			if (locateIcon) {
				locateButton.onmouseenter = () => {
					locateIcon.src = '/icons/locate-black.svg';
				};
				locateButton.onmouseleave = () => {
					locateIcon.src = '/icons/locate.svg';
				};
			}
		}
		locateButton.classList.add('dark:!bg-dark', 'dark:hover:!bg-dark/75', 'dark:border');
	}
};

export const homeMarkerButtons = (
	L: Leaflet,
	map: Map,
	DomEvent: DomEventType,
	mainMap?: boolean
) => {
	const theme = detectTheme();

	const addControlDiv = L.DomUtil.create('div');

	const customControls = L.Control.extend({
		options: {
			position: 'topleft'
		},
		onAdd: () => {
			addControlDiv.style.border = 'none';
			addControlDiv.style.filter = 'drop-shadow(0px 2px 6px rgba(0, 0, 0, 0.3))';
			addControlDiv.classList.add('leaflet-control-site-links', 'leaflet-bar', 'leaflet-control');

			const addHomeButton = L.DomUtil.create('a');
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
					const homeIcon = document.querySelector('#homebutton') as HTMLImageElement;
					if (homeIcon) {
						homeIcon.src = '/icons/home-black.svg';
					}
				};
				addHomeButton.onmouseleave = () => {
					const homeIcon = document.querySelector('#homebutton') as HTMLImageElement;
					if (homeIcon) {
						homeIcon.src = '/icons/home.svg';
					}
				};
			}
			addHomeButton.classList.add('dark:!bg-dark', 'dark:hover:!bg-dark/75', 'dark:border');

			addControlDiv.append(addHomeButton);

			if (mainMap) {
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
				addLocationButton.style.borderRadius = '0';
				if (theme === 'light') {
					addLocationButton.onmouseenter = () => {
						const markerIcon = document.querySelector('#marker') as HTMLImageElement;
						if (markerIcon) {
							markerIcon.src = '/icons/marker-black.svg';
						}
					};
					addLocationButton.onmouseleave = () => {
						const markerIcon = document.querySelector('#marker') as HTMLImageElement;
						if (markerIcon) {
							markerIcon.src = '/icons/marker.svg';
						}
					};
				}
				addLocationButton.classList.add('dark:!bg-dark', 'dark:hover:!bg-dark/75', 'dark:border');

				addControlDiv.append(addLocationButton);

				const communityMapButton = L.DomUtil.create('a');
				communityMapButton.classList.add('leaflet-bar-part');
				communityMapButton.href = '/communities/map';
				communityMapButton.title = 'Community map';
				communityMapButton.role = 'button';
				communityMapButton.ariaLabel = 'Community map';
				communityMapButton.ariaDisabled = 'false';
				communityMapButton.innerHTML = `<img src=${
					theme === 'dark' ? '/icons/group-white.svg' : '/icons/group.svg'
				} alt='group' class='inline' id='group'/>`;
				communityMapButton.style.borderRadius = '0 0 8px 8px';
				if (theme === 'light') {
					communityMapButton.onmouseenter = () => {
						const groupIcon = document.querySelector('#group') as HTMLImageElement;
						if (groupIcon) {
							groupIcon.src = '/icons/group-black.svg';
						}
					};
					communityMapButton.onmouseleave = () => {
						const groupIcon = document.querySelector('#group') as HTMLImageElement;
						if (groupIcon) {
							groupIcon.src = '/icons/group.svg';
						}
					};
				}
				communityMapButton.classList.add('dark:!bg-dark', 'dark:hover:!bg-dark/75', 'dark:border');
				communityMapButton.style.borderBottom = '1px solid #ccc';

				addControlDiv.append(communityMapButton);
			} else {
				const merchantMapButton = L.DomUtil.create('a');
				merchantMapButton.classList.add('leaflet-bar-part');
				merchantMapButton.href = '/map';
				merchantMapButton.title = 'Merchant map';
				merchantMapButton.role = 'button';
				merchantMapButton.ariaLabel = 'Merchant map';
				merchantMapButton.ariaDisabled = 'false';
				merchantMapButton.innerHTML = `<img src=${
					theme === 'dark' ? '/icons/shopping-white.svg' : '/icons/shopping.svg'
				} alt='shopping' class='inline' id='shopping'/>`;
				merchantMapButton.style.borderRadius = '0 0 8px 8px';
				if (theme === 'light') {
					merchantMapButton.onmouseenter = () => {
						const shoppingIcon = document.querySelector('#shopping') as HTMLImageElement;
						if (shoppingIcon) {
							shoppingIcon.src = '/icons/shopping-black.svg';
						}
					};
					merchantMapButton.onmouseleave = () => {
						const shoppingIcon = document.querySelector('#shopping') as HTMLImageElement;
						if (shoppingIcon) {
							shoppingIcon.src = '/icons/shopping.svg';
						}
					};
				}
				merchantMapButton.classList.add('dark:!bg-dark', 'dark:hover:!bg-dark/75', 'dark:border');

				addControlDiv.append(merchantMapButton);
			}

			return addControlDiv;
		}
	});

	map.addControl(new customControls());
	DomEvent.disableClickPropagation(addControlDiv);
};

export const dataRefresh = (L: Leaflet, map: Map, DomEvent: DomEventType) => {
	const theme = detectTheme();

	const dataRefreshButton = L.DomUtil.create('a');

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
					const refreshIcon = document.querySelector('#refresh') as HTMLImageElement;
					if (refreshIcon) {
						refreshIcon.src = '/icons/refresh-black.svg';
					}
				};
				dataRefreshButton.onmouseleave = () => {
					const refreshIcon = document.querySelector('#refresh') as HTMLImageElement;
					if (refreshIcon) {
						refreshIcon.src = '/icons/refresh.svg';
					}
				};
			}
			dataRefreshButton.classList.add('dark:!bg-dark', 'dark:hover:!bg-dark/75', 'dark:border');

			dataRefreshDiv.append(dataRefreshButton);

			return dataRefreshDiv;
		}
	});

	map.addControl(new customDataRefreshButton());
	DomEvent.disableClickPropagation(dataRefreshButton);
};

export const calcVerifiedDate = () => {
	const verifiedDate = new Date();
	const previousYear = verifiedDate.getFullYear() - 1;
	return verifiedDate.setFullYear(previousYear);
};

export const checkAddress = (element: OSMTags) => {
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

export const latCalc = (element: ElementOSM) => {
	if (element.type === 'node') {
		return element.lat;
	} else {
		if (element.bounds && 'minlat' in element.bounds && 'maxlat' in element.bounds) {
			return (element.bounds.minlat + element.bounds.maxlat) / 2;
		}
		return 0;
	}
};

export const longCalc = (element: ElementOSM) => {
	if (element.type === 'node') {
		return element.lon;
	} else {
		if (element.bounds && 'minlon' in element.bounds && 'maxlon' in element.bounds) {
			return (element.bounds.minlon + element.bounds.maxlon) / 2;
		}
		return 0;
	}
};

export const generateIcon = (L: Leaflet, icon: string, boosted: boolean) => {
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

export const verifiedArr = (element: ElementOSM) => {
	const verified = [];

	if (element.tags) {
		if (element.tags['survey:date'] && Date.parse(element.tags['survey:date'])) {
			verified.push(element.tags['survey:date']);
		}

		if (element.tags['check_date'] && Date.parse(element.tags['check_date'])) {
			verified.push(element.tags['check_date']);
		}

		if (
			element.tags['check_date:currency:XBT'] &&
			Date.parse(element.tags['check_date:currency:XBT'])
		) {
			verified.push(element.tags['check_date:currency:XBT']);
		}

		if (verified.length > 1) {
			verified.sort((a, b) => Date.parse(b) - Date.parse(a));
		}
	}

	return verified;
};

export const generateMarker = (
	lat: number,
	long: number,
	icon: DivIcon,
	element: ElementOSM,
	payment: PayMerchant,
	L: Leaflet,
	verifiedDate: number,
	verify: boolean,
	boosted: string | undefined,
	issues?: Issue[] | undefined
) => {
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

		const verified = verifiedArr(element);

		const thirdParty =
			element.tags?.['payment:lightning:requires_companion_app'] === 'yes' &&
			element.tags['payment:lightning:companion_app_url'];

		const paymentMethod =
			element.tags &&
			(element.tags['payment:onchain'] ||
				element.tags['payment:lightning'] ||
				element.tags['payment:lightning_contactless']);

		const extraButtons =
			location.pathname === '/map' ||
			location.pathname.includes('/community') ||
			location.pathname.includes('/country');

		const popupContainer = L.DomUtil.create('div');

		popupContainer.innerHTML = `${
			element.tags && element.tags.name
				? `<a href='/merchant/${element.type}:${
						element.id
					}' class='inline-block font-bold text-lg leading-snug max-w-[300px]' title='Merchant name'><span class='!text-link hover:!text-hover transition-colors'>${
						element.tags.name
					}</span> ${description || note ? `<span id='info' title='Information'></span>` : ''}</a>`
				: ''
		}

				 <span class='block text-body dark:text-white max-w-[300px]' title='Address'>${
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

						<a id='edit' href='https://www.openstreetmap.org/edit?${element.type}=${
							element.id
						}' target="_blank" rel="noreferrer" class='border border-mapBorder hover:border-link !text-primary dark:!text-white hover:!text-link dark:hover:!text-link rounded-lg py-1 w-full transition-colors'>
							<svg width='24px' height='24px' class='mx-auto'>
								<use width='24px' height='24px' href="/icons/popup/spritesheet.svg#pencil"></use>
							</svg>
							<span class='block text-xs text-center mt-1'>Edit</span>
						</a>

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
								website
									? `<a href=${
											website.startsWith('http') ? website : `https://${website}`
										} target="_blank" rel="noreferrer" class='flex items-center !text-primary dark:!text-white hover:!text-link dark:hover:!text-link text-xs transition-colors'>
											<svg width='24px' height='24px' class='mr-2'>
												<use width='24px' height='24px' href="/icons/popup/spritesheet.svg#globe"></use>
											</svg>
											Website
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
								element.tags && extraButtons
									? `<button
										id='show-tags'
										class='flex items-center !text-primary dark:!text-white hover:!text-link dark:hover:!text-link text-xs transition-colors'>
											<svg width='24px' height='24px' class='mr-2'>
												<use width='24px' height='24px' href="/icons/popup/spritesheet.svg#tags"></use>
											</svg>
											Show Tags
										</button>
													
										<button
										id='tagging-issues'
										class='flex items-center !text-primary dark:!text-white hover:!text-link dark:hover:!text-link text-xs transition-colors'>
											<svg width='24px' height='24px' class='mr-2'>
												<use width='24px' height='24px' href="/icons/popup/spritesheet.svg#issues"></use>
											</svg>
											Tag Issues
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

			<div class='w-full border-t-[0.5px] border-mapBorder mt-3 mb-2 opacity-80'></div>

			<div class='flex space-x-4'>
${
	paymentMethod || thirdParty
		? `<div>
					<span class='block text-mapLabel text-xs'>Payment Methods</span>

					<div class='w-full flex space-x-2 mt-0.5'>
					${
						!paymentMethod
							? `<a href=${element.tags?.['payment:lightning:companion_app_url']} target="_blank" rel="noreferrer">
								<i class="fa-solid fa-mobile-screen-button w-6 h-6 !text-primary dark:!text-white hover:!text-link dark:hover:!text-link transition-colors" title="Third party app required"></i>
							   </a>`
							: `
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
									: 'Lightning contactless unknown'
						}"/>`
					}
					</div>
				</div>`
		: ''
}

				<div>
					<span class='block text-mapLabel text-xs' title="Completed by BTC Map community members">Last Surveyed</span>
					<span class='block text-body dark:text-white'>
					${
						verified.length
							? `${verified[0]} ${
									Date.parse(verified[0]) > verifiedDate
										? `<span title="Verified within the last year"><svg width='16px' height='16px' class='inline text-primary dark:text-white'>
												<use width='16px' height='16px' href="/icons/popup/spritesheet.svg#verified"></use>
											</svg></span>`
										: `<span title="Outdated please re-verify"><svg width='16px' height='16px' class='inline text-primary dark:text-white'>
												<use width='16px' height='16px' href="/icons/popup/spritesheet.svg#outdated"></use>
											</svg></span>`
								}`
							: '<span title="Not verified">---</span>'
					}
					</span>

					${
						verify
							? `<a href="/verify-location?id=${
									element.type + ':' + element.id
								}" class='!text-link hover:!text-hover text-xs transition-colors' title="Help improve the data for everyone">Verify Location</a>`
							: ''
					}
				</div>

				<div>
					${
						boosted
							? `<span class='block text-mapLabel text-xs' title="This location is boosted!">Boost Expires</span>
							   <span class='block text-body dark:text-white' id='boosted-time'></span>`
							: ''
					}
					
					${
						extraButtons
							? `<button title='Boost' id='boost-button' class='flex justify-center items-center space-x-2 text-primary dark:text-white hover:text-link dark:hover:text-link border border-mapBorder hover:border-link rounded-lg px-3 h-[32px] transition-colors'>
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
				theme === 'dark'
					? `<style>
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

			if (infoContainer) {
				new InfoTooltip({
					target: infoContainer,
					props: {
						tooltip: description || note
					}
				});
			}
		}

		const showMoreDiv = popupContainer.querySelector('#show-more');
		const moreButton: HTMLButtonElement | null = popupContainer.querySelector('#more-button');

		const hideMore = () => {
			showMoreDiv?.classList.add('hidden');
			moreButton?.classList.remove('!text-link');
			moreButton?.classList.add('!text-primary', 'dark:!text-white');
			moreButton?.classList.replace('border-link', 'border-mapBorder');
			showMore.set(false);
		};

		if (moreButton) {
			moreButton.onclick = () => {
				if (!get(showMore)) {
					showMoreDiv?.classList.remove('hidden');
					moreButton.classList.remove('!text-primary', 'dark:!text-white');
					moreButton.classList.add('!text-link');
					moreButton.classList.replace('border-mapBorder', 'border-link');
					showMore.set(true);
				} else {
					hideMore();
				}
			};
		}

		const navigateBtn: HTMLAnchorElement | null = popupContainer.querySelector('#navigate');
		const editBtn: HTMLAnchorElement | null = popupContainer.querySelector('#edit');
		const shareBtn: HTMLAnchorElement | null = popupContainer.querySelector('#share');
		if (navigateBtn && editBtn && shareBtn) {
			navigateBtn.onclick = () => hideMore();
			editBtn.onclick = () => hideMore();
			shareBtn.onclick = () => hideMore();
		}

		if (extraButtons) {
			const showTagsButton: HTMLButtonElement | null = popupContainer.querySelector('#show-tags');
			if (showTagsButton) {
				showTagsButton.onclick = () => {
					showTags.set(element.tags || {});
				};
			}

			const taggingIssuesButton: HTMLButtonElement | null =
				popupContainer.querySelector('#tagging-issues');
			if (taggingIssuesButton) {
				taggingIssuesButton.onclick = () => {
					taggingIssues.set(issues || []);
				};
			}

			const boostButton: HTMLButtonElement | null = popupContainer.querySelector('#boost-button');
			const boostButtonText: HTMLSpanElement | null | undefined =
				boostButton?.querySelector('span');
			const boostButtonIcon: SVGElement | null | undefined = boostButton?.querySelector('svg');

			const resetButton = () => {
				if (boostButton && boostButtonText && boostButtonIcon) {
					boostButton.disabled = false;
					boostButtonText.innerText = boosted ? 'Extend' : 'Boost';
					boostButton.classList.add('space-x-2');
					boostButtonIcon.classList.remove('hidden');
				}
			};

			if (boostButton) {
				boostButton.onclick = () => {
					if (boostButton && boostButtonText && boostButtonIcon) {
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
								errToast(
									'Could not fetch bitcoin exchange rate, please try again or contact BTC Map.'
								);
								console.log(error);
								resetButton();
							});
					}
				};
			}

			resetBoost.subscribe(resetButton);
		}

		if (boosted) {
			const boostedTime = popupContainer.querySelector('#boosted-time');
			if (boostedTime) {
				new Time({
					target: boostedTime,
					props: {
						live: 3000,
						relative: true,
						timestamp: boosted
					}
				});
			}
		}

		return popupContainer;
	};

	const marker = L.marker([lat, long], { icon });

	marker.on('click', () => {
		if (marker.isPopupOpen()) {
			marker.closePopup();
		} else {
			marker
				.bindPopup(
					// marker popup component
					generatePopup(),
					{ closeButton: false, maxWidth: 1000, minWidth: 300 }
				)
				.openPopup()
				.on('popupclose', () => {
					const showMoreDiv = document.querySelector('#show-more');
					const moreButton = document.querySelector('#more-button');

					showMoreDiv?.classList.add('hidden');
					moreButton?.classList.remove('!text-link');
					moreButton?.classList.add('!text-primary', 'dark:!text-white');
					moreButton?.classList.replace('border-link', 'border-mapBorder');
					showMore.set(false);

					marker.unbindPopup();
				});
		}
	});

	return marker;
};
