import { get } from "svelte/store";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { paymentTagsLoaded, places, verifiedDatesLoaded } from "$lib/store";
import type { Place } from "$lib/types";

vi.mock("$lib/axios", () => ({
	default: { get: vi.fn(), head: vi.fn() },
}));

import api from "$lib/axios";

import {
	applyEnrichmentCaches,
	ensurePaymentMethods,
	ensureVerifiedDates,
} from "./places";

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
		paymentTagsLoaded.set(false);
		verifiedDatesLoaded.set(false);
	});

	it("does not latch on a non-array response", async () => {
		places.set([row(1)]);
		mockGet.mockResolvedValue({ data: "<html>error page</html>" });
		await ensurePaymentMethods();
		expect(get(paymentTagsLoaded)).toBe(false);
	});

	it("does not latch on an empty response", async () => {
		places.set([row(1)]);
		mockGet.mockResolvedValue({ data: [] });
		await ensurePaymentMethods();
		expect(get(paymentTagsLoaded)).toBe(false);
	});

	it("does not latch on id-only rows carrying no tags", async () => {
		// e.g. the fields param silently ignored upstream: latching here
		// would activate the filter with nothing to match — and the clearing
		// merge would strip every cached tag on top.
		places.set([row(1, { "osm:payment:lightning": "yes" })]);
		mockGet.mockResolvedValue({ data: [{ id: 1 }, { id: 2 }] });
		await ensurePaymentMethods();
		expect(get(paymentTagsLoaded)).toBe(false);
		expect(get(places)[0]["osm:payment:lightning"]).toBe("yes");
	});

	it("bails without latching when $places has not loaded yet", async () => {
		mockGet.mockResolvedValue({
			data: [{ id: 1, "osm:payment:lightning": "yes" }],
		});
		await ensurePaymentMethods();
		expect(get(paymentTagsLoaded)).toBe(false);
		expect(get(places)).toEqual([]);
	});

	it("does not latch on a failed fetch", async () => {
		places.set([row(1)]);
		mockGet.mockRejectedValue(new Error("network down"));
		await ensurePaymentMethods();
		expect(get(paymentTagsLoaded)).toBe(false);
	});

	it("merges tags by id, keeps unlisted rows untouched, and latches", async () => {
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
		expect(get(paymentTagsLoaded)).toBe(true);
		const [first, second] = get(places);
		expect(first["osm:payment:lightning"]).toBe("yes");
		// "no" merges too — a row that explicitly refuses a method is data,
		// and the strict === "yes" match handles it downstream.
		expect(first["osm:payment:onchain"]).toBe("no");
		expect(second["osm:payment:lightning"]).toBeUndefined();
		expect(second.name).toBe("kept");
	});

	it("clears a stale tag the response no longer carries", async () => {
		// A previous session persisted lightning=yes; the tag has since been
		// removed in OSM. The fresh response's id-row without the field must
		// clear it, or the place stays inside a filtered embed forever.
		places.set([
			row(1, { "osm:payment:lightning": "yes" }),
			row(2, { "osm:payment:lightning": "yes" }),
		]);
		mockGet.mockResolvedValue({
			data: [{ id: 1 }, { id: 2, "osm:payment:onchain": "yes" }],
		});
		await ensurePaymentMethods();
		expect(get(paymentTagsLoaded)).toBe(true);
		const [first, second] = get(places);
		expect(first["osm:payment:lightning"]).toBeUndefined();
		expect(second["osm:payment:lightning"]).toBeUndefined();
		expect(second["osm:payment:onchain"]).toBe("yes");
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
		expect(get(paymentTagsLoaded)).toBe(true);
		const [first] = get(places);
		expect(first.verified_at).toBe("2026-08-01");
		expect(first["osm:payment:lightning"]).toBe("yes");
	});
});

// The bulk-republish fill-in: elementsSync rebuilds rows from the disk cache
// or the CDN baseline (neither carries enrichment when persistence is
// broken — routine for iframe embeds), so once a flag has latched the sync
// path re-applies the session's cached enrichment before publishing.
describe("applyEnrichmentCaches", () => {
	beforeEach(() => {
		mockGet.mockReset();
		places.set([]);
		paymentTagsLoaded.set(false);
		verifiedDatesLoaded.set(false);
	});

	const latchBoth = async () => {
		places.set([row(1), row(2)]);
		mockGet.mockImplementation((url: string) => {
			if (url.includes("verified_at")) {
				return Promise.resolve({
					data: [{ id: 1, verified_at: "2026-08-01" }],
				});
			}
			return Promise.resolve({
				data: [
					{
						id: 1,
						"osm:payment:lightning": "yes",
						"osm:payment:onchain": "no",
					},
				],
			});
		});
		await ensureVerifiedDates();
		await ensurePaymentMethods();
	};

	it("returns rows unchanged while nothing is latched", () => {
		const rows = [row(1)];
		expect(applyEnrichmentCaches(rows)).toBe(rows);
	});

	it("fills missing enrichment on bare rows once latched", async () => {
		await latchBoth();
		// Simulate a CDN-baseline republish: bare rows, no enrichment.
		const [first, second] = applyEnrichmentCaches([row(1), row(2)]);
		expect(first.verified_at).toBe("2026-08-01");
		expect(first["osm:payment:lightning"]).toBe("yes");
		expect(first["osm:payment:onchain"]).toBe("no");
		expect(second.verified_at).toBeUndefined();
		expect(second["osm:payment:lightning"]).toBeUndefined();
	});

	it("never overwrites values the row already carries", async () => {
		await latchBoth();
		// A MAP_SYNC row is fresher than the session cache: its own values
		// must win, including a payment set that dropped a cached tag.
		const [fresh] = applyEnrichmentCaches([
			row(1, {
				verified_at: "2026-08-20",
				"osm:payment:onchain": "yes",
			}),
		]);
		expect(fresh.verified_at).toBe("2026-08-20");
		expect(fresh["osm:payment:onchain"]).toBe("yes");
		expect(fresh["osm:payment:lightning"]).toBeUndefined();
	});
});
