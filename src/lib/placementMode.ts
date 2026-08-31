import { parseLatLongQuery } from "$lib/map/queryViewport";
import { buildRadiusSearchUrl, filterValidPlaces } from "$lib/radiusSearch";
import type { Place } from "$lib/types";
import { calculateDistance } from "$lib/utils";

import type { Place as ApiPlace } from "$types/btcmap-api/Place";

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

// The static CDN feed deliberately ships no name field (map-perf
// constraint), so candidate names come from a tiny radius search at
// interrupt time; any failure degrades to the unnamed fallback.
export const fetchNearbyPlaceNames = async (
	lat: number,
	long: number,
): Promise<Map<number, string>> => {
	const names = new Map<number, string>();
	try {
		const response = await fetch(
			buildRadiusSearchUrl(
				{ lat, lon: long },
				NEARBY_RADIUS_M / 1000,
				"id,name",
			),
			{ signal: AbortSignal.timeout(5000) },
		);
		if (!response.ok) return names;
		const rows: unknown = await response.json();
		if (!Array.isArray(rows)) return names;
		const validRows = filterValidPlaces(
			rows as Pick<ApiPlace, "id" | "name">[],
		);
		for (const row of validRows) {
			if (typeof row.name === "string" && row.name) {
				names.set(row.id, row.name);
			}
		}
	} catch {
		// Timeout/network failure — candidates just keep the fallback label.
	}
	return names;
};
