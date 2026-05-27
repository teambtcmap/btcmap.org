import localforage from "localforage";

// Last-viewport persistence for /map. Legacy /map stored a Leaflet
// LatLngBounds object under "coords"; this rewrite stores
// {lat, lng, zoom} under a fresh, versioned key so a user landing on a
// stale prod-Leaflet build and then this branch (or vice-versa)
// doesn't accidentally read the other format. The center/zoom shape is
// simpler and matches what the hash format already uses.

export type CachedView = { lat: number; lng: number; zoom: number };

const STORAGE_KEY = "coords-next-v1";

const isValidView = (v: unknown): v is CachedView => {
	if (!v || typeof v !== "object") return false;
	const view = v as Record<string, unknown>;
	return (
		typeof view.lat === "number" &&
		Number.isFinite(view.lat) &&
		view.lat >= -90 &&
		view.lat <= 90 &&
		typeof view.lng === "number" &&
		Number.isFinite(view.lng) &&
		view.lng >= -180 &&
		view.lng <= 180 &&
		typeof view.zoom === "number" &&
		Number.isFinite(view.zoom)
	);
};

export const loadCachedView = async (): Promise<CachedView | null> => {
	try {
		const raw = await localforage.getItem(STORAGE_KEY);
		return isValidView(raw) ? raw : null;
	} catch {
		return null;
	}
};

export const saveCachedView = async (view: CachedView): Promise<void> => {
	try {
		await localforage.setItem(STORAGE_KEY, view);
	} catch (err) {
		// IndexedDB unavailable / quota exceeded — non-fatal, the user
		// just loses last-viewport restore on next visit.
		console.error("Error caching map viewport:", err);
	}
};
