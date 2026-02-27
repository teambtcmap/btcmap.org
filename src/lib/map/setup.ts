import axios from "axios";
import axiosRetry from "axios-retry";
import type { DivIcon, LatLng, Map } from "leaflet";
import { get } from "svelte/store";

import Icon from "$components/Icon.svelte";
import { trackEvent } from "$lib/analytics";
import { buildFieldsParam, PLACE_FIELD_SETS } from "$lib/api-fields";
import { _ } from "$lib/i18n";
import en from "$lib/i18n/locales/en.json";
import { selectedMerchant } from "$lib/store";
import { theme } from "$lib/theme";
import type { DomEventType, Leaflet, Place } from "$lib/types";
import { userLocation } from "$lib/userLocationStore";
import { errToast, humanizeIconName } from "$lib/utils";

import { replaceState } from "$app/navigation";

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export const updateMapHash = (zoom: number, center: LatLng): void => {
	// Preserve any existing query parameters (like &merchant=123)
	const currentHash = window.location.hash.substring(1);
	const ampIndex = currentHash.indexOf("&");
	const existingParams = ampIndex !== -1 ? currentHash.substring(ampIndex) : "";

	const newHash = `#${zoom}/${center.lat.toFixed(5)}/${center.lng.toFixed(5)}${existingParams}`;
	// Use SvelteKit's replaceState to preserve current pathname while updating hash
	const url = window.location.pathname + newHash;
	// eslint-disable-next-line svelte/no-navigation-without-resolve
	replaceState(url, {});
};

export const layers = (leaflet: Leaflet, map: Map) => {
	const currentTheme = theme.current;

	const osm = leaflet.tileLayer(
		"https://tile.openstreetmap.org/{z}/{x}/{y}.png",
		{
			noWrap: true,
			maxZoom: 19,
		},
	);

	const openFreeMapLiberty = window.L.maplibreGL({
		style: "https://tiles.openfreemap.org/styles/liberty",
	});

	const openFreeMapDark = window.L.maplibreGL({
		style: "https://static.btcmap.org/map-styles/dark.json",
	});

	const cartoPositron = window.L.maplibreGL({
		style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
	});

	const cartoDarkMatter = window.L.maplibreGL({
		style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
	});

	let activeLayer;
	if (currentTheme === "dark") {
		cartoDarkMatter.addTo(map);
		activeLayer = cartoDarkMatter;
	} else {
		openFreeMapLiberty.addTo(map);
		activeLayer = openFreeMapLiberty;
	}

	const baseMaps = {
		"OpenFreeMap Liberty": openFreeMapLiberty,
		"OpenFreeMap Dark": openFreeMapDark,
		"Carto Positron": cartoPositron,
		"Carto Dark Matter": cartoDarkMatter,
		OpenStreetMap: osm,
	};

	return { baseMaps, activeLayer };
};

export const attribution = (L: Leaflet, map: Map) => {
	// Use Leaflet's default attribution control
	L.control.attribution({ position: "bottomleft", prefix: false }).addTo(map);
};

export type MapControlsTranslations = {
	fullScreen?: string;
	goToHome?: string;
	addLocation?: string;
	communityMap?: string;
	merchantMap?: string;
	dataRefreshAvailable?: string;
	support?: string;
	supportWithSats?: string;
	zoomIn?: string;
	zoomOut?: string;
	locate?: string;
};

// Fallbacks when callers omit translations (e.g. communities map, add-location). Sourced from en.json.
const defaultMapControls: Required<MapControlsTranslations> = {
	fullScreen: en.mapControls.fullScreen,
	goToHome: en.mapControls.goToHome,
	addLocation: en.mapControls.addLocation,
	communityMap: en.mapControls.communityMap,
	merchantMap: en.mapControls.merchantMap,
	dataRefreshAvailable: en.mapControls.dataRefreshAvailable,
	support: en.mapControls.support,
	supportWithSats: en.mapControls.supportWithSats,
	zoomIn: en.mapControls.zoomIn,
	zoomOut: en.mapControls.zoomOut,
	locate: en.mapControls.locate,
};

