// Legacy /map supported `?lat=X&long=Y` for the initial viewport, including
// a bounds form with two pairs (`?lat=A&long=B&lat=C&long=D`). Embeds rely
// on this contract, so the MapLibre rewrite has to honor it even though
// the in-page UI uses the hash format.

export type LatLongQuery =
	| { kind: "point"; lat: number; lng: number }
	| { kind: "bounds"; sw: [number, number]; ne: [number, number] };

const isFiniteCoord = (lat: number, lng: number): boolean =>
	Number.isFinite(lat) &&
	Number.isFinite(lng) &&
	lat >= -90 &&
	lat <= 90 &&
	lng >= -180 &&
	lng <= 180;

const parseNumber = (raw: string | undefined): number => {
	if (raw === undefined || raw.trim() === "") return Number.NaN;
	return Number(raw);
};

export const parseLatLongQuery = (
	searchParams: URLSearchParams,
): LatLongQuery | null => {
	const lats = searchParams.getAll("lat");
	const longs = searchParams.getAll("long");
	if (lats.length === 0 || longs.length === 0) return null;

	if (lats.length >= 2 && longs.length >= 2) {
		const lat1 = parseNumber(lats[0]);
		const lng1 = parseNumber(longs[0]);
		const lat2 = parseNumber(lats[1]);
		const lng2 = parseNumber(longs[1]);
		if (!isFiniteCoord(lat1, lng1) || !isFiniteCoord(lat2, lng2)) return null;
		return {
			kind: "bounds",
			sw: [Math.min(lng1, lng2), Math.min(lat1, lat2)],
			ne: [Math.max(lng1, lng2), Math.max(lat1, lat2)],
		};
	}

	const lat = parseNumber(lats[0]);
	const lng = parseNumber(longs[0]);
	if (!isFiniteCoord(lat, lng)) return null;
	return { kind: "point", lat, lng };
};
