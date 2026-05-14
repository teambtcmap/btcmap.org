import type { LatLngBounds } from "leaflet";
import type { LngLatBounds } from "maplibre-gl";

import { MERCHANT_LIST_LOW_ZOOM, MERCHANT_LIST_MIN_ZOOM } from "$lib/constants";
import type { Leaflet, Place } from "$lib/types";

export type ZoomBehavior = "none" | "api-with-limit" | "local-markers";

// Determines which fetch strategy to use based on current zoom level
// See constants.ts for zoom behavior documentation
export function getZoomBehavior(zoom: number): ZoomBehavior {
	if (zoom >= MERCHANT_LIST_MIN_ZOOM) return "local-markers"; // Zoom 15+
	if (zoom >= MERCHANT_LIST_LOW_ZOOM) return "api-with-limit"; // Zoom 11-14
	return "none"; // Below zoom 11
}

// Calculate radius from map center to corner (Haversine formula)
export const calculateRadiusKm = (bounds: LatLngBounds): number => {
	const center = bounds.getCenter();
	const corner = bounds.getNorthEast();

	const R = 6371; // Earth radius in km
	const dLat = ((corner.lat - center.lat) * Math.PI) / 180;
	const dLon = ((corner.lng - center.lng) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((center.lat * Math.PI) / 180) *
			Math.cos((corner.lat * Math.PI) / 180) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c * 1.1; // Add 10% buffer
};

// MapLibre-shaped haversine — `calculateRadiusKm` above takes a Leaflet
// `LatLngBounds`, so /map-next needs its own variant for MapLibre's
// `LngLatBounds`. No 10% buffer here: the enrichment fetch it feeds wants
// a tight radius matching the visible viewport.
export const calculateRadiusKmFromLngLatBounds = (
	bounds: LngLatBounds,
): number => {
	const center = bounds.getCenter();
	const ne = bounds.getNorthEast();
	const R = 6371; // Earth radius in km
	const dLat = ((ne.lat - center.lat) * Math.PI) / 180;
	const dLon = ((ne.lng - center.lng) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((center.lat * Math.PI) / 180) *
			Math.cos((ne.lat * Math.PI) / 180) *
			Math.sin(dLon / 2) ** 2;
	return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Get expanded bounds with buffer for preloading
export const getBufferedBounds = (
	leaflet: Leaflet,
	bounds: LatLngBounds,
	bufferPercent: number,
): LatLngBounds => {
	const latDiff = bounds.getNorth() - bounds.getSouth();
	const lngDiff = bounds.getEast() - bounds.getWest();
	const latBuffer = latDiff * bufferPercent;
	const lngBuffer = lngDiff * bufferPercent;

	return leaflet.latLngBounds([
		[bounds.getSouth() - latBuffer, bounds.getWest() - lngBuffer],
		[bounds.getNorth() + latBuffer, bounds.getEast() + lngBuffer],
	]);
};

// Get places visible in current viewport with buffer
export const getVisiblePlaces = (
	leaflet: Leaflet,
	places: Place[],
	bounds: LatLngBounds,
	bufferPercent: number,
): Place[] => {
	if (!bounds) return [];

	const bufferedBounds = getBufferedBounds(leaflet, bounds, bufferPercent);
	return places.filter((place) =>
		bufferedBounds.contains([place.lat, place.lon]),
	);
};
