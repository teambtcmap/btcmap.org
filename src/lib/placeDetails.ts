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
	}

	let pending = inFlight.get(id);
	if (!pending) {
		pending = api
			.get<Place>(completePlaceUrl(id), { timeout: DETAILS_TIMEOUT_MS })
			.then((response) => {
				const place = response.data;
				// A non-JSON upstream response (HTML error page, truncated body)
				// must not enter the cache — it would poison every consumer for
				// the rest of the session.
				if (typeof place?.id !== "number") {
					throw new Error(`Invalid place details response for ${id}`);
				}
				detailsCache.set(id, place);
				return place;
			})
			.finally(() => {
				inFlight.delete(id);
			});
		inFlight.set(id, pending);
	}

	return withAbort(pending, opts.signal);
};

// Write-through hooks for sync/places.ts: after a boost/comment refresh lands
// the fresh complete record in $places, keep this cache coherent too.
export const primePlaceDetails = (place: Place): void => {
	detailsCache.set(place.id, place);
};

export const evictPlaceDetails = (id: number): void => {
	detailsCache.delete(id);
};
