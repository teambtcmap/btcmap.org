import { get } from "svelte/store";
import { describe, expect, it } from "vitest";

import { CATEGORIES, placeMatchesCategory } from "$lib/categoryMapping";
import { DERIVED_ISSUE_CODES } from "$lib/placeIssues";
import { places } from "$lib/store";
import type { Place } from "$lib/types";
import { filterPlacesByRecency } from "$lib/verification";

import {
	computeVisibleSignature,
	placesRevision,
	selectVisiblePlaces,
} from "./visiblePlaces";

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
	issueCodes: null,
	issuesReady: true,
	paymentFilter: null,
	paymentReady: true,
};

const allIssueCodes = new Set(DERIVED_ISSUE_CODES);

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

	it("narrows to places with derived issues when asked and ready", () => {
		// Corpus issue rows: two outdated, one never verified, one missing
		// its icon (also outdated) — the deleted row never counts.
		const r = selectVisiblePlaces({
			...base,
			places: corpus(),
			issueCodes: allIssueCodes,
		});
		expect(r.selection.length).toBe(4);
		expect(r.selection.some((p) => p.verified_at === undefined)).toBe(true);
		// Chip counts describe the issue set, not the full corpus — selecting
		// a chip inside the worklist must show exactly its count.
		expect(r.counts.all).toBe(4);
	});

	it("narrows to the selected issue categories only", () => {
		// Only one corpus row has never been verified (the icon-less cafe).
		const notVerified = selectVisiblePlaces({
			...base,
			places: corpus(),
			issueCodes: new Set(["not_verified"] as const),
		});
		expect(notVerified.selection.length).toBe(1);
		expect(notVerified.selection[0].verified_at).toBeUndefined();

		// Only one row lacks an icon (the old, verified one).
		const missingIcon = selectVisiblePlaces({
			...base,
			places: corpus(),
			issueCodes: new Set(["missing_icon"] as const),
		});
		expect(missingIcon.selection.length).toBe(1);
		expect(missingIcon.selection[0].icon).toBeUndefined();
	});

	it("keeps the issues filter inert until the dates are ready", () => {
		// Bulk rows before enrichment would ALL classify as not_verified;
		// the gate keeps the world visible instead.
		const r = selectVisiblePlaces({
			...base,
			places: corpus(),
			issueCodes: allIssueCodes,
			issuesReady: false,
		});
		expect(r.selection.length).toBe(7);
	});

	// The embed payment filter (?onchain&lightning&nfc, #1269): a dedicated
	// corpus so the tag combinations are explicit — the shared corpus stays
	// payment-agnostic.
	const paymentCorpus = () => [
		place({ "osm:payment:onchain": "yes", "osm:payment:lightning": "yes" }),
		place({ "osm:payment:lightning": "yes" }),
		place({ "osm:payment:lightning_contactless": "yes" }),
		place({ "osm:payment:onchain": "no" as "yes" }),
		place({}),
		place({ "osm:payment:lightning": "yes", deleted_at: old() }),
	];

	it("narrows to places tagged yes for every flagged method when ready", () => {
		const lightningOnly = selectVisiblePlaces({
			...base,
			places: paymentCorpus(),
			paymentFilter: { onchain: false, lightning: true, nfc: false },
		});
		expect(lightningOnly.selection.length).toBe(2);

		const both = selectVisiblePlaces({
			...base,
			places: paymentCorpus(),
			paymentFilter: { onchain: true, lightning: true, nfc: false },
		});
		expect(both.selection.length).toBe(1);

		const nfc = selectVisiblePlaces({
			...base,
			places: paymentCorpus(),
			paymentFilter: { onchain: false, lightning: false, nfc: true },
		});
		expect(nfc.selection.length).toBe(1);
		expect(nfc.selection[0]["osm:payment:lightning_contactless"]).toBe("yes");
	});

	it("keeps the payment filter inert until the tags are ready", () => {
		// Bulk rows before the payment enrichment carry no tags at all; the
		// gate keeps the world visible instead of hiding every pin.
		const r = selectVisiblePlaces({
			...base,
			places: paymentCorpus(),
			paymentFilter: { onchain: false, lightning: true, nfc: false },
			paymentReady: false,
		});
		expect(r.selection.length).toBe(5);
	});

	it("counts chips on the payment-filtered set", () => {
		// Payment applies pre-category (unlike boosts): inside an embed the
		// chips must describe the narrowed world, not promise hidden pins.
		const r = selectVisiblePlaces({
			...base,
			places: paymentCorpus(),
			paymentFilter: { onchain: false, lightning: true, nfc: false },
		});
		expect(r.counts.all).toBe(2);
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
			computeVisibleSignature({ ...inputs, issueCodes: allIssueCodes }, 7, ""),
		).not.toBe(sig);
		// A subset selection must not collide with all-codes or with off.
		expect(
			computeVisibleSignature(
				{ ...inputs, issueCodes: new Set(["outdated"] as const) },
				7,
				"",
			),
		).not.toBe(
			computeVisibleSignature({ ...inputs, issueCodes: allIssueCodes }, 7, ""),
		);
		expect(
			computeVisibleSignature({ ...inputs, issuesReady: false }, 7, ""),
		).not.toBe(sig);
		expect(
			computeVisibleSignature(
				{
					...inputs,
					paymentFilter: { onchain: true, lightning: false, nfc: false },
				},
				7,
				"",
			),
		).not.toBe(sig);
		// Distinct method combinations must not collide with each other.
		expect(
			computeVisibleSignature(
				{
					...inputs,
					paymentFilter: { onchain: true, lightning: false, nfc: false },
				},
				7,
				"",
			),
		).not.toBe(
			computeVisibleSignature(
				{
					...inputs,
					paymentFilter: { onchain: false, lightning: true, nfc: false },
				},
				7,
				"",
			),
		);
		expect(
			computeVisibleSignature({ ...inputs, paymentReady: false }, 7, ""),
		).not.toBe(sig);
		expect(
			computeVisibleSignature({ ...inputs, mode: "search" }, 7, "1,2"),
		).not.toBe(sig);
		// the revision covers content changes a shape signature can't see
		expect(computeVisibleSignature(inputs, 8, "")).not.toBe(sig);
	});
});

describe("placesRevision", () => {
	it("bumps once per $places publication, including identical re-sets", () => {
		// This is the load-bearing replacement for the lastUpdatedPlaceId
		// handshake: ANY publication — boost/comment write-through, enrichment
		// merge, sync — must change the render signature. Subscribe for the
		// duration (like the page's $placesRevision) because derived stores
		// are lazy and only track while subscribed.
		const seen: number[] = [];
		const unsubscribe = placesRevision.subscribe((n) => seen.push(n));
		const before = seen.length;

		places.set([]);
		// An identical reference still counts as a publication — the sync
		// layer is responsible for not republishing unchanged data, not us
		places.set(get(places));

		unsubscribe();
		expect(seen.length).toBe(before + 2);
		expect(seen[seen.length - 1]).toBe(seen[before - 1] + 2);
	});
});
