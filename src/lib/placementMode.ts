import { CLUSTERING_DISABLED_ZOOM } from "$lib/constants";
import { parseLatLongQuery } from "$lib/map/queryViewport";
import { buildRadiusSearchUrl, filterValidPlaces } from "$lib/radiusSearch";
import type { Place } from "$lib/types";
import { calculateDistance } from "$lib/utils";

import type { Place as ApiPlace } from "$types/btcmap-api/Place";

// The in-map form at a pin: ?add=form opens AddPlaceMode's panel, the
// hash (map's own zoom/lat/lng format, parseHashCoords) centres the map —
// and the centre IS the pin. 5 decimal places is ~1 m. Old
// /add-location?lat&long deep links redirect here.
export const buildAddFormUrl = (lat: number, long: number): string =>
	`/map?add=form#${CLUSTERING_DISABLED_ZOOM}/${lat.toFixed(5)}/${long.toFixed(5)}`;

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

// How placement mode was entered — the add_place_enter funnel dimension.
// ?add's value names the entry point: nav links, the /add-location redirect
// guard, the form's adjust-pin link, the PWA shortcut, the post-submit
// "another" button. Anything else — a bare ?add deep link or a hand-edited
// value — is a plain URL entry, so the dimension stays bounded.
export type AddEntryMethod =
	| "nav"
	| "redirect"
	| "adjust"
	| "shortcut"
	| "another"
	| "url";
// The entry points that are linked to; "url" is what unknown values fold into.
export type PlacementEntry = Exclude<AddEntryMethod, "url">;
const PLACEMENT_ENTRIES: ReadonlySet<string> = new Set<PlacementEntry>([
	"nav",
	"redirect",
	"adjust",
	"shortcut",
	"another",
]);
export const addEntryMethod = (value: string | null): AddEntryMethod =>
	value && PLACEMENT_ENTRIES.has(value) ? (value as PlacementEntry) : "url";

// The one place that spells the placement-mode URL for code; the static
// assets that can't import it (webmanifest shortcut, llms.txt) mirror the
// shape by hand.
export const placementEntryUrl = (entry: PlacementEntry): string =>
	`/map?add=${entry}`;

export const NEARBY_LIMIT = 5;
// Dedupe radius bounds: the live radius is viewport-derived (same formula
// as the merchant nearby list), floored so street-confusion duplicates
// (found up to ~1 km apart in practice) stay catchable when zoomed far
// in, and capped so zoomed-out confirms don't scan whole districts.
export const DEDUPE_MIN_RADIUS_KM = 0.25;
export const DEDUPE_MAX_RADIUS_KM = 1;

export const clampDedupeRadiusKm = (viewportRadiusKm: number): number =>
	Math.min(
		Math.max(viewportRadiusKm, DEDUPE_MIN_RADIUS_KM),
		DEDUPE_MAX_RADIUS_KM,
	);

export type NearbyPlace = { place: Place; distanceM: number };

// Duplicate check for the placement confirm step: existing (non-deleted)
// places within radiusM of the pin (caller-supplied — viewport-derived,
// clamped), closest first, capped at NEARBY_LIMIT. calculateDistance
// returns km.
export const findNearbyPlaces = (
	lat: number,
	long: number,
	places: Place[],
	radiusM: number,
): NearbyPlace[] =>
	places
		.filter((place) => !place.deleted_at)
		.map((place) => ({
			place,
			distanceM: calculateDistance(lat, long, place.lat, place.lon) * 1000,
		}))
		.filter(({ distanceM }) => distanceM <= radiusM)
		.sort((a, b) => a.distanceM - b.distanceM)
		.slice(0, NEARBY_LIMIT);

// The static CDN feed deliberately ships no name field (map-perf
// constraint), so candidate names come from a radius search at interrupt
// time — radiusKm is the caller's clamped viewport radius, matching the
// local distance filter. Any failure degrades to the unnamed fallback.
export const fetchNearbyPlaceNames = async (
	lat: number,
	long: number,
	radiusKm: number,
): Promise<Map<number, string>> => {
	const names = new Map<number, string>();
	try {
		const response = await fetch(
			buildRadiusSearchUrl({ lat, lon: long }, radiusKm, "id,name"),
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
