import axios from "axios";

export type GeocodeResult = {
	lat: number;
	lon: number;
	displayName: string;
	// Enriched OSM metadata (when the matched result is a tagged POI). Used by
	// the add-location wizard to prefill a new merchant from an existing OSM place.
	name?: string;
	category?: string;
	website?: string;
	phone?: string;
	openingHours?: string;
	osmType?: string;
	osmId?: string;
};

type NominatimResult = {
	lat: string;
	lon: string;
	display_name: string;
	name?: string;
	category?: string;
	type?: string;
	osm_type?: string;
	osm_id?: number;
	extratags?: Record<string, string> | null;
	namedetails?: Record<string, string> | null;
};

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const REQUEST_TIMEOUT_MS = 8000;

const firstNonEmpty = (
	...vals: Array<string | undefined | null>
): string | undefined => {
	for (const v of vals) {
		if (v && v.trim()) return v.trim();
	}
	return undefined;
};

export const searchAddress = async (
	query: string,
	locale: string,
): Promise<GeocodeResult[]> => {
	const response = await axios.get<NominatimResult[]>(NOMINATIM_URL, {
		params: {
			q: query,
			format: "jsonv2",
			limit: 5,
			addressdetails: 0,
			// Request POI metadata so the wizard can prefill name/category/contact.
			extratags: 1,
			namedetails: 1,
			"accept-language": locale,
		},
		timeout: REQUEST_TIMEOUT_MS,
	});

	const results: GeocodeResult[] = [];
	for (const entry of response.data) {
		const lat = Number(entry.lat);
		const lon = Number(entry.lon);
		if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

		const extra = entry.extratags ?? {};
		results.push({
			lat,
			lon,
			displayName: entry.display_name,
			name: firstNonEmpty(entry.namedetails?.name, entry.name),
			// `type` is the specific OSM tag value (restaurant, cafe, ...); it maps
			// well to a single-word merchant category. Skip uninformative values.
			category: entry.type && entry.type !== "yes" ? entry.type : undefined,
			website: firstNonEmpty(extra.website, extra["contact:website"]),
			phone: firstNonEmpty(extra.phone, extra["contact:phone"]),
			openingHours: firstNonEmpty(extra.opening_hours),
			osmType: entry.osm_type,
			osmId: entry.osm_id != null ? String(entry.osm_id) : undefined,
		});
	}
	return results;
};
