import { CanceledError } from "axios";

import { API_BASE } from "$lib/api-base";
import { buildFieldsParam, PLACE_FIELD_SETS } from "$lib/api-fields";
import api from "$lib/axios";
import type { Place } from "$lib/types";

// The one URL for "the complete record of place X", shared by every fetcher —
// client and SSR. Accepts numeric Place ids and OSM-style "type:id" strings
// (the encode keeps ':' safe either way). include_deleted is the SSR merchant
// page's concern: deleted places must return full field data, not id-only.
export const completePlaceUrl = (
	id: number | string,
	opts: { includeDeleted?: boolean } = {},
): string => {
	const url = `${API_BASE}/v4/places/${encodeURIComponent(id)}?fields=${buildFieldsParam(PLACE_FIELD_SETS.COMPLETE_PLACE)}`;
	return opts.includeDeleted ? `${url}&include_deleted=true` : url;
};

// What each consumer needs before it can skip the network. Bulk-feed rows in
// $places carry only the map fields, so "is this row enough?" depends on who
// is asking: the merchant drawers render the verify banner, the area card
// only its header and address line.
export const DETAIL_FIELDS = {
	drawer: ["name", "address", "verified_at"],
	card: ["name", "address"],
} as const satisfies Record<string, readonly (keyof Place)[]>;

export const hasDetailFields = (
	place: Place | undefined | null,
	fields: readonly (keyof Place)[],
): place is Place => !!place && fields.every((key) => place[key] !== undefined);

const DETAILS_TIMEOUT_MS = 10000;

// Details land in this module cache keyed by place id — NEVER in $places:
// writing a drawer-open fetch into $places would rebuild the 50k-row map
// pipeline per open. In-flight requests are shared, so two consumers asking
// for the same id race a single network call.
const detailsCache = new Map<number, Place>();
const inFlight = new Map<number, Promise<Place>>();

// A caller's abort detaches that caller only — the shared request keeps going
// and still fills the cache for whoever asks next. Rejection uses axios's
// CanceledError so existing axios.isCancel() guards recognize it.
const withAbort = <T>(
	promise: Promise<T>,
	signal?: AbortSignal,
): Promise<T> => {
	if (!signal) return promise;
	if (signal.aborted) return Promise.reject(new CanceledError("canceled"));
	return new Promise<T>((resolve, reject) => {
		const onAbort = () => reject(new CanceledError("canceled"));
		signal.addEventListener("abort", onAbort, { once: true });
		promise.then(
			(value) => {
				signal.removeEventListener("abort", onAbort);
				resolve(value);
			},
			(err) => {
				signal.removeEventListener("abort", onAbort);
				reject(err);
			},
		);
	});
};

// Per-id monotonic generation. Bumped whenever something invalidates what is
// currently cached or in flight: a fresh-record prime, an eviction, or a
// caller demanding fresh data. A response only writes the cache if the
// generation it was dispatched under is still current — so a late-arriving
// response the server answered before a boost committed can never overwrite
// the fresher record the write-through primed.
const generations = new Map<number, number>();

const bumpGeneration = (id: number): number => {
	const next = (generations.get(id) ?? 0) + 1;
	generations.set(id, next);
	return next;
};

export const getPlaceDetails = (
	id: number,
	opts: { signal?: AbortSignal; fresh?: boolean } = {},
): Promise<Place> => {
	// An already-cancelled caller must not trigger a network call
	if (opts.signal?.aborted) {
		return Promise.reject(new CanceledError("canceled"));
	}

	if (!opts.fresh) {
		const cached = detailsCache.get(id);
		if (cached) return Promise.resolve(cached);
	} else {
		// fresh means "hit the network NOW": invalidate the cached record's
		// generation and abandon any pending request — joining one dispatched
		// earlier could hand back exactly the staleness the caller opted out of
		bumpGeneration(id);
		inFlight.delete(id);
	}

	let pending = inFlight.get(id);
	if (!pending) {
		const dispatchedGeneration = generations.get(id) ?? 0;
		const request = api
			.get<Place>(completePlaceUrl(id), { timeout: DETAILS_TIMEOUT_MS })
			.then((response) => {
				const place = response.data;
				// A non-JSON upstream response (HTML error page, truncated body)
				// must not enter the cache — it would poison every consumer for
				// the rest of the session.
				if (typeof place?.id !== "number") {
					throw new Error(`Invalid place details response for ${id}`);
				}
				if ((generations.get(id) ?? 0) === dispatchedGeneration) {
					detailsCache.set(id, place);
				}
				return place;
			})
			.finally(() => {
				// A fresh dispatch may have replaced this entry already —
				// only clear the slot if it is still ours
				if (inFlight.get(id) === request) {
					inFlight.delete(id);
				}
			});
		pending = request;
		inFlight.set(id, pending);
	}

	return withAbort(pending, opts.signal);
};

// Write-through hooks for sync/places.ts: after a boost/comment refresh lands
// the fresh complete record in $places, keep this cache coherent too. The
// generation bump makes the prime authoritative over any response still in
// flight.
export const primePlaceDetails = (place: Place): void => {
	bumpGeneration(place.id);
	detailsCache.set(place.id, place);
};

export const evictPlaceDetails = (id: number): void => {
	bumpGeneration(id);
	detailsCache.delete(id);
};
