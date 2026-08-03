import { describe, expect, it } from "vitest";

import { CATEGORIES, placeMatchesCategory } from "$lib/categoryMapping";
import type { Place } from "$lib/types";
import { filterPlacesByRecency } from "$lib/verification";

import { computeVisibleSignature, selectVisiblePlaces } from "./visiblePlaces";

const recent = () => new Date(Date.now() - 30 * 86400000).toISOString();
const old = () => new Date(Date.now() - 2 * 365 * 86400000).toISOString();
const future = () => new Date(Date.now() + 365 * 86400000).toISOString();

let nextId = 1;
function place(overrides: Partial<Place> = {}): Place {
	return { id: nextId++, lat: 0, lon: 0, ...overrides } as Place;
}

const corpus = () => [
	place({ icon: "restaurant", verified_at: recent() }),
	place({ icon: "restaurant", verified_at: old() }),
	place({ icon: "local_cafe", verified_at: recent(), boosted_until: future() }),
	place({ icon: "local_cafe" }),
	place({ icon: "local_atm", verified_at: old() }),
	place({ icon: "some_unknown", verified_at: recent() }),
	place({ verified_at: old() }),
	place({ icon: "restaurant", verified_at: recent(), deleted_at: old() }),
];

const base = {
	mode: "nearby" as const,
	category: "all" as const,
	recency: null,
	recencyReady: true,
	boostsOnly: false,
};

describe("selectVisiblePlaces", () => {
	it("drops deleted rows unconditionally", () => {
		const r = selectVisiblePlaces({ ...base, places: corpus() });
		expect(r.selection.some((p) => p.deleted_at)).toBe(false);
		expect(r.selection.length).toBe(7);
	});

	it("applies the recency window only when the rows carry dates", () => {
		const rows = corpus();
		const ready = selectVisiblePlaces({
			...base,
			places: rows,
			recency: 1,
		});
		expect(ready.selection.every((p) => p.verified_at)).toBe(true);

		// Provenance gate: bulk-feed rows before enrichment must not all
		// classify as unverified — the filter stays inert.
		const notReady = selectVisiblePlaces({
			...base,
			places: rows,
			recency: 1,
			recencyReady: false,
		});
		expect(notReady.selection.length).toBe(7);
	});

	// The consistency oracle formerly spread across the store tests: counts
	// must describe exactly what selecting each chip would show, computed on
	// the recency-filtered PRE-category set.
	it("counts describe the pre-category selection for every filter mode", () => {
		const rows = corpus();
		for (const recency of [null, 1, "outdated"] as const) {
			const r = selectVisiblePlaces({ ...base, places: rows, recency });
			const reference = filterPlacesByRecency(
				rows.filter((p) => !p.deleted_at),
				recency,
			);
			expect(r.counts.all, `recency ${String(recency)}`).toBe(reference.length);
			for (const category of CATEGORIES) {
				if (category === "all") continue;
				expect(r.counts[category], `${String(recency)}/${category}`).toBe(
					reference.filter((p) => placeMatchesCategory(p, category)).length,
				);
			}
		}
	});

	it("filters by category with the panel's predicate", () => {
		const r = selectVisiblePlaces({
			...base,
			places: corpus(),
			category: "coffee",
		});
		expect(r.selection.every((p) => placeMatchesCategory(p, "coffee"))).toBe(
			true,
		);
		expect(r.selection.length).toBe(2);
		expect(r.effectiveCategory).toBe("coffee");
	});

	it("auto-resets a selected category the current window zeroes", () => {
		// With a 1-year window the only ATM row (old) disappears.
		const r = selectVisiblePlaces({
			...base,
			places: corpus(),
			category: "atms",
			recency: 1,
		});
		expect(r.effectiveCategory).toBe("all");
		expect(r.selection.length).toBeGreaterThan(0);
	});

	it("keeps a selected category the window still populates", () => {
		const r = selectVisiblePlaces({
			...base,
			places: corpus(),
			category: "restaurants",
			recency: 1,
		});
		expect(r.effectiveCategory).toBe("restaurants");
		expect(r.selection.length).toBe(1);
	});

	it("narrows to boosted places when asked", () => {
		const r = selectVisiblePlaces({
			...base,
			places: corpus(),
			boostsOnly: true,
		});
		expect(r.selection.length).toBe(1);
		expect(r.selection[0].boosted_until).toBeTruthy();
	});

	it("composes boosts after category (empty intersections are honest)", () => {
		const r = selectVisiblePlaces({
			...base,
			places: corpus(),
			category: "restaurants",
			boostsOnly: true,
		});
		expect(r.selection).toEqual([]);
		// counts still describe the pre-category set so the chips stay usable
		expect(r.counts.all).toBe(7);
	});
});

describe("computeVisibleSignature", () => {
	const inputs = { ...base };

	it("is stable across unrelated recomputation", () => {
		expect(computeVisibleSignature(inputs, 7, "")).toBe(
			computeVisibleSignature(inputs, 7, ""),
		);
	});

	it("changes when any visibility input changes", () => {
		const sig = computeVisibleSignature(inputs, 7, "");
		expect(
			computeVisibleSignature({ ...inputs, category: "coffee" }, 7, ""),
		).not.toBe(sig);
		expect(computeVisibleSignature({ ...inputs, recency: 1 }, 7, "")).not.toBe(
			sig,
		);
		expect(
			computeVisibleSignature({ ...inputs, recencyReady: false }, 7, ""),
		).not.toBe(sig);
		expect(
			computeVisibleSignature({ ...inputs, boostsOnly: true }, 7, ""),
		).not.toBe(sig);
		expect(
			computeVisibleSignature({ ...inputs, mode: "search" }, 7, "1,2"),
		).not.toBe(sig);
		// the revision covers content changes a shape signature can't see
		expect(computeVisibleSignature(inputs, 8, "")).not.toBe(sig);
	});
});
