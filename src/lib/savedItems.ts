import { API_BASE } from "#lib/api-base.js";
import type { AuthedClient } from "#lib/authedApi.js";
import { authedClient } from "#lib/authedApi.js";
import type { Session } from "#lib/session.js";
import { session } from "#lib/session.js";

export type SavedItemType = "place" | "area";

// Called straight on the btcmap API as the signed-in user (authedApi.ts) —
// it answers CORS preflights, so no server proxy is involved (#1348).
export const SAVED_ITEM_ENDPOINTS = {
	place: `${API_BASE}/v4/places/saved`,
	area: `${API_BASE}/v4/areas/saved`,
} as const;

export async function addSavedItem(
	type: SavedItemType,
	id: number,
	client: AuthedClient = authedClient(),
): Promise<number[]> {
	// The body is a bare integer: axios won't JSON-encode a primitive (it
	// would fall back to form-urlencoded), so stringify it and declare the
	// JSON content type explicitly — actix's Json<i64> accepts nothing else.
	const res = await client.post<number[]>(
		SAVED_ITEM_ENDPOINTS[type],
		JSON.stringify(id),
		{ headers: { "Content-Type": "application/json" } },
	);
	if (!Array.isArray(res.data)) {
		throw new Error(
			`POST ${SAVED_ITEM_ENDPOINTS[type]} returned an unexpected response`,
		);
	}
	return res.data;
}

export async function removeSavedItem(
	type: SavedItemType,
	id: number,
	client: AuthedClient = authedClient(),
): Promise<number[]> {
	const res = await client.delete<number[]>(
		`${SAVED_ITEM_ENDPOINTS[type]}/${id}`,
	);
	if (!Array.isArray(res.data)) {
		throw new Error(
			`DELETE ${SAVED_ITEM_ENDPOINTS[type]}/${id} returned an unexpected response`,
		);
	}
	return res.data;
}

export function setSavedList(type: SavedItemType, ids: number[]) {
	if (type === "place") {
		session.setSavedPlaces(ids);
	} else {
		session.setSavedAreas(ids);
	}
}

export function getSavedList(s: Session | null, type: SavedItemType): number[] {
	if (!s) return [];
	return type === "place" ? s.savedPlaces : s.savedAreas;
}

export function toggleSavedLocal(
	type: SavedItemType,
	id: number,
): number[] | null {
	return type === "place"
		? session.toggleSavedPlace(id)
		: session.toggleSavedArea(id);
}

export type HydrateResult = {
	place: boolean;
	area: boolean;
};

// The user's saved places or areas as the API lists them (whole objects,
// for the pages that show them). Throws on an unexpected response.
export async function fetchSavedList<T extends { id: number }>(
	type: SavedItemType,
	client: AuthedClient = authedClient(),
): Promise<T[]> {
	const res = await client.get<T[]>(SAVED_ITEM_ENDPOINTS[type]);
	if (!Array.isArray(res.data)) {
		throw new Error(
			`GET ${SAVED_ITEM_ENDPOINTS[type]} returned an unexpected response`,
		);
	}
	return res.data;
}

// Fetches the server-side saved-places and saved-areas lists and populates
// the session store. Uses allSettled so one failing endpoint doesn't block
// the other; returns per-type success so callers can avoid overwriting
// server state with a stale local list when hydration failed. A list that
// lands after a logout or another login is dropped, not written into the
// new session.
export async function hydrateSavedFromServer(
	client: AuthedClient = authedClient(),
): Promise<HydrateResult> {
	const [placesRes, areasRes] = await Promise.allSettled([
		fetchSavedList("place", client),
		fetchSavedList("area", client),
	]);
	const current = client.stillCurrent();
	const placeOk = placesRes.status === "fulfilled";
	const areaOk = areasRes.status === "fulfilled";
	if (placeOk && current) {
		session.setSavedPlaces(placesRes.value.map((p) => p.id));
	}
	if (areaOk && current) {
		session.setSavedAreas(areasRes.value.map((a) => a.id));
	}
	return { place: placeOk, area: areaOk };
}