// Updates map control labels in the DOM when locale changes. Call from a locale subscription.
export const applyMapControlTranslations = (t: (key: string) => string) => {
	const labels = {
		support: t("mapControls.support"),
		supportWithSats: t("mapControls.supportWithSats"),
		zoomIn: t("mapControls.zoomIn"),
		zoomOut: t("mapControls.zoomOut"),
		fullScreen: t("mapControls.fullScreen"),
		fullScreenAlt: t("mapControls.fullScreenAlt"),
		locate: t("mapControls.locate"),
		locateAlt: t("mapControls.locateAlt"),
		goToHome: t("mapControls.goToHome"),
		goToHomeAlt: t("mapControls.goToHomeAlt"),
		addLocation: t("mapControls.addLocation"),
		addLocationAlt: t("mapControls.addLocationAlt"),
		communityMap: t("mapControls.communityMap"),
		communityMapAlt: t("mapControls.communityMapAlt"),
		merchantMap: t("mapControls.merchantMap"),
		merchantMapAlt: t("mapControls.merchantMapAlt"),
		dataRefreshAvailable: t("mapControls.dataRefreshAvailable"),
		dataRefreshAlt: t("mapControls.dataRefreshAlt"),
		boostLocations: t("boost.locations"),
		boostAlt: t("mapControls.boostAlt"),
	};

	const supportLink = document.querySelector(
		".leaflet-control-attribution a[href='/support-us']",
	) as HTMLAnchorElement | null;
	if (supportLink) {
		supportLink.title = labels.supportWithSats;
		supportLink.textContent = labels.support;
	}

	const zoomIn = document.querySelector(".leaflet-control-zoom-in");
	if (zoomIn) {
		zoomIn.setAttribute("title", labels.zoomIn);
		zoomIn.setAttribute("aria-label", labels.zoomIn);
	}
	const zoomOut = document.querySelector(".leaflet-control-zoom-out");
	if (zoomOut) {
		zoomOut.setAttribute("title", labels.zoomOut);
		zoomOut.setAttribute("aria-label", labels.zoomOut);
	}

	const fullscreen = document.querySelector(".leaflet-control-full-screen");
	if (fullscreen) {
		fullscreen.setAttribute("title", labels.fullScreen);
		fullscreen.setAttribute("aria-label", labels.fullScreen);
		const fullscreenImg = fullscreen.querySelector("img");
		if (fullscreenImg) fullscreenImg.setAttribute("alt", labels.fullScreenAlt);
	}

	const locateBtn = document.querySelector(
		".leaflet-bar-part.leaflet-bar-part-single",
	);
	if (locateBtn) {
		locateBtn.setAttribute("title", labels.locate);
		locateBtn.setAttribute("aria-label", labels.locate);
		const locateImg = locateBtn.querySelector("img");
		if (locateImg) locateImg.setAttribute("alt", labels.locateAlt);
	}

	const homeBtn = document.querySelector(".leaflet-control-home");
	if (homeBtn) {
		homeBtn.setAttribute("title", labels.goToHome);
		homeBtn.setAttribute("aria-label", labels.goToHome);
		const homeImg = homeBtn.querySelector("img");
		if (homeImg) homeImg.setAttribute("alt", labels.goToHomeAlt);
	}
	const addLocBtn = document.querySelector(".leaflet-control-add-location");
	if (addLocBtn) {
		addLocBtn.setAttribute("title", labels.addLocation);
		addLocBtn.setAttribute("aria-label", labels.addLocation);
		const addLocImg = addLocBtn.querySelector("img");
		if (addLocImg) addLocImg.setAttribute("alt", labels.addLocationAlt);
	}
	const communityBtn = document.querySelector(".leaflet-control-community-map");
	if (communityBtn) {
		communityBtn.setAttribute("title", labels.communityMap);
		communityBtn.setAttribute("aria-label", labels.communityMap);
		const communityImg = communityBtn.querySelector("img");
		if (communityImg) communityImg.setAttribute("alt", labels.communityMapAlt);
	}
	const merchantBtn = document.querySelector(".leaflet-control-merchant-map");
	if (merchantBtn) {
		merchantBtn.setAttribute("title", labels.merchantMap);
		merchantBtn.setAttribute("aria-label", labels.merchantMap);
		const merchantImg = merchantBtn.querySelector("img");
		if (merchantImg) merchantImg.setAttribute("alt", labels.merchantMapAlt);
	}

	const dataRefreshBtn = document.querySelector(
		".leaflet-control-data-refresh",
	);
	if (dataRefreshBtn) {
		dataRefreshBtn.setAttribute("title", labels.dataRefreshAvailable);
		dataRefreshBtn.setAttribute("aria-label", labels.dataRefreshAvailable);
		const refreshImg = dataRefreshBtn.querySelector("img");
		if (refreshImg) refreshImg.setAttribute("alt", labels.dataRefreshAlt);
	}

	const boostBtn = document.querySelector(".leaflet-control-boost-layer");
	if (boostBtn) {
		boostBtn.setAttribute("title", labels.boostLocations);
		boostBtn.setAttribute("aria-label", labels.boostLocations);
		const boostImg = boostBtn.querySelector("img");
		if (boostImg) boostImg.setAttribute("alt", labels.boostAlt);
	}
};

