import { isValidLatitude, isValidLongitude } from "$lib/utils";

// 5 decimal places (~1 m) matches the precision /add-location displays
// and snaps to in placeMarker().
export const buildAddLocationUrl = (lat: number, long: number): string =>
	`/add-location?lat=${lat.toFixed(5)}&long=${long.toFixed(5)}`;

export const parseCoordsParams = (
	params: URLSearchParams,
): { lat: number; long: number } | null => {
	const rawLat = params.get("lat");
	const rawLong = params.get("long");
	// Number("") is 0, so empty strings must be rejected before parsing.
	if (!rawLat?.trim() || !rawLong?.trim()) return null;
	const lat = Number(rawLat);
	const long = Number(rawLong);
	if (!isValidLatitude(lat) || !isValidLongitude(long)) return null;
	return { lat, long };
};
