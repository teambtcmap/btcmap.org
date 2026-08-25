import { parseLatLongQuery } from "$lib/map/queryViewport";

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