export const support = (t?: MapControlsTranslations) => {
	const labels = { ...defaultMapControls, ...t };
	const supportAttribution: HTMLDivElement | null = document.querySelector(
		".leaflet-bottom.leaflet-right > .leaflet-control-attribution",
	);

	if (!supportAttribution) return;

	supportAttribution.textContent = "";
	const link = document.createElement("a");
	link.href = "/support-us";
	link.title = labels.supportWithSats;
	link.textContent = labels.support;
	supportAttribution.append(link, document.createTextNode(" BTC Map"));
};

export const scaleBars = (L: Leaflet, map: Map) => {
	// Use Leaflet's default scale control
	L.control.scale({ position: "bottomleft" }).addTo(map);
};

export const changeDefaultIcons = (
	_layers: boolean,
	L: Leaflet,
	mapElement: HTMLDivElement,
	DomEvent: DomEventType,
	t?: MapControlsTranslations,
) => {
	const labels = { ...defaultMapControls, ...t };

	// Add analytics tracking to zoom controls (keep Leaflet's default +/- text)
	const zoomIn: HTMLAnchorElement | null = document.querySelector(
		".leaflet-control-zoom-in",
	);
	if (zoomIn) {
		zoomIn.title = labels.zoomIn;
		zoomIn.setAttribute("aria-label", labels.zoomIn);
		zoomIn.addEventListener("click", () => {
			trackEvent("zoom_in_click");
		});
	}

	const zoomOut: HTMLAnchorElement | null = document.querySelector(
		".leaflet-control-zoom-out",
	);
	if (zoomOut) {
		zoomOut.title = labels.zoomOut;
		zoomOut.setAttribute("aria-label", labels.zoomOut);
		zoomOut.addEventListener("click", () => {
			trackEvent("zoom_out_click");
		});
	}

	// Add fullscreen button (custom control, not native to Leaflet)
	const leafletBar: HTMLDivElement | null =
		document.querySelector(".leaflet-bar");
	const fullscreenButton = L.DomUtil.create("a");
	fullscreenButton.classList.add("leaflet-control-full-screen");
	fullscreenButton.title = labels.fullScreen;
	fullscreenButton.role = "button";
	fullscreenButton.ariaLabel = labels.fullScreen;
	fullscreenButton.ariaDisabled = "false";
	const fullscreenImg = L.DomUtil.create(
		"img",
		"inline",
		fullscreenButton,
	) as HTMLImageElement;
	fullscreenImg.src = "/icons/expand.svg";
	fullscreenImg.alt = get(_)("mapControls.fullScreenAlt");
	fullscreenImg.style.width = "16px";
	fullscreenImg.style.height = "16px";
	fullscreenButton.onclick = function toggleFullscreen() {
		trackEvent("fullscreen_click");
		if (!document.fullscreenElement) {
			mapElement.requestFullscreen().catch((err) => {
				errToast(
					get(_)("errors.fullscreenError", {
						values: { message: err.message, name: err.name },
					}),
				);
			});
		} else {
			document.exitFullscreen();
		}
	};

	leafletBar?.append(fullscreenButton);

	if (DomEvent) {
		DomEvent.disableClickPropagation(fullscreenButton);
	}
};

