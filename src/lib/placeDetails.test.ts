import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Place } from "$lib/types";

import {
	completePlaceUrl,
	DETAIL_FIELDS,
	evictPlaceDetails,
	getPlaceDetails,
	hasDetailFields,
	primePlaceDetails,
} from "./placeDetails";

vi.mock("$lib/axios", () => ({
	default: { get: vi.fn() },
}));

import api from "$lib/axios";

const mockGet = vi.mocked(api.get);

const makePlace = (overrides: Partial<Place> = {}): Place =>
	({
		id: 1,
		lat: 0,
		lon: 0,
		icon: "store",
		name: "Test Place",
		address: "1 Test St",
		verified_at: "2026-01-01",
		...overrides,
	}) as Place;

beforeEach(() => {
	mockGet.mockReset();
	// The module cache is shared across tests — evict the ids used below
	for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
		evictPlaceDetails(id);
	}
});

describe("completePlaceUrl", () => {
	it("builds the v4 complete-place URL for numeric ids", () => {
		const url = completePlaceUrl(123);
		expect(url).toContain("/v4/places/123?fields=");
		expect(url).not.toContain("include_deleted");
	});

	it("percent-encodes OSM-style string ids", () => {
		expect(completePlaceUrl("node:456")).toContain("/v4/places/node%3A456");
	});

	it("appends include_deleted when requested", () => {
		expect(completePlaceUrl(123, { includeDeleted: true })).toContain(
			"&include_deleted=true",
		);
	});
});

describe("hasDetailFields", () => {
	it("rejects null and undefined", () => {
		expect(hasDetailFields(undefined, DETAIL_FIELDS.drawer)).toBe(false);
		expect(hasDetailFields(null, DETAIL_FIELDS.drawer)).toBe(false);
	});

	it("requires every field in the set", () => {
		const noVerified = makePlace({ verified_at: undefined });
		expect(hasDetailFields(noVerified, DETAIL_FIELDS.drawer)).toBe(false);
		// The card set doesn't care about verified_at
		expect(hasDetailFields(noVerified, DETAIL_FIELDS.card)).toBe(true);
	});

	it("accepts a place with all required fields", () => {
		expect(hasDetailFields(makePlace(), DETAIL_FIELDS.drawer)).toBe(true);
	});
});

