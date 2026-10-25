import { get, writable } from "svelte/store";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { API_BASE } from "#lib/api-base.js";
import { BadResponseError } from "#lib/apiError.js";
import { authedClient } from "#lib/authedApi.js";
import type { Session } from "#lib/session.js";

import type { MyNotesState } from "./notes";
import {
	createMyNotesStore,
	createNote,
	deleteNote,
	NOTES_CACHE_KEY,
	NOTES_PAGE_SIZE,
	syncMyNotes,
	updateNote,
	whenNoteSettles,
} from "./notes";
import type { Note } from "$types/btcmap-api/Note";

vi.mock("#lib/axios.js", () => ({
	default: {
		get: vi.fn(),
		post: vi.fn(),
		patch: vi.fn(),
		delete: vi.fn(),
	},
}));

const api = vi.mocked((await import("#lib/axios.js")).default);

const note = (id: number, over: Partial<Note> = {}): Note => ({
	id,
	lat: 1,
	lon: 2,
	text: `note ${id}`,
	icon: "notes",
	public: false,
	author: { id: 9, name: "satoshi" },
	created_at: `2026-10-0${id}T00:00:00Z`,
	updated_at: `2026-10-0${id}T00:00:00Z`,
	...over,
});

const auth = { headers: { Authorization: "Bearer tok" } };
// POST and PATCH go out without retries (authedApi.ts)
const authNoRetry = { ...auth, "axios-retry": { retries: 0 } };

beforeEach(() => {
	vi.resetAllMocks();
	localStorage.clear();
});

