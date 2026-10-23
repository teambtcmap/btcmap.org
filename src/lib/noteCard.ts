import { writable } from "svelte/store";

import type { NoteAddMethod } from "#lib/analytics.js";

import type { Note } from "$types/btcmap-api/Note";

// The /map note card (#1542): one card at a time, either adding a note at a
// point or showing one of the user's notes. A store rather than props so the
// entry points (the right-click/long-press menu in AddPlaceMode, the map
// menu, a note pin, the ?note deep link from /user/notes) don't have to be
// threaded through the legacy map page.
export type NoteDraft = {
	mode: "create";
	lat: number;
	lon: number;
	method: NoteAddMethod;
};

export type NoteCardState = NoteDraft | { mode: "view"; id: Note["id"] } | null;

const createNoteCardStore = () => {
	const { subscribe, set, update } = writable<NoteCardState>(null);
	return {
		subscribe,
		openCreate: (lat: number, lon: number, method: NoteAddMethod) =>
			set({ mode: "create", lat, lon, method }),
		// The add card's pin was dragged; a saved note can't be moved.
		moveDraft: (lat: number, lon: number) =>
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
