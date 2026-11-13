import axios from "axios";

import type { NominatimArea, NominatimResponse } from "#lib/types.js";

type NominatimAddress = {
	house_number?: string;
	road?: string;
	village?: string;
	town?: string;
	city?: string;
	municipality?: string;
	postcode?: string;
};

type NominatimReverseResult = {
	// Nominatim answers unresolvable points (open sea etc.) with 200 + error.
	error?: string;
	display_name?: string;
	address?: NominatimAddress;
};

const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const REQUEST_TIMEOUT_MS = 8000;
// Zoom 18 resolves to building level — the pin sits on the business
// entrance, so this is the finest granularity that stays meaningful.
const BUILDING_ZOOM = 18;

// "Road 12, 12345 Town" from the structured parts — display_name drags in
// district/region/country noise, so it's only the no-parts fallback. The
// road-first order is wrong for number-first countries (US/UK/FR), but the
// suggestion is confirmed and editable, not authoritative.
const compactAddress = (result: NominatimReverseResult): string | null => {
	const parts = result.address;
	if (parts) {
		const street = [parts.road, parts.house_number].filter(Boolean).join(" ");
		// Most specific settlement wins — a village inside a municipality is
		// the name locals (and the supertagger verifying the ticket) use.
		const settlement =
			parts.village || parts.town || parts.city || parts.municipality;
		const locality = [parts.postcode, settlement].filter(Boolean).join(" ");
		const line = [street, locality].filter(Boolean).join(", ");
		if (line) return line;
	}
	return result.display_name || null;
};

// One request per form arrival keeps this comfortably inside Nominatim's
// usage policy (the browser's Referer identifies the site). Every failure
// mode — HTTP error, timeout, unresolvable point, empty payload — resolves
// to null: the caller falls back to a hand-typed optional field.
export const reverseGeocode = async (
	lat: number,
	long: number,
	locale: string,
): Promise<string | null> => {
	try {
		const response = await axios.get<NominatimReverseResult>(
			NOMINATIM_REVERSE_URL,
			{
				params: {
					lat,
					lon: long,
					format: "jsonv2",
					zoom: BUILDING_ZOOM,
					addressdetails: 1,
					"accept-language": locale,
				},
				timeout: REQUEST_TIMEOUT_MS,
			},
		);
		if (response.data.error) return null;
		return compactAddress(response.data);
	} catch {
		return null;
	}
};

export type GeocodeResult = {
	lat: number;
	lon: number;
	displayName: string;
};

type NominatimSearchResult = {
	lat: string;
	lon: string;
	display_name: string;
};

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
// Area searches return whole boundaries (polygon_geojson), which can take
// 20+ s on a slow link, hence the longer limit. Without one a hung request
// keeps the form's search locked: it allows one search at a time (#1422).
const AREA_SEARCH_TIMEOUT_MS = 30_000;

// Forward geocoding for placement mode's "type an address to jump there"
// (#1134) — explicit-submit only, so request volume is one per search the
// user asks for, the same footprint the old form's address search had.
// Failures throw so the caller can tell "lookup failed" from "no match".
export const searchAddress = async (
	query: string,
	locale: string,
): Promise<GeocodeResult[]> => {
	const response = await axios.get<NominatimSearchResult[]>(
		NOMINATIM_SEARCH_URL,
		{
			params: {
				q: query,
				format: "jsonv2",
				limit: 5,
				addressdetails: 0,
				"accept-language": locale,
			},
			timeout: REQUEST_TIMEOUT_MS,
		},
	);

	const results: GeocodeResult[] = [];
	for (const entry of response.data) {
		// Reject empty strings before Number(): Number("") is 0, which
		// would turn a missing coordinate into a valid-looking Null
		// Island value.
		if (!entry.lat?.trim() || !entry.lon?.trim()) continue;
		const lat = Number(entry.lat);
		const lon = Number(entry.lon);
		if (Number.isFinite(lat) && Number.isFinite(lon)) {
			results.push({ lat, lon, displayName: entry.display_name });
		}
	}
	return results;
};

const isArea = (result: NominatimResponse): result is NominatimArea =>
	result.geojson?.type === "Polygon" || result.geojson?.type === "MultiPolygon";

// The community form's area picker (/communities/add): areas only, since a
// community's location is a boundary, not a point. The query travels as an
// axios param so `&`, `#` or `?` in it stay part of the search (#1422).
// Failures throw: the form reports them.
export const searchAreas = async (query: string): Promise<NominatimArea[]> => {
	const response = await axios.get<NominatimResponse[]>(NOMINATIM_SEARCH_URL, {
		params: {
			q: query,
			format: "json",
			polygon_geojson: 1,
			email: "hello@btcmap.org",
		},
		timeout: AREA_SEARCH_TIMEOUT_MS,
	});
	return response.data.filter(isArea);
};