describe("syncMyNotes", () => {
	it("GETs the caller's notes with the Bearer token, newest first", async () => {
		api.get.mockResolvedValueOnce({ data: [note(1), note(3), note(2)] });

		const { notes } = await syncMyNotes(authedClient("tok"));

		expect(api.get).toHaveBeenCalledWith(`${API_BASE}/v4/users/me/notes`, {
			...auth,
			params: { limit: NOTES_PAGE_SIZE },
		});
		expect(notes.map((n) => n.id)).toEqual([3, 2, 1]);
	});

	it("pages a full batch from just before its last updated_at and drops repeats", async () => {
		// The API pages with a strict `updated_at >` cursor, so a page that
		// ends inside a run of equal timestamps would skip the rest of that
		// run if the next request started at the last row's updated_at.
		const full = Array.from({ length: NOTES_PAGE_SIZE }, (_, i) =>
			note(i + 1, { updated_at: "2026-10-01T00:00:00.500Z" }),
		);
		api.get.mockResolvedValueOnce({ data: full }).mockResolvedValueOnce({
			data: [
				full[NOTES_PAGE_SIZE - 1],
				note(NOTES_PAGE_SIZE + 1, {
					updated_at: "2026-10-01T00:00:00.500Z",
				}),
			],
		});

		const { notes } = await syncMyNotes(authedClient("tok"));

		expect(api.get).toHaveBeenLastCalledWith(`${API_BASE}/v4/users/me/notes`, {
			...auth,
			params: {
				limit: NOTES_PAGE_SIZE,
				updated_since: "2026-10-01T00:00:00.499Z",
			},
		});
		expect(notes).toHaveLength(NOTES_PAGE_SIZE + 1);
	});

	it("stops when a full page brings no new notes", async () => {
		const full = Array.from({ length: NOTES_PAGE_SIZE }, (_, i) =>
			note(i + 1, { updated_at: "2026-10-01T00:00:00Z" }),
		);
		api.get.mockResolvedValue({ data: full });

		const { notes } = await syncMyNotes(authedClient("tok"));

		expect(api.get).toHaveBeenCalledTimes(2);
		expect(notes).toHaveLength(NOTES_PAGE_SIZE);
	});

	it("drops malformed rows instead of trusting the payload", async () => {
		api.get.mockResolvedValueOnce({
			data: [
				note(1),
				{ id: 2 },
				note(3, { lat: "x" as unknown as number }),
				note(4, { author: null as unknown as Note["author"] }),
				note(5, { author: { id: 9 } as unknown as Note["author"] }),
			],
		});

		const { notes } = await syncMyNotes(authedClient("tok"));

		expect(notes.map((n) => n.id)).toEqual([1]);
	});

	it("keeps paging when a full page ends with a malformed row", async () => {
		const full: unknown[] = Array.from(
			{ length: NOTES_PAGE_SIZE - 1 },
			(_, i) => note(i + 1, { updated_at: "2026-10-01T00:00:00.500Z" }),
		);
		full.push({ id: NOTES_PAGE_SIZE });
		api.get.mockResolvedValueOnce({ data: full }).mockResolvedValueOnce({
			data: [
				note(NOTES_PAGE_SIZE + 1, {
					updated_at: "2026-10-02T00:00:00Z",
				}),
			],
		});

		const { notes } = await syncMyNotes(authedClient("tok"));

		expect(api.get).toHaveBeenLastCalledWith(`${API_BASE}/v4/users/me/notes`, {
			...auth,
			params: {
				limit: NOTES_PAGE_SIZE,
				updated_since: "2026-10-01T00:00:00.499Z",
			},
		});
		expect(notes).toHaveLength(NOTES_PAGE_SIZE);
	});

	it("rejects a response that is not an array", async () => {
		api.get.mockResolvedValueOnce({ data: "<html>" });

		await expect(syncMyNotes(authedClient("tok"))).rejects.toThrow();
	});

	it("returns the latest updated_at as the cursor", async () => {
		api.get.mockResolvedValueOnce({ data: [note(1), note(3), note(2)] });

		const { cursor } = await syncMyNotes(authedClient("tok"));

		expect(cursor).toBe("2026-10-03T00:00:00Z");
	});

	it("asks only for changes and tombstones since the snapshot's cursor", async () => {
		api.get.mockResolvedValueOnce({
			data: [
				note(2, { text: "edited", updated_at: "2026-10-05T00:00:00Z" }),
				note(1, {
					updated_at: "2026-10-06T00:00:00Z",
					deleted_at: "2026-10-06T00:00:00Z",
				}),
				note(4),
			],
		});

		const snapshot = await syncMyNotes(authedClient("tok"), {
			notes: [note(2), note(1)],
			cursor: "2026-10-02T00:00:00Z",
		});

		expect(api.get).toHaveBeenCalledWith(`${API_BASE}/v4/users/me/notes`, {
			...auth,
			params: {
				limit: NOTES_PAGE_SIZE,
				updated_since: "2026-10-01T23:59:59.999Z",
				include_deleted: true,
			},
		});
		expect(snapshot.notes.map((n) => [n.id, n.text])).toEqual([
			[4, "note 4"],
			[2, "edited"],
		]);
		expect(snapshot.cursor).toBe("2026-10-06T00:00:00Z");
	});

	it("compares cursor timestamps as instants, not as text", async () => {
		api.get.mockResolvedValueOnce({
			data: [note(1, { updated_at: "2026-10-01T00:00:00.500Z" })],
		});

		const { cursor } = await syncMyNotes(authedClient("tok"), {
			notes: [],
			cursor: "2026-10-01T00:00:00Z",
		});

		expect(cursor).toBe("2026-10-01T00:00:00.500Z");
	});

	it("keeps the snapshot's cursor when nothing changed", async () => {
		api.get.mockResolvedValueOnce({ data: [] });
		const base = { notes: [note(1)], cursor: "2026-10-01T00:00:00Z" };

		expect(await syncMyNotes(authedClient("tok"), base)).toEqual(base);
	});

	it("stops when a full page of changes only repeats rows it already saw", async () => {
		const full = Array.from({ length: NOTES_PAGE_SIZE }, (_, i) =>
			note(i + 1, { updated_at: "2026-10-01T00:00:00Z" }),
		);
		api.get.mockResolvedValue({ data: full });

		await syncMyNotes(authedClient("tok"), {
			notes: full,
			cursor: "2026-09-01T00:00:00Z",
		});

		expect(api.get).toHaveBeenCalledTimes(2);
	});

	it("drops a row whose updated_at is not a date", async () => {
		api.get.mockResolvedValueOnce({
			data: [note(1), note(2, { updated_at: "garbage" })],
		});

		const snapshot = await syncMyNotes(authedClient("tok"));

		expect(snapshot).toEqual({
			notes: [note(1)],
			cursor: "2026-10-01T00:00:00Z",
		});
	});

	it("drops a row whose deleted_at is not a string", async () => {
		api.get.mockResolvedValueOnce({
			data: [note(2, { deleted_at: 1 as unknown as string })],
		});

		const { notes } = await syncMyNotes(authedClient("tok"), {
			notes: [note(2)],
			cursor: "2026-10-02T00:00:00Z",
		});

		expect(notes).toEqual([note(2)]);
	});
});

