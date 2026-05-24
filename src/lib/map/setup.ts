import type { DivIcon, LatLng, Map as LeafletMap } from "leaflet";
import { get } from "svelte/store";

import Icon from "$components/Icon.svelte";
import { trackEvent } from "$lib/analytics";
import { _ } from "$lib/i18n";
import en from "$lib/i18n/locales/en.json";
import { session } from "$lib/session";
import { theme } from "$lib/theme";
import type { BaseMaps, DomEventType, Leaflet, Theme } from "$lib/types";
import { userLocation } from "$lib/userLocationStore";
import { errToast, humanizeIconName } from "$lib/utils";

import { replaceState } from "$app/navigation";

export const updateMapHash = (zoom: number, center: LatLng): void => {
	// Preserve any existing merchant/view parameters
	// Hash formats:
	//   #zoom/lat/lon                     → coords only, no params
	//   #zoom/lat/lon&merchant=123        → coords + params (separated by &)
	//   #merchant=123                     → params only (no coords yet)
	const currentHash = window.location.hash.substring(1);
	const ampIndex = currentHash.indexOf("&");

	let existingParams = "";
	if (ampIndex !== -1 && currentHash.substring(0, ampIndex).includes("/")) {
		// Has coords before & — params are after it (e.g. 15/10.2/-67.5&merchant=123)
		existingParams = currentHash.substring(ampIndex);
	} else if (!currentHash.includes("/")) {
		// No coords at all — entire hash is params (e.g. merchant=123 or merchant=123&view=boost)
		existingParams = currentHash ? `&${currentHash}` : "";
	}

	const newHash = `#${zoom}/${center.lat.toFixed(5)}/${center.lng.toFixed(5)}${existingParams}`;
	// Use SvelteKit's replaceState to preserve pathname, search params (e.g. language=bg), and hash
	const search = window.location.search || "";
	const url = window.location.pathname + search + newHash;
	replaceState(url, {});
};

export const layers = (leaflet: Leaflet, map: LeafletMap) => {
	const currentTheme = theme.current;

	const osm = leaflet.tileLayer(
		"https://tile.openstreetmap.org/{z}/{x}/{y}.png",
		{
			noWrap: true,
			maxZoom: 21,
			maxNativeZoom: 19,
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

export const attribution = (L: Leaflet, map: LeafletMap) => {
	// Use Leaflet's default attribution control
	L.control.attribution({ position: "bottomleft", prefix: false }).addTo(map);
};

// Swap the OpenFreeMap Liberty/Dark layers when the theme changes.
// Callers invoke this from a reactive block once the map is initialized.
export const applyThemeToBaseMaps = (
	currentTheme: Theme | undefined,
	baseMaps: BaseMaps,
	map: LeafletMap,
) => {
	if (currentTheme === "dark") {
		baseMaps["OpenFreeMap Liberty"].remove();
		baseMaps["OpenFreeMap Dark"].addTo(map);
	} else {
		baseMaps["OpenFreeMap Dark"].remove();
		baseMaps["OpenFreeMap Liberty"].addTo(map);
	}
};

export type MapControlsTranslations = {
	fullScreen?: string;
	goToHome?: string;
	addLocation?: string;
	communityMap?: string;
	merchantMap?: string;
	account?: string;
	login?: string;
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
	account: en.mapControls.account,
	login: en.mapControls.login,
	dataRefreshAvailable: en.mapControls.dataRefreshAvailable,
	support: en.mapControls.support,
	supportWithSats: en.mapControls.supportWithSats,
	zoomIn: en.mapControls.zoomIn,
	zoomOut: en.mapControls.zoomOut,
	locate: en.mapControls.locate,
};
export const support = (t?: MapControlsTranslations) => {
	const labels = { ...defaultMapControls, ...t };
	const supportAttribution: HTMLDivElement | null = document.querySelector(
		".leaflet-bottom.leaflet-right > .leaflet-control-attribution",
	);

	if (!supportAttribution) return;

	supportAttribution.textContent = "";
	const link = document.createElement("a");
	link.href = "/supporters";
	link.title = labels.supportWithSats;
	link.textContent = labels.support;
	supportAttribution.append(link, document.createTextNode(" BTC Map"));
};

export const scaleBars = (L: Leaflet, map: LeafletMap) => {
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
	map: LeafletMap,
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
	map: LeafletMap,
	DomEvent: DomEventType,
	mainMap?: boolean,
	t?: MapControlsTranslations,
) => {
	const labels = { ...defaultMapControls, ...t };
	const addControlDiv = L.DomUtil.create("div");

	// Account button stays in sync with session (SaveAuthPrompt can update it without a reload)
	// and locale (language switcher) — kept in closure so onRemove can unsubscribe.
	let accountSessionUnsubscribe: (() => void) | null = null;
	let accountLocaleUnsubscribe: (() => void) | null = null;

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

			// Account / Log in button — href + labels are driven by a session/locale subscription
			// so the button stays correct after in-place auth flows (SaveAuthPrompt, logout, etc.).
			const accountButton = L.DomUtil.create("a");
			accountButton.classList.add("leaflet-control-account");
			accountButton.role = "button";
			const accountImg = L.DomUtil.create(
				"img",
				"",
				accountButton,
			) as HTMLImageElement;
			accountImg.src = "/icons/account.svg";
			accountImg.style.width = "16px";
			accountImg.style.height = "16px";
			accountButton.onclick = () => {
				trackEvent("account_button_click", { logged_in: !!get(session) });
			};
			addControlDiv.append(accountButton);

			const updateAccount = () => {
				const loggedIn = !!get(session);
				const t = get(_);
				const title = loggedIn
					? t("mapControls.account")
					: t("mapControls.login");
				accountButton.href = loggedIn ? "/user/activity" : "/login";
				accountButton.title = title;
				accountButton.ariaLabel = title;
				accountImg.alt = loggedIn
					? t("mapControls.accountAlt")
					: t("mapControls.loginAlt");
			};

			// Both subscribe() calls fire synchronously with the current value, so
			// this also handles initial render — no separate init path needed.
			accountSessionUnsubscribe = session.subscribe(updateAccount);
			accountLocaleUnsubscribe = _.subscribe(updateAccount);

			return addControlDiv;
		},
		onRemove: () => {
			accountSessionUnsubscribe?.();
			accountLocaleUnsubscribe?.();
			accountSessionUnsubscribe = null;
			accountLocaleUnsubscribe = null;
		},
	});

	map.addControl(new customControls());
	DomEvent.disableClickPropagation(addControlDiv);
};
export const generateLocationIcon = (L: Leaflet) => {
	return L.divIcon({
		className: "div-icon",
		iconSize: [32, 43],
		iconAnchor: [16, 43],
		popupAnchor: [0, -43],
	});
};

