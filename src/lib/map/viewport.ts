import type { LngLatBounds } from "maplibre-gl";

import { MERCHANT_LIST_LOW_ZOOM, MERCHANT_LIST_MIN_ZOOM } from "$lib/constants";

export type ZoomBehavior = "none" | "api-with-limit" | "local-markers";

// Determines which fetch strategy to use based on current zoom level
// See constants.ts for zoom behavior documentation
export function getZoomBehavior(zoom: number): ZoomBehavior {
	if (zoom >= MERCHANT_LIST_MIN_ZOOM) return "local-markers"; // Zoom 15+
	if (zoom >= MERCHANT_LIST_LOW_ZOOM) return "api-with-limit"; // Zoom 10-14
	return "none"; // Below zoom 10
}

// MapLibre-shaped haversine for the enrichment fetch radius. No 10%
// buffer: the enrichment fetch wants a tight radius matching the
// visible viewport.
//
// `ne.lng - center.lng` is normalized to the shortest signed angular
// distance — across the antimeridian (e.g. center near 179°, NE near
// -179°) the raw difference would be ~-358° and `dLon` would represent
// a circumnavigation, blowing the radius up to ~half the planet.
export const calculateRadiusKmFromLngLatBounds = (
	bounds: LngLatBounds,
): number => {
	const center = bounds.getCenter();
	const ne = bounds.getNorthEast();
	const R = 6371; // Earth radius in km
	const dLat = ((ne.lat - center.lat) * Math.PI) / 180;
	const dLngDeg = ((ne.lng - center.lng + 540) % 360) - 180;
	const dLon = (dLngDeg * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((center.lat * Math.PI) / 180) *
			Math.cos((ne.lat * Math.PI) / 180) *
			Math.sin(dLon / 2) ** 2;
	return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