describe("createNote", () => {
	it("POSTs the args and returns the created note", async () => {
		api.post.mockResolvedValueOnce({ data: note(4) });
		const args = { lat: 1, lon: 2, text: "hi", icon: "atm", public: false };

		const created = await createNote(args, authedClient("tok"));

		expect(api.post).toHaveBeenCalledWith(
			`${API_BASE}/v4/notes`,
			args,
			authNoRetry,
		);
		expect(created.id).toBe(4);
	});

	it("rejects an unexpected response as a bad response", async () => {
		api.post.mockResolvedValueOnce({ data: "" });

		await expect(
			createNote(
				{ lat: 1, lon: 2, text: "hi", public: false },
				authedClient("tok"),
			),
		).rejects.toBeInstanceOf(BadResponseError);
	});
});

describe("updateNote", () => {
	it("PATCHes only the given fields", async () => {
		api.patch.mockResolvedValueOnce({ data: note(5, { public: true }) });

		const updated = await updateNote(5, { public: true }, authedClient("tok"));

		expect(api.patch).toHaveBeenCalledWith(
			`${API_BASE}/v4/notes/5`,
			{ public: true },
			authNoRetry,
		);
		expect(updated.public).toBe(true);
	});
});

describe("deleteNote", () => {
	it("DELETEs the note", async () => {
		api.delete.mockResolvedValueOnce({ data: "" });

		await deleteNote(6, authedClient("tok"));

		expect(api.delete).toHaveBeenCalledWith(`${API_BASE}/v4/notes/6`, auth);
	});
});

