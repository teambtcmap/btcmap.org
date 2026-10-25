import type { Readable } from "svelte/store";
import { writable } from "svelte/store";

import { API_BASE } from "#lib/api-base.js";
import { BadResponseError } from "#lib/apiError.js";
import type { AuthedClient } from "#lib/authedApi.js";
import { authedClient } from "#lib/authedApi.js";
import type { Session } from "#lib/session.js";
import { ACCOUNT_CACHE_KEYS, session } from "#lib/session.js";

import type { Note } from "$types/btcmap-api/Note";
import type { PatchNoteArgs } from "$types/btcmap-api/PatchNoteArgs";
import type { PostNoteArgs } from "$types/btcmap-api/PostNoteArgs";

// The signed-in user's personal notes (#1542): free text pinned to a
// coordinate, linked to no place. Only the owner's own notes are loaded;
// other users' public notes are out of scope until the API can moderate them.
//
// Called straight on the btcmap API as the signed-in user (authedApi.ts,
// #1348), like the saved items.
//
// Synced incrementally like the Android app (#1582): the notes and the
// newest updated_at seen are cached in localStorage, and a later load asks
// only for what changed since, tombstones included. Private note text in
// localStorage widens nothing: the Bearer token beside it reads every note.

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
		typeof n.updated_at === "string" &&
		// The sync cursor is built from it
		!Number.isNaN(Date.parse(n.updated_at)) &&
		(n.deleted_at === undefined || typeof n.deleted_at === "string")
	);
};

const expectNote = (data: unknown, call: string): Note => {
	if (!isNote(data))
		throw new BadResponseError(`${call} returned an unexpected response`);
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

export type NotesSnapshot = {
	notes: Note[];
	// The newest updated_at merged from the API; null before the first load.
	cursor: string | null;
};

// By instant, not by string: "…00Z" and "…00.500Z" don't sort as text.
const laterOf = (a: string | null, b: string): string =>
	a !== null && Date.parse(a) >= Date.parse(b) ? a : b;

// Every live note of the client's user, newest first. Without a snapshot it
// loads them all; with one it fetches only the changes since its cursor,
// tombstones included, and merges them in. A user rarely has more than one
// page; the loop is there so a heavy user still gets all of them.
export async function syncMyNotes(
	client: AuthedClient,
	base: NotesSnapshot | null = null,
): Promise<NotesSnapshot> {
	const byId = new Map((base?.notes ?? []).map((n) => [n.id, n]));
	let cursor = base?.cursor ?? null;
	const incremental = cursor !== null;
	let updatedSince = cursor !== null ? cursorBefore(cursor) : undefined;
	const seen = new Set<Note["id"]>();

	for (;;) {
		const res = await client.get<unknown>(MY_NOTES_URL, {
			params: {
				limit: NOTES_PAGE_SIZE,
				...(updatedSince && { updated_since: updatedSince }),
				...(incremental && { include_deleted: true }),
			},
		});
		if (!Array.isArray(res.data)) {
			throw new Error(`GET ${MY_NOTES_URL} returned an unexpected response`);
		}

		const seenBefore = seen.size;
		for (const row of res.data) {
			if (!isNote(row)) continue;
			seen.add(row.id);
			cursor = laterOf(cursor, row.updated_at);
			if (row.deleted_at) byId.delete(row.id);
			else byId.set(row.id, row);
		}

		// The cursor comes from the last valid row: a malformed one at the
		// end of a full page must not end paging early.
		const last = res.data.findLast(isNote);
		if (
			res.data.length < NOTES_PAGE_SIZE ||
			seen.size === seenBefore ||
			!last
		) {
			break;
		}
		updatedSince = cursorBefore(last.updated_at);
	}

	return { notes: newestFirst([...byId.values()]), cursor };
}

// session.logout removes it too, also on pages that never load this module
export const NOTES_CACHE_KEY = ACCOUNT_CACHE_KEYS.notes;

type NotesCache = NotesSnapshot & { username: Session["username"] };

// The cache is read back like an API response: anything off-shape, or
// another account's, counts as no cache.
const readNotesCache = (
	username: Session["username"],
): NotesSnapshot | null => {
	if (typeof localStorage === "undefined") return null;
	try {
		const raw = localStorage.getItem(NOTES_CACHE_KEY);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		if (
			!isRecord(parsed) ||
			parsed.username !== username ||
			typeof parsed.cursor !== "string" ||
			Number.isNaN(Date.parse(parsed.cursor)) ||
			!Array.isArray(parsed.notes) ||
			!parsed.notes.every(isNote)
		) {
			return null;
		}
		return { notes: newestFirst(parsed.notes), cursor: parsed.cursor };
	} catch {
		return null;
	}
};

const writeNotesCache = (cache: NotesCache): void => {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(NOTES_CACHE_KEY, JSON.stringify(cache));
	} catch (error) {
		// Private mode or a full quota only costs the next load a full fetch.
		console.warn("notes: could not cache the notes", error);
	}
};

