import type { Readable } from "svelte/store";
import { writable } from "svelte/store";

import { API_BASE } from "#lib/api-base.js";
import type { AuthedClient } from "#lib/authedApi.js";
import { authedClient } from "#lib/authedApi.js";
import type { Session } from "#lib/session.js";
import { session } from "#lib/session.js";

import type { Note } from "$types/btcmap-api/Note";
import type { PatchNoteArgs } from "$types/btcmap-api/PatchNoteArgs";
import type { PostNoteArgs } from "$types/btcmap-api/PostNoteArgs";

// The signed-in user's personal notes (#1542): free text pinned to a
// coordinate, linked to no place. Only the owner's own notes are loaded;
// other users' public notes are out of scope until the API can moderate them.
//
// Called straight on the btcmap API as the signed-in user (authedApi.ts,
// #1348), like the saved items.

// The endpoint's `limit` cap.
export const NOTES_PAGE_SIZE = 500;

const MY_NOTES_URL = `${API_BASE}/v4/users/me/notes`;
const NOTES_URL = `${API_BASE}/v4/notes`;

// Trust boundary: a non-JSON or reshaped response must not reach the map
// (the #1187 lesson), so every row is checked against the whole Note shape.
const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const isNote = (value: unknown): value is Note => {
	if (!isRecord(value)) return false;
	const n = value;
	return (
		isRecord(n.author) &&
		typeof n.author.id === "number" &&
		typeof n.author.name === "string" &&
		typeof n.id === "number" &&
		typeof n.lat === "number" &&
		typeof n.lon === "number" &&
		typeof n.text === "string" &&
		typeof n.icon === "string" &&
		typeof n.public === "boolean" &&
		typeof n.created_at === "string" &&
		typeof n.updated_at === "string"
	);
};

const expectNote = (data: unknown, call: string): Note => {
	if (!isNote(data)) throw new Error(`${call} returned an unexpected response`);
	return data;
};

const newestFirst = (notes: Note[]): Note[] =>
	[...notes].sort(
		(a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id,
	);

// Just before `updatedAt`, as the API's strict `updated_at >` cursor needs:
// starting at the last row's own timestamp would skip the rest of a run of
// equal timestamps cut off by the page boundary. Rows it repeats are deduped.
const cursorBefore = (updatedAt: string): string =>
	new Date(new Date(updatedAt).getTime() - 1).toISOString();

// Every live note of the client's user, newest first. A user rarely has more
// than one page; the loop is there so a heavy user still gets all of them.
export async function fetchMyNotes(client: AuthedClient): Promise<Note[]> {
	const byId = new Map<number, Note>();
	let updatedSince: string | undefined;

	for (;;) {
		const res = await client.get<unknown>(MY_NOTES_URL, {
			params: {
				limit: NOTES_PAGE_SIZE,
				...(updatedSince && { updated_since: updatedSince }),
			},
		});
		if (!Array.isArray(res.data)) {
			throw new Error(`GET ${MY_NOTES_URL} returned an unexpected response`);
		}

		const sizeBefore = byId.size;
		for (const row of res.data) {
			if (isNote(row)) byId.set(row.id, row);
		}

		// The cursor comes from the last valid row: a malformed one at the
		// end of a full page must not end paging early.
		const last = res.data.findLast(isNote);
		if (
			res.data.length < NOTES_PAGE_SIZE ||
			byId.size === sizeBefore ||
			!last
		) {
			break;
		}
		updatedSince = cursorBefore(last.updated_at);
	}

	return newestFirst([...byId.values()]);
}

export async function createNote(
	args: PostNoteArgs,
	client: AuthedClient = authedClient(),
): Promise<Note> {
	const res = await client.post<unknown>(NOTES_URL, args);
	return expectNote(res.data, `POST ${NOTES_URL}`);
}

export async function updateNote(
	id: Note["id"],
	patch: PatchNoteArgs,
	client: AuthedClient = authedClient(),
): Promise<Note> {
	const url = `${NOTES_URL}/${id}`;
	const res = await client.patch<unknown>(url, patch);
	return expectNote(res.data, `PATCH ${url}`);
}

// Soft delete: the API keeps a tombstone for syncing clients.
export async function deleteNote(
	id: Note["id"],
	client: AuthedClient = authedClient(),
): Promise<void> {
	await client.delete(`${NOTES_URL}/${id}`);
}

export type MyNotesState = {
	status: "signed-out" | "loading" | "ready" | "error";
	notes: Note[];
};

const SIGNED_OUT: MyNotesState = { status: "signed-out", notes: [] };

export type NoteLookup =
	| { note: Note }
	| { missing: "signed-out" | "not-found" };

// Calls back once the store has settled (not loading) with note `id` or why
// it isn't there; the ?note=<id> link waits on this. Returns a cancel.
export const whenNoteSettles = (
	notes: Readable<MyNotesState>,
	id: Note["id"],
	onSettled: (lookup: NoteLookup) => void,
): (() => void) => {
	let settled = false;
	let stop: (() => void) | undefined;
	stop = notes.subscribe((state) => {
		if (settled || state.status === "loading") return;
		settled = true;
		const note = state.notes.find((n) => n.id === id);
		onSettled(
			note
				? { note }
				: {
						missing: state.status === "signed-out" ? "signed-out" : "not-found",
					},
		);
		// subscribe() calls back before it returns, so `stop` may not be set
		// yet on this first call.
		queueMicrotask(() => stop?.());
	});
	return () => {
		settled = true;
		stop?.();
	};
};

// Follows the session: loads the notes when a token appears or changes,
// empties them on logout. A response for a token that is no longer current
// is dropped, so a slow load can't resurrect notes after logout.
export const createMyNotesStore = (sessions: Readable<Session | null>) => {
	let currentToken: string | null = null;

	const { subscribe, set, update } = writable<MyNotesState>(
		SIGNED_OUT,
		(_set) => {
			const stop = sessions.subscribe((s) => {
				const token = s?.token || null;
				if (token === currentToken) return;
				currentToken = token;
				if (!token) {
					set(SIGNED_OUT);
					return;
				}
				set({ status: "loading", notes: [] });
				// This store follows `sessions` (injected), not the global
				// session the client's stillCurrent() reads, so it keeps its
				// own token check.
				fetchMyNotes(authedClient(token)).then(
					(notes) => {
						if (token === currentToken) set({ status: "ready", notes });
					},
					() => {
						if (token === currentToken) set({ status: "error", notes: [] });
					},
				);
			});
			return () => {
				stop();
				currentToken = null;
			};
		},
	);

	return {
		subscribe,
		// After a successful create or PATCH: replace the note by id or add it.
		upsert: (note: Note) =>
			update((state) => ({
				...state,
				notes: newestFirst([
					...state.notes.filter((n) => n.id !== note.id),
					note,
				]),
			})),
		// After a successful DELETE.
		remove: (id: Note["id"]) =>
			update((state) => ({
				...state,
				notes: state.notes.filter((n) => n.id !== id),
			})),
	};
};

export const myNotes = createMyNotesStore(session);
