import api from "$lib/axios";
import type { Session } from "$lib/session";
import { session } from "$lib/session";

export type SavedItemType = "place" | "area";

// SvelteKit server routes that proxy to the btcmap API (avoids CORS preflight).
const PROXY_ENDPOINTS = {
	place: "/api/session/saved-places",
	area: "/api/session/saved-areas",
} as const;

export async function addSavedItem(
	type: SavedItemType,
	token: string,
	id: number,
): Promise<number[]> {
	const res = await api.post<number[]>(PROXY_ENDPOINTS[type], id, {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!Array.isArray(res.data)) {
		throw new Error(
			`POST ${PROXY_ENDPOINTS[type]} returned an unexpected response`,
		);
	}
	return res.data;
}

export async function removeSavedItem(
	type: SavedItemType,
	token: string,
	id: number,
): Promise<number[]> {
	const res = await api.delete<number[]>(`${PROXY_ENDPOINTS[type]}/${id}`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!Array.isArray(res.data)) {
		throw new Error(
			`DELETE ${PROXY_ENDPOINTS[type]}/{id} returned an unexpected response`,
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
		api.get(PROXY_ENDPOINTS.place, { headers }),
		api.get(PROXY_ENDPOINTS.area, { headers }),
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