const clearNotesCache = (): void => {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.removeItem(NOTES_CACHE_KEY);
	} catch {
		// Nothing to do: the next account ignores a cache that isn't its own.
	}
};

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

type NoteChange = (notes: Note[]) => Note[];
// A local write and, for an upsert, the updated_at the API gave it
type LocalWrite = { change: NoteChange; writtenAt?: Note["updated_at"] };

// The sync's answer already holds this upsert, or something newer for the
// note (an edit or delete from another device), when its cursor reached
// the write: replaying it would bring back the older version for good, the
// cursor being past the newer one. Removes always replay: dropping a note
// twice is harmless.
const coveredBy = (write: LocalWrite, snapshot: NotesSnapshot): boolean =>
	write.writtenAt !== undefined &&
	snapshot.cursor !== null &&
	Date.parse(snapshot.cursor) >= Date.parse(write.writtenAt);

// Follows the session: loads the notes when a token appears or changes,
// empties them (and the cache) on logout. A response for a token that is no
// longer current is dropped, so a slow load can't resurrect notes after
// logout. While a load runs, the cached notes already show.
export const createMyNotesStore = (sessions: Readable<Session | null>) => {
	let currentToken: string | null = null;
	// What the cache holds for the signed-in user: the last snapshot from
	// the API, with local upserts and removes applied on top. Local writes
	// never move the cursor, so the next sync still sees edits made
	// elsewhere in between.
	let cache: NotesCache | null = null;
	// Local writes made while a sync is in flight. Its answer may predate
	// them, so they are replayed on top of it instead of being lost.
	let syncWrites: LocalWrite[] | null = null;

	const { subscribe, set, update } = writable<MyNotesState>(
		SIGNED_OUT,
		(_set) => {
			const stop = sessions.subscribe((s) => {
				const token = s?.token || null;
				if (token === currentToken) return;
				currentToken = token;
				if (!s || !token) {
					cache = null;
					syncWrites = null;
					clearNotesCache();
					set(SIGNED_OUT);
					return;
				}
				const { username } = s;
				const cached = readNotesCache(username);
				cache = cached && { ...cached, username };
				set({ status: "loading", notes: cached?.notes ?? [] });
				const writes: LocalWrite[] = [];
				syncWrites = writes;
				// This store follows `sessions` (injected), not the global
				// session the client's stillCurrent() reads, so it keeps its
				// own token check.
				syncMyNotes(authedClient(token), cached).then(
					(snapshot) => {
						if (token !== currentToken) return;
						syncWrites = null;
						const notes = writes
							.filter((write) => !coveredBy(write, snapshot))
							.reduce((n, write) => write.change(n), snapshot.notes);
						cache = { ...snapshot, notes, username };
						if (snapshot.cursor !== null) writeNotesCache(cache);
						set({ status: "ready", notes });
					},
					() => {
						if (token !== currentToken) return;
						syncWrites = null;
						// The cached notes, with any local writes on top
						update((state) => ({ ...state, status: "error" }));
					},
				);
			});
			return () => {
				stop();
				currentToken = null;
				cache = null;
				syncWrites = null;
			};
		},
	);

	const updateNotes = (change: NoteChange, writtenAt?: Note["updated_at"]) => {
		syncWrites?.push({ change, writtenAt });
		update((state) => ({ ...state, notes: change(state.notes) }));
		if (cache?.cursor != null) {
			cache = { ...cache, notes: change(cache.notes) };
			writeNotesCache(cache);
		}
	};

	return {
		subscribe,
		// After a successful create or PATCH: replace the note by id or add it.
		upsert: (note: Note) =>
			updateNotes(
				(notes) =>
					newestFirst([...notes.filter((n) => n.id !== note.id), note]),
				note.updated_at,
			),
		// After a successful DELETE.
		remove: (id: Note["id"]) =>
			updateNotes((notes) => notes.filter((n) => n.id !== id)),
	};
};

export const myNotes = createMyNotesStore(session);
