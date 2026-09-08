import { API_BASE } from "$lib/api-base";
import api from "$lib/axios";
import type { Session } from "$lib/session";
import { session } from "$lib/session";

export type SavedItemType = "place" | "area";

// Called straight on the btcmap API with the Bearer token — it answers
// CORS preflights, so no server proxy is involved (#1348). Exported for
// the pages that list saved items.
export const SAVED_ITEM_ENDPOINTS = {
	place: `${API_BASE}/v4/places/saved`,
	area: `${API_BASE}/v4/areas/saved`,
} as const;

export async function addSavedItem(
	type: SavedItemType,
	token: string,
	id: number,
): Promise<number[]> {
	// The body is a bare integer: axios won't JSON-encode a primitive (it
	// would fall back to form-urlencoded), so stringify it and declare the
	// JSON content type explicitly — actix's Json<i64> accepts nothing else.
	const res = await api.post<number[]>(
		SAVED_ITEM_ENDPOINTS[type],
		JSON.stringify(id),
		{
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
		},
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
	token: string,
	id: number,
): Promise<number[]> {
	const res = await api.delete<number[]>(
		`${SAVED_ITEM_ENDPOINTS[type]}/${id}`,
		{
			headers: { Authorization: `Bearer ${token}` },
		},
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

// Fetches the server-side saved-places and saved-areas lists and populates
// the session store. Uses allSettled so one failing endpoint doesn't block
// the other; returns per-type success so callers can avoid overwriting
// server state with a stale local list when hydration failed.
export async function hydrateSavedFromServer(
	token: string,
): Promise<HydrateResult> {
	const headers = { Authorization: `Bearer ${token}` };
	const [placesRes, areasRes] = await Promise.allSettled([
		api.get(SAVED_ITEM_ENDPOINTS.place, { headers }),
		api.get(SAVED_ITEM_ENDPOINTS.area, { headers }),
	]);
	const placeOk =
		placesRes.status === "fulfilled" && Array.isArray(placesRes.value.data);
	const areaOk =
		areasRes.status === "fulfilled" && Array.isArray(areasRes.value.data);
	if (placeOk) {
		const ids = placesRes.value.data.map((p: { id: number }) => p.id);
		session.setSavedPlaces(ids);
	}
	if (areaOk) {
		const ids = areasRes.value.data.map((a: { id: number }) => a.id);
		session.setSavedAreas(ids);
	}
	return { place: placeOk, area: areaOk };
}
