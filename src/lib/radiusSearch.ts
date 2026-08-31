import { API_BASE } from "$lib/api-base";

// URL shape and row validation for /v4/places/search/ — shared by the
// merchant-list fetcher (axios transport) and the placement dedupe name
// lookup (native fetch). Transport policy stays at each call site.
export const buildRadiusSearchUrl = (
	center: { lat: number; lon: number },
	radiusKm: number,
	fields: string,
): string =>
	`${API_BASE}/v4/places/search/?lat=${center.lat}&lon=${center.lon}&radius_km=${radiusKm}&fields=${fields}`;

// Drop rows missing a numeric id — the API can return partial garbage.
export function filterValidPlaces<T extends { id?: unknown }>(items: T[]): T[] {
	return items.filter((item): item is T => typeof item?.id === "number");
}