const session = (token: string): Session => ({
	username: "satoshi",
	token,
	savedPlaces: [],
	savedAreas: [],
	npub: null,
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createMyNotesStore", () => {
	it("loads the notes when a session appears and clears them on logout", async () => {
		api.get.mockResolvedValueOnce({ data: [note(1)] });
		const sessions = writable<Session | null>(null);
		const store = createMyNotesStore(sessions);
		const stop = store.subscribe(() => {});

		expect(get(store)).toEqual({ status: "signed-out", notes: [] });

		sessions.set(session("tok"));
		expect(get(store).status).toBe("loading");
		await flush();
		expect(get(store)).toEqual({ status: "ready", notes: [note(1)] });

		sessions.set(null);
		expect(get(store)).toEqual({ status: "signed-out", notes: [] });
		stop();
	});

	it("does not refetch when the session changes but the token does not", async () => {
		api.get.mockResolvedValue({ data: [] });
		const sessions = writable<Session | null>(session("tok"));
		const store = createMyNotesStore(sessions);
		const stop = store.subscribe(() => {});
		await flush();

		sessions.set({ ...session("tok"), savedPlaces: [1] });
		await flush();

		expect(api.get).toHaveBeenCalledTimes(1);
		stop();
	});

	it("ignores a response that lands after the user logged out", async () => {
		let resolve: (value: { data: Note[] }) => void = () => {};
		api.get.mockReturnValueOnce(
			new Promise((r) => {
				resolve = r;
			}),
		);
		const sessions = writable<Session | null>(session("tok"));
		const store = createMyNotesStore(sessions);
		const stop = store.subscribe(() => {});

		sessions.set(null);
		resolve({ data: [note(1)] });
		await flush();

		expect(get(store)).toEqual({ status: "signed-out", notes: [] });
		stop();
	});

	it("reports a failed load as an error with no notes", async () => {
		api.get.mockRejectedValueOnce(new Error("offline"));
		const sessions = writable<Session | null>(session("tok"));
		const store = createMyNotesStore(sessions);
		const stop = store.subscribe(() => {});
		await flush();

		expect(get(store)).toEqual({ status: "error", notes: [] });
		stop();
	});

	it("shows cached notes while it fetches only what changed since", async () => {
		localStorage.setItem(
			NOTES_CACHE_KEY,
			JSON.stringify({
				username: "satoshi",
				cursor: "2026-10-02T00:00:00Z",
				notes: [note(2), note(1)],
			}),
		);
		api.get.mockResolvedValueOnce({
			data: [
				note(1, {
					updated_at: "2026-10-03T00:00:00Z",
					deleted_at: "2026-10-03T00:00:00Z",
				}),
			],
		});
		const sessions = writable<Session | null>(session("tok"));
		const store = createMyNotesStore(sessions);
		const stop = store.subscribe(() => {});

		expect(get(store)).toEqual({
			status: "loading",
			notes: [note(2), note(1)],
		});
		expect(api.get.mock.calls[0][1]?.params).toMatchObject({
			include_deleted: true,
		});
		await flush();

		expect(get(store)).toEqual({ status: "ready", notes: [note(2)] });
		expect(JSON.parse(localStorage.getItem(NOTES_CACHE_KEY) ?? "")).toEqual({
			username: "satoshi",
			cursor: "2026-10-03T00:00:00Z",
			notes: [note(2)],
		});
		stop();
	});

	it("ignores a cache that belongs to another account or is corrupt", async () => {
		for (const cached of [
			JSON.stringify({ username: "hal", cursor: "x", notes: [note(1)] }),
			JSON.stringify({ username: "satoshi", cursor: 5, notes: [] }),
			JSON.stringify({ username: "satoshi", cursor: "x", notes: [] }),
			JSON.stringify({
				username: "satoshi",
				cursor: "2026-10-01T00:00:00Z",
				notes: [{}],
			}),
			"\n",
		]) {
			localStorage.setItem(NOTES_CACHE_KEY, cached);
			api.get.mockResolvedValueOnce({ data: [note(3)] });
			const store = createMyNotesStore(writable(session("tok")));
			const stop = store.subscribe(() => {});

			expect(get(store)).toEqual({ status: "loading", notes: [] });
			expect(api.get.mock.lastCall?.[1]?.params).toEqual({
				limit: NOTES_PAGE_SIZE,
			});
			await flush();
			expect(get(store).notes).toEqual([note(3)]);
			stop();
		}
	});

	it("keeps the cached notes when the refresh fails", async () => {
		localStorage.setItem(
			NOTES_CACHE_KEY,
			JSON.stringify({
				username: "satoshi",
				cursor: "2026-10-01T00:00:00Z",
				notes: [note(1)],
			}),
		);
		api.get.mockRejectedValueOnce(new Error("offline"));
		const store = createMyNotesStore(writable(session("tok")));
		const stop = store.subscribe(() => {});
		await flush();

		expect(get(store)).toEqual({ status: "error", notes: [note(1)] });
		stop();
	});

	it("clears the cache on logout", async () => {
		api.get.mockResolvedValueOnce({ data: [note(1)] });
		const sessions = writable<Session | null>(session("tok"));
		const store = createMyNotesStore(sessions);
		const stop = store.subscribe(() => {});
		await flush();
		expect(localStorage.getItem(NOTES_CACHE_KEY)).not.toBeNull();

		sessions.set(null);

		expect(localStorage.getItem(NOTES_CACHE_KEY)).toBeNull();
		stop();
	});

	it("caches local upserts and removes without moving the cursor", async () => {
		api.get.mockResolvedValueOnce({ data: [note(1)] });
		const store = createMyNotesStore(writable(session("tok")));
		const stop = store.subscribe(() => {});
		await flush();

		store.upsert(note(2, { updated_at: "2026-10-09T00:00:00Z" }));
		store.remove(1);

		// A later edit on another device sits between the cursor and the
		// upserted note's updated_at, so the cursor must not jump forward.
		expect(JSON.parse(localStorage.getItem(NOTES_CACHE_KEY) ?? "")).toEqual({
			username: "satoshi",
			cursor: "2026-10-01T00:00:00Z",
			notes: [note(2, { updated_at: "2026-10-09T00:00:00Z" })],
		});
		stop();
	});

	it("keeps local writes made while the sync was in flight", async () => {
		let resolve: (value: { data: Note[] }) => void = () => {};
		api.get.mockReturnValueOnce(
			new Promise((r) => {
				resolve = r;
			}),
		);
		const store = createMyNotesStore(writable(session("tok")));
		const stop = store.subscribe(() => {});

		// The GET was answered before these writes reached the API
		store.upsert(note(5));
		store.remove(2);
		resolve({ data: [note(1), note(2)] });
		await flush();

		expect(get(store)).toEqual({
			status: "ready",
			notes: [note(5), note(1)],
		});
		expect(
			JSON.parse(localStorage.getItem(NOTES_CACHE_KEY) ?? "").notes,
		).toEqual([note(5), note(1)]);
		stop();
	});

	it("doesn't replay a local edit the sync's answer already covers", async () => {
		localStorage.setItem(
			NOTES_CACHE_KEY,
			JSON.stringify({
				username: "satoshi",
				cursor: "2026-10-03T00:00:00Z",
				notes: [note(3), note(2), note(1)],
			}),
		);
		let resolve: (value: { data: Note[] }) => void = () => {};
		api.get.mockReturnValueOnce(
			new Promise((r) => {
				resolve = r;
			}),
		);
		const store = createMyNotesStore(writable(session("tok")));
		const stop = store.subscribe(() => {});

		// The GET was answered after these local writes, and after another
		// device edited note 2 and deleted note 3 on top of them
		store.upsert(note(2, { text: "here", updated_at: "2026-10-05T00:00:00Z" }));
		store.upsert(note(3, { text: "here", updated_at: "2026-10-05T00:00:00Z" }));
		resolve({
			data: [
				note(2, { text: "elsewhere", updated_at: "2026-10-06T00:00:00Z" }),
				note(3, {
					updated_at: "2026-10-06T00:00:00Z",
					deleted_at: "2026-10-06T00:00:00Z",
				}),
			],
		});
		await flush();

		expect(get(store).notes.map((n) => [n.id, n.text])).toEqual([
			[2, "elsewhere"],
			[1, "note 1"],
		]);
		expect(
			JSON.parse(localStorage.getItem(NOTES_CACHE_KEY) ?? "").notes,
		).toEqual(get(store).notes);
		stop();
	});

	it("keeps local writes when the refresh fails", async () => {
		localStorage.setItem(
			NOTES_CACHE_KEY,
			JSON.stringify({
				username: "satoshi",
				cursor: "2026-10-01T00:00:00Z",
				notes: [note(1)],
			}),
		);
		let reject: (error: Error) => void = () => {};
		api.get.mockReturnValueOnce(
			new Promise((_r, j) => {
				reject = j;
			}),
		);
		const store = createMyNotesStore(writable(session("tok")));
		const stop = store.subscribe(() => {});

		store.upsert(note(5));
		reject(new Error("offline"));
		await flush();

		expect(get(store)).toEqual({
			status: "error",
			notes: [note(5), note(1)],
		});
		stop();
	});

	it("upserts and removes notes locally, keeping newest first", async () => {
		api.get.mockResolvedValueOnce({ data: [note(1)] });
		const sessions = writable<Session | null>(session("tok"));
		const store = createMyNotesStore(sessions);
		const stop = store.subscribe(() => {});
		await flush();

		store.upsert(note(2));
		store.upsert(note(1, { text: "edited" }));
		expect(get(store).notes.map((n) => [n.id, n.text])).toEqual([
			[2, "note 2"],
			[1, "edited"],
		]);

		store.remove(2);
		expect(get(store).notes.map((n) => n.id)).toEqual([1]);
		stop();
	});
});

