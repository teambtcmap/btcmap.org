import { describe, expect, it } from "vitest";

import { BOOSTED_CLUSTERING_MAX_ZOOM } from "$lib/constants";
import type { Place } from "$lib/types";

import {
	routePlacesByBoostAndZoom,
	shouldClusterBoostedAtZoom,
} from "./boostedClustering";

const FAR_FUTURE = "2999-01-01T00:00:00.000Z";
const PAST = "2000-01-01T00:00:00.000Z";

const makePlace = (id: number, overrides: Partial<Place> = {}): Place => ({
	id,
	lat: 0,
	lon: 0,
	icon: "question_mark",
	...overrides,
});

const boosted = (id: number) => makePlace(id, { boosted_until: FAR_FUTURE });
const regular = (id: number) => makePlace(id);

describe("shouldClusterBoostedAtZoom", () => {
	it("clusters boosted markers at/below the threshold", () => {
		expect(shouldClusterBoostedAtZoom(1)).toBe(true);
		expect(shouldClusterBoostedAtZoom(BOOSTED_CLUSTERING_MAX_ZOOM)).toBe(true);
	});

	it("keeps boosted markers standalone above the threshold", () => {
		expect(shouldClusterBoostedAtZoom(BOOSTED_CLUSTERING_MAX_ZOOM + 1)).toBe(
			false,
		);
		expect(shouldClusterBoostedAtZoom(15)).toBe(false);
	});

	it("keys on the integer zoom level, not the fractional value", () => {
		// MapLibre zoom is fractional; clustering transitions on integer levels.
		// The whole z5 band stays clustered; declustering happens at exactly z6.
		expect(shouldClusterBoostedAtZoom(5.01)).toBe(true);
		expect(shouldClusterBoostedAtZoom(5.99)).toBe(true);
		expect(shouldClusterBoostedAtZoom(6)).toBe(false);
		expect(shouldClusterBoostedAtZoom(6.01)).toBe(false);
	});
});

describe("routePlacesByBoostAndZoom", () => {
	const places = [regular(1), boosted(2), regular(3), boosted(4)];

	it("folds boosted into the clustered source at/below the threshold", () => {
		const { clustered, standalone } = routePlacesByBoostAndZoom(
			places,
			BOOSTED_CLUSTERING_MAX_ZOOM,
		);
		expect(clustered.map((p) => p.id).sort()).toEqual([1, 2, 3, 4]);
		expect(standalone).toEqual([]);
	});

	it("keeps boosted clustered at fractional zoom within the z5 band", () => {
		const { clustered, standalone } = routePlacesByBoostAndZoom(places, 5.5);
		expect(clustered.map((p) => p.id).sort()).toEqual([1, 2, 3, 4]);
		expect(standalone).toEqual([]);
	});

	it("routes boosted to the standalone source above the threshold", () => {
		const { clustered, standalone } = routePlacesByBoostAndZoom(
			places,
			BOOSTED_CLUSTERING_MAX_ZOOM + 1,
		);
		expect(clustered.map((p) => p.id).sort()).toEqual([1, 3]);
		expect(standalone.map((p) => p.id).sort()).toEqual([2, 4]);
	});

	it("treats expired boosts as regular places", () => {
		const expired = makePlace(5, { boosted_until: PAST });
		const { clustered, standalone } = routePlacesByBoostAndZoom([expired], 12);
		expect(clustered.map((p) => p.id)).toEqual([5]);
		expect(standalone).toEqual([]);
	});

	it("drops deleted places from both sources at every zoom", () => {
		const deleted = makePlace(6, {
			boosted_until: FAR_FUTURE,
			deleted_at: PAST,
		});
		for (const zoom of [BOOSTED_CLUSTERING_MAX_ZOOM, 12]) {
			const { clustered, standalone } = routePlacesByBoostAndZoom(
				[deleted],
				zoom,
			);
			expect(clustered).toEqual([]);
			expect(standalone).toEqual([]);
		}
	});
});