export const geolocate = (
	_L: Leaflet,
	map: Map,
	LocateControl: typeof import("leaflet.locatecontrol").LocateControl,
	t?: MapControlsTranslations,
) => {
	const labels = { ...defaultMapControls, ...t };
	const locateTitle = labels.locate;

	new LocateControl({
		position: "topright",
		strings: { title: locateTitle },
	}).addTo(map);

	// Sync location to userLocationStore so the nearby panel can show distances
	// without requiring the user to click the separate "Enable precise distances" button
	map.on("locationfound", (e) => {
		userLocation.setLocation(e.latlng.lat, e.latlng.lng);
	});

	const locateButton: HTMLAnchorElement | null = document.querySelector(
		".leaflet-bar-part.leaflet-bar-part-single",
	);
	if (locateButton) {
		// Replace default arrow icon with custom crosshairs icon
		locateButton.textContent = "";
		const locateImg = document.createElement("img") as HTMLImageElement;
		locateImg.src = "/icons/locate.svg";
		locateImg.alt = get(_)("mapControls.locateAlt");
		locateImg.style.width = "16px";
		locateImg.style.height = "16px";
		locateButton.appendChild(locateImg);
		locateButton.title = locateTitle;
		locateButton.setAttribute("aria-label", locateTitle);

		locateButton.addEventListener("click", () => {
			trackEvent("locate_click");
		});
	}
};

