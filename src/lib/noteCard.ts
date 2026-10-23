import { writable } from "svelte/store";

import type { NoteAddMethod } from "#lib/analytics.js";

import type { Note } from "$types/btcmap-api/Note";

// The /map note card (#1542): one card at a time, either adding a note at a
// point or showing one of the user's notes. A store rather than props so the
// entry points (the right-click/long-press menu in AddPlaceMode, the map
// menu, a note pin, the ?note deep link from /user/notes) don't have to be
// threaded through the legacy map page.
// A position in the API's terms (lat/lon). MapLibre says lng: convert at
// the map edge with fromLngLat so the two numbers can't swap.
export type NotePoint = Pick<Note, "lat" | "lon">;

export const fromLngLat = ({ lng, lat }: { lng: number; lat: number }) =>
	({ lat, lon: lng }) satisfies NotePoint;

export type NoteDraft = NotePoint & {
	mode: "create";
	method: NoteAddMethod;
};

export type NoteCardState = NoteDraft | { mode: "view"; id: Note["id"] } | null;

const createNoteCardStore = () => {
	const { subscribe, set, update } = writable<NoteCardState>(null);
	return {
		subscribe,
		openCreate: ({ lat, lon }: NotePoint, method: NoteAddMethod) =>
			set({ mode: "create", lat, lon, method }),
		// The add card's pin was dragged; a saved note can't be moved.
		moveDraft: ({ lat, lon }: NotePoint) =>
			update((state) =>
				state?.mode === "create" ? { ...state, lat, lon } : state,
			),
		openView: (id: Note["id"]) => set({ mode: "view", id }),
		close: () => set(null),
	};
};

export const noteCard = createNoteCardStore();

// /map?note=<id>, the link /user/notes rows open.
export const NOTE_PARAM = "note";

export const parseNoteParam = (raw: string | null): Note["id"] | null =>
	raw && /^[1-9]\d*$/.test(raw) ? Number(raw) : null;
