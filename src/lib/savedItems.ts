import api from "$lib/axios";
import { type Session, session } from "$lib/session";

export type SavedItemType = "place" | "area";

// SvelteKit server routes that proxy to the btcmap API (avoids CORS preflight).
const PROXY_ENDPOINTS = {
	place: "/api/session/saved-places",
	area: "/api/session/saved-areas",
} as const;

export async function putSavedList(
	type: SavedItemType,
	token: string,
	ids: number[],
): Promise<number[]> {
	const res = await api.put<number[]>(PROXY_ENDPOINTS[type], ids, {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!Array.isArray(res.data)) {
		throw new Error(
			`PUT ${PROXY_ENDPOINTS[type]} returned an unexpected response`,
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