export const homeMarkerButtons = (
	L: Leaflet,
	map: Map,
	DomEvent: DomEventType,
	mainMap?: boolean,
	t?: MapControlsTranslations,
) => {
	const labels = { ...defaultMapControls, ...t };
	const addControlDiv = L.DomUtil.create("div");

	const customControls = L.Control.extend({
		options: {
			position: "topright",
		},
		onAdd: () => {
			addControlDiv.classList.add(
				"leaflet-control-site-links",
				"leaflet-bar",
				"leaflet-control",
			);

			// Home button
			const addHomeButton = L.DomUtil.create("a");
			addHomeButton.classList.add("leaflet-control-home");
			addHomeButton.href = "/";
			addHomeButton.title = labels.goToHome;
			addHomeButton.role = "button";
			addHomeButton.ariaLabel = labels.goToHome;
			const homeImg = L.DomUtil.create(
				"img",
				"",
				addHomeButton,
			) as HTMLImageElement;
			homeImg.src = "/icons/home.svg";
			homeImg.alt = get(_)("mapControls.goToHomeAlt");
			homeImg.style.width = "16px";
			homeImg.style.height = "16px";
			addHomeButton.onclick = () => {
				trackEvent("home_button_click");
			};
			addControlDiv.append(addHomeButton);

			if (mainMap) {
				// Add location button
				const addLocationButton = L.DomUtil.create("a");
				addLocationButton.classList.add("leaflet-control-add-location");
				addLocationButton.href = "/add-location";
				addLocationButton.title = labels.addLocation;
				addLocationButton.role = "button";
				addLocationButton.ariaLabel = labels.addLocation;
				const addLocImg = L.DomUtil.create(
					"img",
					"",
					addLocationButton,
				) as HTMLImageElement;
				addLocImg.src = "/icons/marker.svg";
				addLocImg.alt = get(_)("mapControls.addLocationAlt");
				addLocImg.style.width = "16px";
				addLocImg.style.height = "16px";
				addLocationButton.onclick = () => {
					trackEvent("add_location_click");
				};
				addControlDiv.append(addLocationButton);

				// Community map button
				const communityMapButton = L.DomUtil.create("a");
				communityMapButton.classList.add("leaflet-control-community-map");
				communityMapButton.href = "/communities/map";
				communityMapButton.title = labels.communityMap;
				communityMapButton.role = "button";
				communityMapButton.ariaLabel = labels.communityMap;
				const communityImg = L.DomUtil.create(
					"img",
					"",
					communityMapButton,
				) as HTMLImageElement;
				communityImg.src = "/icons/group.svg";
				communityImg.alt = get(_)("mapControls.communityMapAlt");
				communityImg.style.width = "16px";
				communityImg.style.height = "16px";
				communityMapButton.onclick = () => {
					trackEvent("community_map_click");
				};
				addControlDiv.append(communityMapButton);
			} else {
				// Merchant map button (for community map page)
				const merchantMapButton = L.DomUtil.create("a");
				merchantMapButton.classList.add("leaflet-control-merchant-map");
				merchantMapButton.href = "/map";
				merchantMapButton.title = labels.merchantMap;
				merchantMapButton.role = "button";
				merchantMapButton.ariaLabel = labels.merchantMap;
				const merchantImg = L.DomUtil.create(
					"img",
					"",
					merchantMapButton,
				) as HTMLImageElement;
				merchantImg.src = "/icons/shopping.svg";
				merchantImg.alt = get(_)("mapControls.merchantMapAlt");
				merchantImg.style.width = "16px";
				merchantImg.style.height = "16px";
				addControlDiv.append(merchantMapButton);
			}

			return addControlDiv;
		},
	});

	map.addControl(new customControls());
	DomEvent.disableClickPropagation(addControlDiv);
};

export const dataRefresh = (
	L: Leaflet,
	map: Map,
	DomEvent: DomEventType,
	t?: MapControlsTranslations,
) => {
	const labels = { ...defaultMapControls, ...t };
	const dataRefreshButton = L.DomUtil.create("a");

	const customDataRefreshButton = L.Control.extend({
		options: {
			position: "topright",
		},
		onAdd: () => {
			const dataRefreshDiv = L.DomUtil.create("div");
			dataRefreshDiv.classList.add(
				"leaflet-bar",
				"leaflet-control",
				"data-refresh-div",
			);
			dataRefreshDiv.style.display = "none";

			dataRefreshButton.classList.add("leaflet-control-data-refresh");
			dataRefreshButton.title = labels.dataRefreshAvailable;
			dataRefreshButton.role = "button";
			dataRefreshButton.ariaLabel = labels.dataRefreshAvailable;
			dataRefreshButton.ariaDisabled = "false";
			const refreshImg = L.DomUtil.create(
				"img",
				"",
				dataRefreshButton,
			) as HTMLImageElement;
			refreshImg.src = "/icons/refresh.svg";
			refreshImg.alt = get(_)("mapControls.dataRefreshAlt");
			refreshImg.style.width = "16px";
			refreshImg.style.height = "16px";
			dataRefreshButton.onclick = () => {
				trackEvent("data_refresh_click");
				location.reload();
			};

			dataRefreshDiv.append(dataRefreshButton);

			return dataRefreshDiv;
		},
	});

	map.addControl(new customDataRefreshButton());
	DomEvent.disableClickPropagation(dataRefreshButton);
};