describe("getPlaceDetails", () => {
	it("fetches once and serves repeats from the cache", async () => {
		const place = makePlace({ id: 1 });
		mockGet.mockResolvedValue({ data: place });

		expect(await getPlaceDetails(1)).toEqual(place);
		expect(await getPlaceDetails(1)).toEqual(place);
		expect(mockGet).toHaveBeenCalledTimes(1);
	});

	it("shares one network call between concurrent consumers", async () => {
		const place = makePlace({ id: 2 });
		let resolveFetch: (value: { data: Place }) => void = () => {};
		mockGet.mockReturnValue(
			new Promise((resolve) => {
				resolveFetch = resolve;
			}),
		);

		const first = getPlaceDetails(2);
		const second = getPlaceDetails(2);
		resolveFetch({ data: place });

		expect(await first).toEqual(place);
		expect(await second).toEqual(place);
		expect(mockGet).toHaveBeenCalledTimes(1);
	});

	it("bypasses the cache with fresh: true", async () => {
		const stale = makePlace({ id: 3 });
		const updated = makePlace({ id: 3, name: "Renamed" });
		mockGet.mockResolvedValueOnce({ data: stale });
		await getPlaceDetails(3);

		mockGet.mockResolvedValueOnce({ data: updated });
		expect(await getPlaceDetails(3, { fresh: true })).toEqual(updated);
		expect(mockGet).toHaveBeenCalledTimes(2);
		// And the fresh result replaces the cached one
		expect(await getPlaceDetails(3)).toEqual(updated);
		expect(mockGet).toHaveBeenCalledTimes(2);
	});

	it("detaches an aborting caller without killing the shared fetch", async () => {
		const place = makePlace({ id: 4 });
		let resolveFetch: (value: { data: Place }) => void = () => {};
		mockGet.mockReturnValue(
			new Promise((resolve) => {
				resolveFetch = resolve;
			}),
		);

		const controller = new AbortController();
		const aborting = getPlaceDetails(4, { signal: controller.signal });
		const surviving = getPlaceDetails(4);
		controller.abort();

		await expect(aborting).rejects.toSatisfy((err) => axios.isCancel(err));

		resolveFetch({ data: place });
		// The other consumer still resolves, and the cache is filled
		expect(await surviving).toEqual(place);
		expect(await getPlaceDetails(4)).toEqual(place);
		expect(mockGet).toHaveBeenCalledTimes(1);
	});

	it("rejects immediately on an already-aborted signal", async () => {
		const controller = new AbortController();
		controller.abort();
		await expect(
			getPlaceDetails(5, { signal: controller.signal }),
		).rejects.toSatisfy((err) => axios.isCancel(err));
		expect(mockGet).not.toHaveBeenCalled();
	});

	it("does not cache failures — the next call retries", async () => {
		mockGet.mockRejectedValueOnce(new Error("network down"));
		await expect(getPlaceDetails(6)).rejects.toThrow("network down");

		const place = makePlace({ id: 6 });
		mockGet.mockResolvedValueOnce({ data: place });
		expect(await getPlaceDetails(6)).toEqual(place);
		expect(mockGet).toHaveBeenCalledTimes(2);
	});

	it("rejects a non-place response body instead of caching it", async () => {
		// The "\n" corruption class: an HTML error page served with 200
		mockGet.mockResolvedValueOnce({ data: "<html>maintenance</html>" });
		await expect(getPlaceDetails(7)).rejects.toThrow(
			"Invalid place details response",
		);

		const place = makePlace({ id: 7 });
		mockGet.mockResolvedValueOnce({ data: place });
		expect(await getPlaceDetails(7)).toEqual(place);
	});

	it("never lets a late in-flight response overwrite a fresher primed record", async () => {
		// The boost race: a GET the server answered pre-commit settles AFTER
		// the payment write-through primed the boosted record. The stale
		// response must not revert the cache.
		let resolveFetch: (value: { data: Place }) => void = () => {};
		mockGet.mockReturnValue(
			new Promise((resolve) => {
				resolveFetch = resolve;
			}),
		);
		const inFlightPromise = getPlaceDetails(9);

		const boosted = makePlace({ id: 9, name: "Boosted" });
		primePlaceDetails(boosted);

		resolveFetch({ data: makePlace({ id: 9, name: "Pre-boost" }) });
		// The caller still receives what the network returned…
		expect((await inFlightPromise).name).toBe("Pre-boost");
		// …but the cache keeps the fresher primed record
		expect(await getPlaceDetails(9)).toEqual(boosted);
		expect(mockGet).toHaveBeenCalledTimes(1);
	});

	it("fresh: true dispatches a new request instead of joining a pending one", async () => {
		let resolveStale: (value: { data: Place }) => void = () => {};
		mockGet.mockReturnValueOnce(
			new Promise((resolve) => {
				resolveStale = resolve;
			}),
		);
		const stalePending = getPlaceDetails(2);

		const updated = makePlace({ id: 2, name: "Updated" });
		mockGet.mockResolvedValueOnce({ data: updated });
		const freshResult = await getPlaceDetails(2, { fresh: true });
		expect(freshResult).toEqual(updated);
		expect(mockGet).toHaveBeenCalledTimes(2);

		// The abandoned request settles late and must not clobber the cache
		resolveStale({ data: makePlace({ id: 2, name: "Stale" }) });
		await stalePending;
		expect(await getPlaceDetails(2)).toEqual(updated);
	});

	it("serves a primed record and stops after eviction", async () => {
		const place = makePlace({ id: 8 });
		primePlaceDetails(place);
		expect(await getPlaceDetails(8)).toEqual(place);
		expect(mockGet).not.toHaveBeenCalled();

		evictPlaceDetails(8);
		const refetched = makePlace({ id: 8, name: "Refetched" });
		mockGet.mockResolvedValueOnce({ data: refetched });
		expect(await getPlaceDetails(8)).toEqual(refetched);
		expect(mockGet).toHaveBeenCalledTimes(1);
	});
});
