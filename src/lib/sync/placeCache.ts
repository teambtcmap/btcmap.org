import localforage from "localforage";
import { writable } from "svelte/store";

import { places } from "$lib/store";
import type { Place } from "$lib/types";
import { yieldToMain } from "$lib/utils";

// The one owner of the places_v4 blob and the $places write path (#1172).
// Previously three writers (elementsSync, ensureVerifiedDates,
// applyPlaceUpdate) each carried their own persist/publish ordering and
// error semantics, and the hydrate read trusted the blob blindly — the
// exact boundary the #1187 "\n" corruption class exploited.

const BLOB_KEY = "places_v4";
const SYNCED_AT_KEY = "places_v4_synced_at";

// Trust boundary: a row must look like a place before it may enter the
// store or the blob. A non-JSON API body that char-iterated into an array
// (the #1187 class) dies here instead of persisting forever.
const isPlaceRow = (row: unknown): row is Place => {
	if (typeof row !== "object" || row === null) return false;
	const p = row as { id?: unknown; lat?: unknown; lon?: unknown };
	return (
		typeof p.id === "number" &&
		Number.isFinite(p.id) &&
		typeof p.lat === "number" &&
		Number.isFinite(p.lat) &&
		typeof p.lon === "number" &&
		Number.isFinite(p.lon)
	);
};

const sanitizePlaceRows = (rows: unknown, context: string): Place[] | null => {
	if (!Array.isArray(rows)) return null;
	const valid = rows.filter(isPlaceRow);
	if (valid.length !== rows.length) {
		console.warn(
			`placeCache (${context}): dropped ${rows.length - valid.length} invalid rows`,
		);
	}
	return valid;
};

// True once this session has published at least once. Distinguishes "still
// hydrating/downloading" from "legitimately empty" — which $places.length
// alone cannot (the completion-state gap CodeRabbit flagged on #1212).
const published = writable(false);
export const placesPublished = { subscribe: published.subscribe };

// Hydrate read. A corrupt blob (non-array, e.g. a persisted error page)
// reads as null — the same as a cold cache — so the caller re-downloads the
// baseline and the corruption self-heals instead of resurrecting each session.
export const readPlaceCache = async (): Promise<Place[] | null> => {
	const raw = await localforage.getItem<unknown>(BLOB_KEY);
	if (raw == null) return null;
	const rows = sanitizePlaceRows(raw, "hydrate");
	if (rows === null) {
		console.warn("placeCache: blob is not an array — ignoring corrupt cache");
		return null;
	}
	// A non-empty blob whose rows ALL fail validation is corruption in array
	// clothing (the literal #1187 shape: a string char-iterated into an
	// array) — reading it as a warm-but-empty cache would skip the baseline
	// download and strand the session empty. Cold cache; re-download heals.
	if (rows.length === 0 && (raw as unknown[]).length > 0) {
		console.warn("placeCache: no valid rows in blob — ignoring corrupt cache");
		return null;
	}
	return rows;
};

export const readPlacesSyncedAt = (): Promise<string | null> =>
	localforage.getItem<string>(SYNCED_AT_KEY);

export const writePlacesSyncedAt = (iso: string): Promise<string> =>
	localforage.setItem(SYNCED_AT_KEY, iso);

export type PublishResult = { persisted: boolean };

// THE write path: rows are validated, the store ALWAYS updates — the
// session must keep working when IndexedDB is full or broken — and
// persistence is best-effort, reported to the caller so each can apply its
// own error surface (sync toasts placesError; the boost write-through just
// warns).
export const publishPlaces = async (
	rows: Place[],
	opts: { persist?: boolean } = {},
): Promise<PublishResult> => {
	const valid = sanitizePlaceRows(rows, "publish") ?? [];
	// Publish BEFORE persisting: the store must never wait on IndexedDB (a
	// 29k-row blob write can take hundreds of ms, or hang entirely on a
	// broken backend). Yield first so the store update doesn't extend the
	// caller's current long task.
	await yieldToMain();
	places.set(valid);
	published.set(true);
	let persisted = false;
	if (opts.persist !== false) {
		try {
			await localforage.setItem(BLOB_KEY, valid);
			persisted = true;
		} catch (error) {
			console.error("placeCache: could not persist places blob:", error);
		}
	}
	return { persisted };
};
