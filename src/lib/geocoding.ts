import axios from "axios";

export type GeocodeResult = {
	lat: number;
	lon: number;
	displayName: string;
};

type NominatimResult = {
	lat: string;
	lon: string;
	display_name: string;
};

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const REQUEST_TIMEOUT_MS = 8000;

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
			"accept-language": locale,
		},
		timeout: REQUEST_TIMEOUT_MS,
	});

	const results: GeocodeResult[] = [];
	for (const entry of response.data) {
		const lat = Number(entry.lat);
		const lon = Number(entry.lon);
		if (Number.isFinite(lat) && Number.isFinite(lon)) {
			results.push({ lat, lon, displayName: entry.display_name });
		}
	}
	return results;
};