describe("whenNoteSettles", () => {
	const state = (
		status: MyNotesState["status"],
		notes: Note[] = [],
	): MyNotesState => ({ status, notes });

	it("waits out loading, then hands over the note", () => {
		const store = writable(state("loading"));
		const onSettled = vi.fn();

		whenNoteSettles(store, 2, onSettled);
		expect(onSettled).not.toHaveBeenCalled();

		store.set(state("ready", [note(1), note(2)]));
		expect(onSettled).toHaveBeenCalledExactlyOnceWith({ note: note(2) });
	});

	it("reports why a note can't be shown", () => {
		const signedOut = vi.fn();
		whenNoteSettles(writable(state("signed-out")), 2, signedOut);
		expect(signedOut).toHaveBeenCalledWith({ missing: "signed-out" });

		const notFound = vi.fn();
		whenNoteSettles(writable(state("ready", [note(1)])), 2, notFound);
		expect(notFound).toHaveBeenCalledWith({ missing: "not-found" });

		const failed = vi.fn();
		whenNoteSettles(writable(state("error")), 2, failed);
		expect(failed).toHaveBeenCalledWith({ missing: "not-found" });
	});

	it("settles once and stops listening", () => {
		const store = writable(state("ready", [note(1)]));
		const onSettled = vi.fn();

		whenNoteSettles(store, 1, onSettled);
		store.set(state("loading"));
		store.set(state("ready", [note(1)]));

		expect(onSettled).toHaveBeenCalledOnce();
	});

	it("does nothing once cancelled", () => {
		const store = writable(state("loading"));
		const onSettled = vi.fn();

		const cancel = whenNoteSettles(store, 1, onSettled);
		cancel();
		store.set(state("ready", [note(1)]));

		expect(onSettled).not.toHaveBeenCalled();
	});
});