export const calcVerifiedDate = () => {
	const verifiedDate = new Date();
	const previousYear = verifiedDate.getFullYear() - 1;
	return verifiedDate.setFullYear(previousYear);
};

export const generateLocationIcon = (L: Leaflet) => {
	return L.divIcon({
		className: "div-icon",
		iconSize: [32, 43],
		iconAnchor: [16, 43],
		popupAnchor: [0, -43],
	});
};

export const generateIcon = (
	L: Leaflet,
	icon: string,
	boosted: boolean,
	commentsCount: number,
) => {
	const className = boosted ? "animate-wiggle" : "";
	const iconTmp = icon !== "question_mark" ? icon : "currency_bitcoin";

	const iconContainer = document.createElement("div");
	iconContainer.className =
		"icon-container relative flex items-center justify-center";

	const iconElement = document.createElement("div");
	new Icon({
		target: iconElement,
		props: {
			w: "20",
			h: "20",
			class: `${className} mt-[5.75px] text-white`,
			icon: iconTmp,
			type: "material",
		},
	});
	iconContainer.appendChild(iconElement);

	if (commentsCount > 0) {
		const commentsCountSpan = document.createElement("span");
		commentsCountSpan.textContent = `${commentsCount}`;
		commentsCountSpan.className =
			"absolute top-1 right-1 transform translate-x-1/2 -translate-y-1/2 " +
			"bg-green-600 text-white text-[10px] font-bold " +
			"rounded-full w-4 h-4 flex items-center justify-center";
		iconContainer.appendChild(commentsCountSpan);
	}

	// Accessible label for screen readers
	const accessibleLabel = document.createElement("span");
	accessibleLabel.className = "sr-only";
	accessibleLabel.textContent = humanizeIconName(icon);
	iconContainer.appendChild(accessibleLabel);

	return L.divIcon({
		className: boosted ? "boosted-icon" : "div-icon",
		iconSize: [32, 43],
		iconAnchor: [16, 43],
		popupAnchor: [0, -43],
		html: iconContainer,
	});
};

export const verifiedArr = (place: Place) => {
	const verified = [];

	if (place["osm:survey:date"] && Date.parse(place["osm:survey:date"])) {
		verified.push(place["osm:survey:date"]);
	}

	if (place["osm:check_date"] && Date.parse(place["osm:check_date"])) {
		verified.push(place["osm:check_date"]);
	}

	if (
		place["osm:check_date:currency:XBT"] &&
		Date.parse(place["osm:check_date:currency:XBT"])
	) {
		verified.push(place["osm:check_date:currency:XBT"]);
	}

	if (verified.length > 1) {
		verified.sort((a, b) => Date.parse(b) - Date.parse(a));
	}

	return verified;
};

export const generateMarker = ({
	lat,
	long,
	icon,
	placeId,
	// element,
	// payment,
	leaflet: L,
	onMarkerClick,
	// verifiedDate,
	// verify,
	// boosted
	// issues
}: {
	lat: number;
	long: number;
	icon: DivIcon;
	placeId: number | string;
	leaflet: Leaflet;
	onMarkerClick?: (placeId: number | string) => void;
	// verifiedDate: number;
	verify: boolean;
	boosted?: boolean;
	// issues?: Issue[];
}) => {
	const marker = L.marker([lat, long], { icon });

	marker.on("click", async () => {
		if (onMarkerClick) {
			onMarkerClick(placeId);
		} else {
			// Fallback to old store-based behavior
			try {
				const response = await axios.get(
					`https://api.btcmap.org/v4/places/${placeId}?fields=${buildFieldsParam(PLACE_FIELD_SETS.COMPLETE_PLACE)}`,
				);
				const placeDetails = response.data;
				selectedMerchant.set(placeDetails);
			} catch (error) {
				console.error("Error fetching place details:", error);
				errToast(get(_)("errors.merchantDetailsLoadError"));
			}
		}
	});

	return marker;
};
