import { parseLatLongQuery } from "$lib/map/queryViewport";
import type { Place } from "$lib/types";
import { calculateDistance } from "$lib/utils";

// 5 decimal places (~1 m) matches the precision /add-location displays
// and snaps to in placeMarker().
export const buildAddLocationUrl = (lat: number, long: number): string =>
	`/add-location?lat=${lat.toFixed(5)}&long=${long.toFixed(5)}`;

// Delegates to the map's ?lat&long viewport parser so there is a single
// implementation of the empty-string and ±90/±180 guards. Only a single
// point is a valid placement handover — the legacy bounds form (two
// lat/long pairs) is rejected.
export const parseCoordsParams = (
	params: URLSearchParams,
): { lat: number; long: number } | null => {
	const parsed = parseLatLongQuery(params);
	if (parsed?.kind !== "point") return null;
	return { lat: parsed.lat, long: parsed.lng };
};

export const NEARBY_RADIUS_M = 75;
export const NEARBY_LIMIT = 5;

export type NearbyPlace = { place: Place; distanceM: number };

// Duplicate check for the placement confirm step: existing (non-deleted)
// places within NEARBY_RADIUS_M of the pin, closest first, capped at
// NEARBY_LIMIT. calculateDistance returns km.
export const findNearbyPlaces = (
	lat: number,
	long: number,
	places: Place[],
): NearbyPlace[] =>
	places
		.filter((place) => !place.deleted_at)
		.map((place) => ({
			place,
			distanceM: calculateDistance(lat, long, place.lat, place.lon) * 1000,
		}))
		.filter(({ distanceM }) => distanceM <= NEARBY_RADIUS_M)
		.sort((a, b) => a.distanceM - b.distanceM)
		.slice(0, NEARBY_LIMIT);
