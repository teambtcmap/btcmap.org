import axios from "axios";

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
