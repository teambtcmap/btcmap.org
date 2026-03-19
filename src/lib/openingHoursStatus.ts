import OpeningHours from "opening_hours";

export type OpenStatus = {
	isOpen: boolean;
	nextChange: Date | null;
};

type Coords = { lat: number; lon: number };

export function getOpenStatus(
	hoursString: string | undefined,
	coords?: Coords,
): OpenStatus | null {
	if (!hoursString) return null;

	try {
		// Coordinates enable timezone-aware evaluation for the merchant's location.
		// Empty country_code/state means no public-holiday awareness — the library
		// needs a full nominatim response for that, which we don't have.
		const nominatim = coords
			? {
					lat: coords.lat,
					lon: coords.lon,
					address: { country_code: "", state: "" },
				}
			: null;
		const oh = new OpeningHours(hoursString, nominatim);
		const isOpen = oh.getState();
		const nextChange = oh.getNextChange();

		return { isOpen, nextChange: nextChange ?? null };
	} catch {
		return null;
	}
}
