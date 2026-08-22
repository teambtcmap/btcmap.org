import { get } from "svelte/store";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { paymentDataLoaded, places, verifiedDatesLoaded } from "$lib/store";
import type { Place } from "$lib/types";

vi.mock("$lib/axios", () => ({
	default: { get: vi.fn(), head: vi.fn() },
}));

import api from "$lib/axios";

import { ensurePaymentMethods, ensureVerifiedDates } from "./places";

const mockGet = vi.mocked(api.get);

const row = (id: number, extra: Partial<Place> = {}): Place =>
	({ id, lat: 0, lon: 0, ...extra }) as Place;

// The inert-until-ready contract's producer half: the latch guards below are
// load-bearing — flipping a gate true with no tags merged would hide every
// pin in a payment-filtered embed (the consumer side is pinned in
// visiblePlaces.test.ts). The live-data e2e can never reach these branches.
describe("ensurePaymentMethods", () => {
	beforeEach(() => {
		mockGet.mockReset();
		places.set([]);
		paymentDataLoaded.set(false);
		verifiedDatesLoaded.set(false);
	});

	it("does not latch on a non-array response", async () => {
		places.set([row(1)]);
		mockGet.mockResolvedValue({ data: "<html>error page</html>" });
		await ensurePaymentMethods();
		expect(get(paymentDataLoaded)).toBe(false);
	});

	it("does not latch on an empty response", async () => {
		places.set([row(1)]);
		mockGet.mockResolvedValue({ data: [] });
		await ensurePaymentMethods();
		expect(get(paymentDataLoaded)).toBe(false);
	});

	it("does not latch on rows carrying no payment tags", async () => {
		places.set([row(1)]);
		mockGet.mockResolvedValue({ data: [{ id: 1 }, { id: 2 }] });
		await ensurePaymentMethods();
		expect(get(paymentDataLoaded)).toBe(false);
	});

	it("bails without latching when $places has not loaded yet", async () => {
		mockGet.mockResolvedValue({
			data: [{ id: 1, "osm:payment:lightning": "yes" }],
		});
		await ensurePaymentMethods();
		expect(get(paymentDataLoaded)).toBe(false);
		expect(get(places)).toEqual([]);
	});

	it("does not latch on a failed fetch", async () => {
		places.set([row(1)]);
		mockGet.mockRejectedValue(new Error("network down"));
		await ensurePaymentMethods();
		expect(get(paymentDataLoaded)).toBe(false);
	});

	it("merges tags by id, keeps untagged rows untouched, and latches", async () => {
		places.set([row(1), row(2, { name: "kept" })]);
		mockGet.mockResolvedValue({
			data: [
				{
					id: 1,
					"osm:payment:onchain": "no",
					"osm:payment:lightning": "yes",
				},
			],
		});
		await ensurePaymentMethods();
		expect(get(paymentDataLoaded)).toBe(true);
		const [first, second] = get(places);
		expect(first["osm:payment:lightning"]).toBe("yes");
		// "no" merges too — a row that explicitly refuses a method is data,
		// and the strict === "yes" match handles it downstream.
		expect(first["osm:payment:onchain"]).toBe("no");
		expect(second["osm:payment:lightning"]).toBeUndefined();
		expect(second.name).toBe("kept");
	});

	it("is a no-op once latched", async () => {
		places.set([row(1)]);
		mockGet.mockResolvedValue({
			data: [{ id: 1, "osm:payment:lightning": "yes" }],
		});
		await ensurePaymentMethods();
		await ensurePaymentMethods();
		expect(mockGet).toHaveBeenCalledTimes(1);
	});

	// The combo-deep-link race (?issues&lightning dispatches both enrichers
	// in one flush): each reads the whole $places array and republishes it,
	// so without the enrichment lock the later places.set would erase the
	// earlier merge — a blank filtered embed for the rest of the session.
	it("running concurrently with ensureVerifiedDates keeps both merges", async () => {
		places.set([row(1), row(2)]);
		mockGet.mockImplementation((url: string) => {
			if (url.includes("verified_at")) {
				return Promise.resolve({
					data: [{ id: 1, verified_at: "2026-08-01" }],
				});
			}
			return Promise.resolve({
				data: [{ id: 1, "osm:payment:lightning": "yes" }],
			});
		});
		await Promise.all([ensureVerifiedDates(), ensurePaymentMethods()]);
		expect(get(verifiedDatesLoaded)).toBe(true);
		expect(get(paymentDataLoaded)).toBe(true);
		const [first] = get(places);
		expect(first.verified_at).toBe("2026-08-01");
		expect(first["osm:payment:lightning"]).toBe("yes");
	});
});