// DivIcon augmented with the Svelte component instances it owns, so the
// marker that uses the icon can $destroy() them when removed from the map.
// Without this, every cluster re-render leaks the icon components.
type DivIconWithInstances = DivIcon & { _iconInstances?: Icon[] };

// Marker augmented with a disposer for the icon's Svelte components.
// Disposal is explicit — see attachIconCleanup for why we don't hook
// 'remove'.
type MarkerWithDisposer = import("leaflet").Marker & {
	_disposeIconInstances?: () => void;
};

// Wire up Icon-component cleanup for a marker built from a generateIcon()
// divIcon. Two cleanup paths:
//   1. setIcon is wrapped so swaps (boost/comment/saved-status updates)
//      destroy the previous icon's components and start tracking the new
//      one's. Covers the most common in-place state change.
//   2. An explicit disposeMarker(marker) call destroys the currently-
//      tracked instances. Callers must invoke this when they are
//      *permanently* done with the marker (e.g. before clearLayers, in
//      the parent component's onDestroy). DON'T hook on('remove') for
//      this — Leaflet fires 'remove' during temporary layer transitions
//      (removeLayer + addLayer), and destroying components mid-transition
//      leaves the re-added marker with a broken icon.
export const attachIconCleanup = (
	marker: import("leaflet").Marker,
	initialIcon: DivIcon,
): void => {
	const readInstances = (i: DivIcon): Icon[] =>
		(i as DivIconWithInstances)._iconInstances ?? [];
	let trackedInstances = readInstances(initialIcon);

	const origSetIcon = marker.setIcon.bind(marker);
	marker.setIcon = (nextIcon: DivIcon) => {
		for (const instance of trackedInstances) instance.$destroy();
		trackedInstances = readInstances(nextIcon);
		return origSetIcon(nextIcon);
	};

	(marker as MarkerWithDisposer)._disposeIconInstances = () => {
		for (const instance of trackedInstances) instance.$destroy();
		trackedInstances = [];
	};
};

// Destroy the Svelte Icon components owned by a marker's icon. Safe to
// call on markers without attached cleanup (no-op). Idempotent within a
// single marker (a second call after the first finds an empty list).
export const disposeMarker = (marker: import("leaflet").Marker): void => {
	(marker as MarkerWithDisposer)._disposeIconInstances?.();
};

export const generateIcon = (
	L: Leaflet,
	icon: string,
	boosted: boolean,
	commentsCount: number,
	isSaved = false,
): DivIconWithInstances => {
	const className = boosted ? "animate-wiggle" : "";
	const iconTmp = icon !== "question_mark" ? icon : "currency_bitcoin";

	const iconContainer = document.createElement("div");
	iconContainer.className =
		"icon-container relative flex items-center justify-center";

	const instances: Icon[] = [];

	const iconElement = document.createElement("div");
	instances.push(
		new Icon({
			target: iconElement,
			props: {
				w: "20",
				h: "20",
				class: `${className} mt-[5.75px] text-white`,
				icon: iconTmp,
				type: "material",
			},
		}),
	);
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

	if (isSaved) {
		const savedBadge = document.createElement("span");
		savedBadge.className =
			"saved-badge absolute top-1 left-1 transform -translate-x-1/2 -translate-y-1/2 " +
			"bg-white text-link ring-1 ring-link " +
			"rounded-full w-4 h-4 flex items-center justify-center " +
			"pointer-events-none";
		const savedIcon = document.createElement("div");
		// Wrapper's text-link colors the glyph via currentColor — no class needed here.
		instances.push(
			new Icon({
				target: savedIcon,
				props: {
					w: "10",
					h: "10",
					icon: "bookmark_filled",
					type: "material",
				},
			}),
		);
		savedBadge.appendChild(savedIcon);
		iconContainer.appendChild(savedBadge);
	}

	// Accessible label for screen readers
	const accessibleLabel = document.createElement("span");
	accessibleLabel.className = "sr-only";
	accessibleLabel.textContent = isSaved
		? `${humanizeIconName(icon)} (${get(_)("merchant.savedStatus")})`
		: humanizeIconName(icon);
	iconContainer.appendChild(accessibleLabel);

	const divIcon = L.divIcon({
		className: boosted ? "boosted-icon" : "div-icon",
		iconSize: [32, 43],
		iconAnchor: [16, 43],
		popupAnchor: [0, -43],
		html: iconContainer,
	}) as DivIconWithInstances;
	divIcon._iconInstances = instances;
	return divIcon;
};
