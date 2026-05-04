import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Place } from "$lib/types";

import {
	calcVerifiedDate,
	isRecentlyVerified,
	isUpToDate,
	verifiedArr,
} from "./verification";

const FIXED_NOW = new Date("2026-05-04T12:00:00Z").getTime();

const daysAgo = (days: number) =>
	new Date(FIXED_NOW - days * 24 * 60 * 60 * 1000).toISOString();

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date(FIXED_NOW));
});

afterEach(() => {
	vi.useRealTimers();
});

describe("calcVerifiedDate", () => {
	it("returns exactly one year before now", () => {
		const result = calcVerifiedDate();
		const oneYearAgo = new Date(FIXED_NOW);
		oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
		expect(result).toBe(oneYearAgo.getTime());
	});

	// Regression: an earlier version cached the result keyed on
	// Date.getDate() (day-of-month, 1-31), so May 15 and Jun 15 collided
	// and a process spanning a month boundary on the same day number
	// returned a stale value. Verify the result tracks the current date
	// across consecutive calls under a moving clock.
	it("does not return a stale value across month boundaries", () => {
		vi.setSystemTime(new Date("2026-05-15T12:00:00Z"));
		const may = calcVerifiedDate();

		vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
		const june = calcVerifiedDate();

		expect(june).toBeGreaterThan(may);
		const expectedJune = new Date("2025-06-15T12:00:00Z").getTime();
		expect(june).toBe(expectedJune);
	});
});

describe("isRecentlyVerified", () => {
	it("returns true for a date well within the 12-month window", () => {
		expect(isRecentlyVerified(daysAgo(30))).toBe(true);
		expect(isRecentlyVerified(daysAgo(180))).toBe(true);
	});

	it("returns false for a date older than 12 months", () => {
		expect(isRecentlyVerified(daysAgo(400))).toBe(false);
	});

	// Regression for issue #964: AreaPage previously used
	// differenceInMonths(now, date) > 12 (whole-month rounding), so a place
	// 12 months + 15 days old looked "current" there while MerchantCard's
	// ms-precision check called it outdated. Both must agree.
	it("returns false for a date 12 months and 15 days old", () => {
		const date = new Date(FIXED_NOW);
		date.setFullYear(date.getFullYear() - 1);
		date.setDate(date.getDate() - 15);
		expect(isRecentlyVerified(date.toISOString())).toBe(false);
	});

	it("returns false for undefined, null, empty, or invalid input", () => {
		expect(isRecentlyVerified(undefined)).toBe(false);
		expect(isRecentlyVerified(null)).toBe(false);
		expect(isRecentlyVerified("")).toBe(false);
		expect(isRecentlyVerified("not-a-date")).toBe(false);
	});
});

describe("verifiedArr", () => {
	const place = (overrides: Partial<Place> = {}): Place =>
		({ id: 1, ...overrides }) as unknown as Place;

	it("returns an empty array when no OSM date tags are present", () => {
		expect(verifiedArr(place())).toEqual([]);
	});

	it("returns the OSM date tags that are present", () => {
		expect(
			verifiedArr(
				place({
					"osm:survey:date": "2025-07-18",
					"osm:check_date": "2025-03-01",
				}),
			),
		).toEqual(["2025-07-18", "2025-03-01"]);
	});

	it("sorts multiple dates with the most recent first", () => {
		expect(
			verifiedArr(
				place({
					"osm:check_date": "2025-03-01",
					"osm:survey:date": "2025-07-18",
					"osm:check_date:currency:XBT": "2024-12-15",
				}),
			),
		).toEqual(["2025-07-18", "2025-03-01", "2024-12-15"]);
	});

	it("ignores invalid date strings", () => {
		expect(
			verifiedArr(
				place({
					"osm:survey:date": "not-a-date",
					"osm:check_date": "2025-07-18",
				}),
			),
		).toEqual(["2025-07-18"]);
	});

	// Regression for issue #964: MerchantCard renders the same place twice -
	// first with the stripped MAP_SYNC shape (no OSM date tags), then again
	// after fetchEnhancedPlace populates COMPLETE_PLACE fields. A previous
	// module-scope cache keyed on `${id}:${updated_at}` returned the empty
	// first result for the enhanced second call, leaving cards stuck on
	// "Not recently verified" even when the place had a fresh date.
	it("does not return a stale empty result when the same record is later enriched", () => {
		const id = 42;
		const updated_at = "2025-07-19T00:00:00Z";

		const stripped = place({ id, updated_at });
		expect(verifiedArr(stripped)).toEqual([]);

		const enriched = place({
			id,
			updated_at,
			"osm:survey:date": "2025-07-18",
		});
		expect(verifiedArr(enriched)).toEqual(["2025-07-18"]);
	});
});

describe("isUpToDate", () => {
	const place = (verified_at: string | undefined): Place =>
		({ id: 1, verified_at }) as unknown as Place;

	it("returns true when verified_at is within the window", () => {
		expect(isUpToDate(place(daysAgo(30)))).toBe(true);
	});

	it("returns false when verified_at is outside the window", () => {
		expect(isUpToDate(place(daysAgo(400)))).toBe(false);
	});

	it("returns false when merchant or verified_at is missing", () => {
		expect(isUpToDate(null)).toBe(false);
		expect(isUpToDate(place(undefined))).toBe(false);
	});
});
